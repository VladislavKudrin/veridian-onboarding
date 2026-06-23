import { randomUUID } from "crypto";

export interface LoginSession {
  id: string;
  applySaids: string[]; // the presentation-request SAIDs we sent
  userId: number;
  expectedAid: string; // the wallet AID we challenged
  status: "pending" | "success" | "failed";
  token?: string;
  reason?: string;
  createdAt: number;
}

const TTL_MS = 3 * 60 * 1000;
const sessions = new Map<string, LoginSession>();

export function createLoginSession(input: {
  applySaids: string[];
  userId: number;
  expectedAid: string;
}): LoginSession {
  const session: LoginSession = {
    id: randomUUID(),
    status: "pending",
    createdAt: Date.now(),
    ...input,
  };
  sessions.set(session.id, session);
  return session;
}

export function getLoginSession(id: string): LoginSession | undefined {
  const s = sessions.get(id);
  if (s && Date.now() - s.createdAt > TTL_MS) {
    sessions.delete(id);
    return undefined;
  }
  return s;
}

export function findByApplySaid(said: string): LoginSession | undefined {
  for (const s of sessions.values()) {
    if (s.applySaids.includes(said)) return s;
  }
  return undefined;
}

export function patchLoginSession(id: string, patch: Partial<LoginSession>): void {
  const s = sessions.get(id);
  if (s) Object.assign(s, patch);
}

export function expireOldSessions(): void {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > TTL_MS) sessions.delete(id);
  }
}
