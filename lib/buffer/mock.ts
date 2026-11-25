import type { BufferHttpResult, BufferTransport } from "./client";

export const MOCK_ORG = "aaaaaaaaaaaaaaaaaaaaaaaa";
export const MOCK_IG = "bbbbbbbbbbbbbbbbbbbbbbbb";
export const MOCK_FB = "cccccccccccccccccccccccc";

export type MockBuffer = {
  transport: BufferTransport;
  posts: { id: string; input: Record<string, unknown> }[];
  calls: number;
};

function channel(id: string, service: string, name: string) {
  return {
    id,
    name,
    displayName: name,
    service,
    type: "business",
    avatar: "https://cdn.example.test/avatar.png",
    descriptor: service === "instagram" ? "Instagram Business" : "Facebook Page",
    isDisconnected: false,
    isLocked: false,
    isQueuePaused: false,
    organizationId: MOCK_ORG,
  };
}

/** In-memory Buffer GraphQL. Token "invalid" is a 401; "limited" is a 429. */
export function createMockBuffer(): MockBuffer {
  const posts: MockBuffer["posts"] = [];
  let calls = 0;
  const transport: BufferTransport = async (req) => {
    calls += 1;
    const token = req.token.trim();
    if (!token || token === "invalid") {
      return { httpStatus: 401, body: { errors: [{ message: "Unauthorized" }] } };
    }
    if (token === "limited") {
      return { httpStatus: 429, body: { errors: [{ message: "Rate limit exceeded" }] } };
    }
    if (req.query.includes("organizations")) {
      return {
        httpStatus: 200,
        body: {
          data: {
            account: {
              id: "111111111111111111111111",
              email: "hola@enone.app",
              organizations: [{ id: MOCK_ORG, name: "enone" }],
            },
          },
        },
      };
    }
    if (req.query.includes("channels(")) {
      return {
        httpStatus: 200,
        body: { data: { channels: [channel(MOCK_IG, "instagram", "enone"), channel(MOCK_FB, "facebook", "enone")] } },
      };
    }
    if (req.query.includes("createPost")) {
      const input = ((req.variables || {}).input || {}) as Record<string, unknown>;
      const channelId = String(input.channelId || "");
      if (channelId === "dddddddddddddddddddddddd") {
        const body: BufferHttpResult["body"] = {
          data: { createPost: { message: "Channel not found" } },
        };
        return { httpStatus: 200, body };
      }
      if (String(input.schedulingType || "") === "automatic" && channelId === "eeeeeeeeeeeeeeeeeeeeeeee") {
        return { httpStatus: 200, body: { data: { createPost: { message: "This channel requires notification scheduling" } } } };
      }
      const id = `post_${posts.length + 1}`;
      posts.push({ id, input: { ...input } });
      const dueAt =
        input.mode === "customScheduled"
          ? String(input.dueAt || "")
          : input.mode === "shareNow"
            ? new Date().toISOString()
            : new Date(Date.now() + 3600_000).toISOString();
      return {
        httpStatus: 200,
        body: {
          data: { createPost: { post: { id, dueAt, status: "scheduled", text: input.text } } },
        },
      };
    }
    return { httpStatus: 200, body: { errors: [{ message: "Unknown query" }] } };
  };
  return { transport, posts, get calls() { return calls; } };
}

export const sharedMockBuffer = createMockBuffer();
