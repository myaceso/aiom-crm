import { createHash, randomBytes } from "crypto";
import { BUFFER_MSG } from "./messages";

export const BUFFER_SCOPES = "posts:write posts:read account:read offline_access";

export function oauthConfigured(): boolean {
  return Boolean(process.env.BUFFER_CLIENT_ID?.trim() && process.env.BUFFER_CLIENT_SECRET?.trim());
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function randomState(): string {
  return randomBytes(24).toString("base64url");
}

export function requestOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  if (host) return `${proto}://${host.split(",")[0].trim()}`;
  return new URL(req.url).origin;
}

/** Must match a redirect URI registered on the Buffer app client, and the host of the session cookie. */
export function bufferRedirectUri(req: Request): string {
  const forced = process.env.BUFFER_OAUTH_REDIRECT_URI?.trim();
  if (forced) return forced;
  return `${requestOrigin(req)}/api/buffer/oauth/callback`;
}

export function authorizeUrl(req: Request, state: string, challenge: string): string {
  const url = new URL("https://auth.buffer.com/auth");
  url.searchParams.set("client_id", process.env.BUFFER_CLIENT_ID!.trim());
  url.searchParams.set("redirect_uri", bufferRedirectUri(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", BUFFER_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export type TokenPair = { accessToken: string; refreshToken: string; expiresAt: string };

type TokenJson = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function expiresAtFrom(seconds: number | undefined): string {
  const life = Number.isFinite(seconds) && seconds! > 0 ? seconds! : 3600;
  return new Date(Date.now() + Math.max(60, life - 60) * 1000).toISOString();
}

export function oauthErrorMessage(code: string, description = ""): string {
  if (code === "access_denied") return BUFFER_MSG.denied;
  if (code === "invalid_client")
    return "BUFFER_CLIENT_ID no coincide con el cliente de Buffer. Revísalo en Buffer → Ajustes → API.";
  if (code === "invalid_grant") return "El código de Buffer caducó o ya se usó. Vuelve a conectar la cuenta.";
  if (description) return `No se pudo conectar con Buffer: ${description}`;
  return "No se pudo conectar con Buffer. Inténtalo de nuevo desde Integraciones.";
}

export async function exchangeAuthCode(opts: {
  code: string;
  verifier: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenPair> {
  return tokenRequest(
    {
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      code_verifier: opts.verifier,
    },
    opts.fetchImpl
  );
}

export async function refreshAccessToken(refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<TokenPair> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, fetchImpl);
}

async function tokenRequest(fields: Record<string, string>, fetchImpl: typeof fetch = fetch): Promise<TokenPair> {
  const clientId = process.env.BUFFER_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.BUFFER_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) {
    const err = new Error(BUFFER_MSG.oauthMissing);
    throw err;
  }
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...fields });
  let json: TokenJson = {};
  let status = 0;
  try {
    const res = await fetchImpl("https://auth.buffer.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      cache: "no-store",
    });
    status = res.status;
    json = (await res.json().catch(() => ({}))) as TokenJson;
  } catch {
    throw new Error(BUFFER_MSG.network);
  }
  if (!json.access_token) {
    throw new Error(oauthErrorMessage(json.error || (status === 401 ? "invalid_client" : ""), json.error_description || ""));
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || "",
    expiresAt: expiresAtFrom(json.expires_in),
  };
}
