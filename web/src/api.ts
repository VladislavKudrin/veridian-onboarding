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

export interface User {
  username: string;
  displayName: string;
  email: string;
}

export interface Connection {
  id: number;
  user_aid: string;
  user_oobi: string;
  status: string;
  created_at: string;
}

export interface Credential {
  id: number;
  cred_said: string;
  schema_said: string;
  attributes: string;
  status: string;
  issued_at: string;
}

export interface SchemaSummary {
  said: string;
  title: string;
  credentialType: string;
  source: string;
  fields: string[];
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

  me: () => request<User>("/auth/me"),

  health: () =>
    request<{ keria: { enabled: boolean; available: boolean } }>("/health"),

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

  credentialStatus: () =>
    request<{ active: boolean; credential: Credential | null }>(
      "/credentials/status"
    ),

  issueCredential: () =>
    request<{ success: boolean; credential: Credential }>(
      "/credentials/issue",
      { method: "POST" }
    ),

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
};
