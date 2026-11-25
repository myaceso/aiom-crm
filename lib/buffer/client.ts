import { BUFFER_MSG, humanizeBufferMessage } from "./messages";
import { isBufferId, isHttpsUrl, type BufferMedia, type BufferPostMode } from "./model";
import type { BufferChannelInfo } from "../types";

export type BufferHttpResult = {
  httpStatus: number;
  body: {
    data?: Record<string, unknown>;
    errors?: { message?: string }[];
  };
};

export type BufferTransport = (req: {
  query: string;
  variables?: Record<string, unknown>;
  token: string;
}) => Promise<BufferHttpResult>;

export class BufferApiError extends Error {
  status: number;
  code: "missing" | "unauthorized" | "rate_limit" | "graphql" | "mutation" | "network";
  raw: string;

  constructor(message: string, status: number, code: BufferApiError["code"], raw = "") {
    super(message);
    this.name = "BufferApiError";
    this.status = status;
    this.code = code;
    this.raw = raw || message;
  }
}

export type BufferOrganization = { id: string; name: string; channels: BufferChannelInfo[] };

export type BufferAccountSnapshot = {
  accountId: string;
  email: string;
  organizations: BufferOrganization[];
};

export type CreatedBufferPost = {
  id: string;
  dueAt: string | null;
  status: string;
  schedulingType: "automatic" | "notification";
};

const ACCOUNT_QUERY = `query Account {
  account {
    id
    email
    organizations { id name }
  }
}`;

function channelsQuery(organizationId: string) {
  return `query Channels {
  channels(input: { organizationId: "${organizationId}" }) {
    id
    name
    displayName
    service
    type
    avatar
    descriptor
    isDisconnected
    isLocked
    isQueuePaused
    organizationId
  }
}`;
}

const CREATE_POST = `mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess {
      post { id dueAt status text }
    }
    ... on MutationError { message }
  }
}`;

export async function bufferFetchTransport(req: {
  query: string;
  variables?: Record<string, unknown>;
  token: string;
}): Promise<BufferHttpResult> {
  const endpoint = (process.env.BUFFER_API_URL || "https://api.buffer.com").replace(/\/$/, "");
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${req.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: req.query, variables: req.variables || {} }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as BufferHttpResult["body"];
    return { httpStatus: res.status, body };
  } catch {
    return { httpStatus: 0, body: {} };
  }
}

async function gql(
  transport: BufferTransport,
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!token.trim()) throw new BufferApiError(BUFFER_MSG.missing, 0, "missing");
  const res = await transport({ query, variables, token });
  const top = res.body.errors?.[0]?.message || "";
  if (res.httpStatus === 401) throw new BufferApiError(BUFFER_MSG.unauthorized, 401, "unauthorized", top);
  if (res.httpStatus === 429) throw new BufferApiError(BUFFER_MSG.rate, 429, "rate_limit", top);
  if (res.httpStatus === 0 || res.httpStatus >= 500)
    throw new BufferApiError(BUFFER_MSG.network, res.httpStatus, "network", top);
  if (res.body.errors?.length && !res.body.data) {
    if (/unauth|invalid api key|invalid token|forbidden/i.test(top))
      throw new BufferApiError(BUFFER_MSG.unauthorized, 401, "unauthorized", top);
    if (/rate limit|too many/i.test(top)) throw new BufferApiError(BUFFER_MSG.rate, 429, "rate_limit", top);
    throw new BufferApiError(humanizeBufferMessage(top), 400, "graphql", top);
  }
  return res.body.data || {};
}

function asChannel(raw: Record<string, unknown>, organizationId: string): BufferChannelInfo | null {
  const id = String(raw.id || "");
  if (!isBufferId(id)) return null;
  const avatar = String(raw.avatar || "");
  return {
    id: id.toLowerCase(),
    name: String(raw.name || ""),
    displayName: String(raw.displayName || ""),
    service: String(raw.service || ""),
    type: String(raw.type || ""),
    avatar: /^https:\/\//i.test(avatar) ? avatar : "",
    descriptor: String(raw.descriptor || ""),
    isDisconnected: Boolean(raw.isDisconnected),
    isLocked: Boolean(raw.isLocked),
    isQueuePaused: Boolean(raw.isQueuePaused),
    organizationId: String(raw.organizationId || organizationId).toLowerCase(),
  };
}

export type CreatePostInput = {
  channelId: string;
  text: string;
  mode: BufferPostMode;
  dueAt?: string | null;
  media: BufferMedia[];
  aiAssisted?: boolean;
  schedulingType?: "automatic" | "notification";
};

function assetsOf(media: BufferMedia[]): { assets: Record<string, unknown>[]; warning: string | null } {
  const https = media.filter((m) => isHttpsUrl(m.url));
  const video = https.find((m) => m.kind === "video");
  if (video) {
    return {
      assets: [{ video: { url: video.url } }],
      warning:
        https.length > 1
          ? "Buffer admite un solo video por envío; se omitieron los demás archivos."
          : null,
    };
  }
  const images = https.filter((m) => m.kind === "image").slice(0, 10);
  const extra = https.filter((m) => m.kind === "image").length - images.length;
  return {
    assets: images.map((img) => ({ image: { url: img.url } })),
    warning: extra > 0 ? "Se enviaron solo las primeras 10 imágenes." : null,
  };
}

export function prepareAssets(media: BufferMedia[]) {
  return assetsOf(media);
}

export type BufferClient = {
  token: string;
  inspect(): Promise<BufferAccountSnapshot>;
  createPost(input: CreatePostInput): Promise<CreatedBufferPost & { warning: string | null }>;
};

export function createBufferClient(token: string, transport: BufferTransport = bufferFetchTransport): BufferClient {
  return {
    token,
    async inspect() {
      const data = await gql(transport, token, ACCOUNT_QUERY);
      const account = (data.account || {}) as Record<string, unknown>;
      const orgs = Array.isArray(account.organizations) ? account.organizations : [];
      const organizations: BufferOrganization[] = [];
      for (const org of orgs) {
        if (!org || typeof org !== "object") continue;
        const id = String((org as { id?: string }).id || "");
        if (!isBufferId(id)) continue;
        const chData = await gql(transport, token, channelsQuery(id.toLowerCase()));
        const list = Array.isArray(chData.channels) ? chData.channels : [];
        organizations.push({
          id: id.toLowerCase(),
          name: String((org as { name?: string }).name || "Organización"),
          channels: list
            .map((c) => (c && typeof c === "object" ? asChannel(c as Record<string, unknown>, id) : null))
            .filter((c): c is BufferChannelInfo => !!c),
        });
      }
      return {
        accountId: String(account.id || ""),
        email: String(account.email || ""),
        organizations,
      };
    },
    async createPost(input) {
      if (!isBufferId(input.channelId))
        throw new BufferApiError("Identificador de canal de Buffer inválido.", 400, "mutation");
      const prepared = assetsOf(input.media);
      const schedulingType = input.schedulingType || "automatic";
      const variables = {
        input: {
          text: input.text.slice(0, 5000),
          channelId: input.channelId.toLowerCase(),
          schedulingType,
          mode: input.mode,
          ...(prepared.assets.length ? { assets: prepared.assets } : {}),
          source: "enone",
          ...(input.aiAssisted ? { aiAssisted: true } : {}),
          ...(input.mode === "customScheduled" && input.dueAt ? { dueAt: input.dueAt } : {}),
        },
      };
      const send = async (scheduling: "automatic" | "notification") => {
        const data = await gql(transport, token, CREATE_POST, {
          input: { ...variables.input, schedulingType: scheduling },
        });
        const payload = (data.createPost || {}) as { post?: { id?: string; dueAt?: string | null; status?: string }; message?: string };
        if (!payload.post?.id) {
          const raw = payload.message || "Error al crear la publicación";
          throw new BufferApiError(humanizeBufferMessage(raw), 400, "mutation", raw);
        }
        return {
          id: String(payload.post.id),
          dueAt: payload.post.dueAt ? String(payload.post.dueAt) : null,
          status: String(payload.post.status || ""),
          schedulingType: scheduling,
          warning: prepared.warning,
        };
      };
      try {
        return await send(schedulingType);
      } catch (e) {
        const raw = e instanceof BufferApiError ? e.raw : "";
        if (schedulingType === "automatic" && /notification|personal profile|facebook group|reminder/i.test(raw)) {
          return send("notification");
        }
        throw e;
      }
    },
  };
}

/** Client used by the app. BUFFER_MOCK=1 swaps the network for the in-memory Buffer. */
export async function appBufferClient(token: string): Promise<BufferClient> {
  if (process.env.BUFFER_MOCK === "1") {
    const { sharedMockBuffer } = await import("./mock");
    return createBufferClient(token, sharedMockBuffer.transport);
  }
  return createBufferClient(token);
}
