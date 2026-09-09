import type { PermissionKey, SafeUser, UserRole } from "./types";

export const ALL_PERMISSIONS: PermissionKey[] = [
  "contacts",
  "conversations",
  "opportunities",
  "marketing",
  "sms",
  "email",
  "whatsapp",
  "telegram",
  "integrations",
  "reporting",
  "payments",
  "sites",
  "calendars",
  "settings",
  "users",
  "aiAssistants",
];

export const STAFF_PERMISSIONS: PermissionKey[] = ALL_PERMISSIONS.filter(
  (p) => p !== "users"
);

/** Map dashboard path prefixes to required permission (undefined = any logged-in user). */
export const ROUTE_PERMISSIONS: { prefix: string; permission: PermissionKey | null }[] = [
  { prefix: "/dashboard/users", permission: "users" },
  { prefix: "/dashboard/contacts", permission: "contacts" },
  { prefix: "/dashboard/conversations", permission: "conversations" },
  { prefix: "/dashboard/opportunities", permission: "opportunities" },
  { prefix: "/dashboard/marketing", permission: "marketing" },
  { prefix: "/dashboard/sms-marketing", permission: "sms" },
  { prefix: "/dashboard/email-marketing", permission: "email" },
  { prefix: "/dashboard/whatsapp", permission: "whatsapp" },
  { prefix: "/dashboard/telegram", permission: "telegram" },
  { prefix: "/dashboard/integrations", permission: "integrations" },
  { prefix: "/dashboard/reporting", permission: "reporting" },
  { prefix: "/dashboard/payments", permission: "payments" },
  { prefix: "/dashboard/sites", permission: "sites" },
  { prefix: "/dashboard/calendars", permission: "calendars" },
  { prefix: "/dashboard/settings", permission: "settings" },
  { prefix: "/dashboard/ai-assistants", permission: "aiAssistants" },
];

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES)) as Uint8Array<ArrayBuffer>;
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_BITS
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToHex(salt)}$${bufToHex(bits)}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = hexToBuf(parts[2]);
  const expected = parts[3];
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_BITS
  );
  const actual = bufToHex(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function isAdmin(user: SafeUser | null | undefined): boolean {
  return !!user && user.role === "admin" && user.active;
}

export function hasPermission(
  user: SafeUser | null | undefined,
  permission: PermissionKey
): boolean {
  if (!user || !user.active) return false;
  if (user.role === "admin") return true;
  return user.permissions.includes(permission);
}

export function canAccessPath(
  user: SafeUser | null | undefined,
  pathname: string
): boolean {
  if (!user || !user.active) return false;
  if (user.role === "admin") return true;
  const match = ROUTE_PERMISSIONS.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
  );
  if (!match || match.permission === null) return true;
  return user.permissions.includes(match.permission);
}

export function permissionForHref(href: string): PermissionKey | null {
  const match = ROUTE_PERMISSIONS.find(
    (r) => href === r.prefix || href.startsWith(r.prefix + "/")
  );
  return match ? match.permission : null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function defaultPermissionsForRole(role: UserRole): PermissionKey[] {
  if (role === "admin") return [...ALL_PERMISSIONS];
  return [];
}
