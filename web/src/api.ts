const BASE = "/api";

let token: string | null = localStorage.getItem("veridian_jwt");

export function getToken(): string | null {
  return token;
}

export function setToken(value: string | null): void {
  token = value;
  if (value) localStorage.setItem("veridian_jwt", value);
  else localStorage.removeItem("veridian_jwt");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export type Role = "issuer" | "holder";

export interface User {
  username: string;
  displayName: string;
  email: string;
  role: Role;
}

export interface CredRequest {
  id: number;
  status: "pending" | "accepted" | "declined" | "revoked";
  schemaSaid: string;
  schemaTitle: string;
  attributes: Record<string, string | number | boolean>;
  credSaid: string | null;
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
  // issuer-only enrichment:
  holder?: { username: string; displayName: string; email: string };
  connected?: boolean;
  userAid?: string | null;
}

export interface Connection {
  id: number;
  user_aid: string;
  user_oobi: string;
  status: string;
  created_at: string;
}

export interface IssuedCredential {
  id: number;
  credSaid: string;
  schemaSaid: string;
  schemaTitle: string;
  attributes: Record<string, string | number | boolean>;
  status: string;
  issuedAt: string;
}

export interface SchemaSummary {
  said: string;
  title: string;
  credentialType: string;
  source: string;
  fields: string[];
  attributes: SchemaField[];
  loginEnabled: boolean;
  oobi: string;
  createdAt: string;
}

export interface CatalogItem {
  said: string;
  title: string;
  credentialType: string;
  fields: string[];
  imported: boolean;
}

export interface SchemaField {
  name: string;
  type: "string" | "number" | "integer" | "boolean" | "date-time";
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  register: (body: {
    username: string;
    password: string;
    displayName: string;
    email: string;
  }) =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ── Log in with a credential (presentation) ──────────
  credLoginStart: (username: string) =>
    request<{ sessionId: string }>("/auth/cred-login/start", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),

  credLoginStatus: (id: string) =>
    request<{
      status: "pending" | "success" | "failed" | "expired";
      token?: string;
      reason?: string;
    }>(`/auth/cred-login/${id}`),

  me: () => request<User>("/auth/me"),

  health: () =>
    request<{ keria: { enabled: boolean; available: boolean } }>("/health"),

  info: () =>
    request<{
      name: string;
      sandbox: boolean;
      public: boolean;
      wallet: { bootUrl: string; connectUrl: string };
    }>("/info"),

  getPlatformOobi: () =>
    request<{ oobi: string; aid: string }>("/connection/oobi"),

  getConnection: () =>
    request<{
      connected: boolean;
      connection: Connection | null;
      stale?: boolean;
      reason?: string;
    }>("/connection"),

  resolveOobi: (oobi: string) =>
    request<{ success: boolean; connection: Connection }>(
      "/connection/resolve",
      { method: "POST", body: JSON.stringify({ oobi }) }
    ),

  disconnect: () =>
    request<{ success: boolean }>("/connection", { method: "DELETE" }),

  listCredentials: () =>
    request<{ credentials: IssuedCredential[] }>("/credentials"),

  // ── Credential requests (apply / approve) ────────────
  listRequests: () => request<{ requests: CredRequest[] }>("/requests"),

  createRequest: (body: { said: string; attributes: Record<string, unknown> }) =>
    request<{ request: CredRequest }>("/requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  acceptRequest: (id: number) =>
    request<{ request: CredRequest }>(`/requests/${id}/accept`, {
      method: "POST",
    }),

  declineRequest: (id: number, reason: string) =>
    request<{ request: CredRequest }>(`/requests/${id}/decline`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  revokeRequest: (id: number) =>
    request<{ request: CredRequest }>(`/requests/${id}/revoke`, {
      method: "POST",
    }),

  // ── Issuer: schemas ──────────────────────────────────
  listSchemas: () => request<{ schemas: SchemaSummary[] }>("/schemas"),

  schemaCatalog: () => request<{ catalog: CatalogItem[] }>("/schemas/catalog"),

  buildSchema: (body: {
    title: string;
    description?: string;
    fields: SchemaField[];
  }) =>
    request<{ schema: SchemaSummary; resolved: boolean; error?: string }>(
      "/schemas",
      { method: "POST", body: JSON.stringify(body) }
    ),

  importSchema: (said: string) =>
    request<{ schema: SchemaSummary; resolved: boolean; error?: string }>(
      "/schemas/import",
      { method: "POST", body: JSON.stringify({ said }) }
    ),

  deleteSchema: (said: string) =>
    request<{ success: boolean }>(`/schemas/${said}`, { method: "DELETE" }),

  toggleSchemaLogin: (said: string, enabled: boolean) =>
    request<{ schema: SchemaSummary }>(`/schemas/${said}/login`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
};
