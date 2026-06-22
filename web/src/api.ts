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

  credentialStatus: () =>
    request<{ active: boolean; credential: Credential | null }>(
      "/credentials/status"
    ),

  issueCredential: () =>
    request<{ success: boolean; credential: Credential }>(
      "/credentials/issue",
      { method: "POST" }
    ),
};
