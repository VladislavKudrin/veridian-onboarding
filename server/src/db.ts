import Database from "better-sqlite3";
import { config } from "./config";

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  email: string;
  created_at: string;
}

export interface ConnectionRow {
  id: number;
  user_id: number;
  user_oobi: string;
  user_aid: string;
  platform_oobi: string;
  status: string;
  created_at: string;
}

export interface CredentialRow {
  id: number;
  user_id: number;
  connection_id: number;
  schema_said: string;
  cred_said: string;
  attributes: string;
  status: string;
  issued_at: string;
}

const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    email        TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS connections (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    user_oobi     TEXT NOT NULL,
    user_aid      TEXT NOT NULL,
    platform_oobi TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'connected',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schemas (
    said            TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    credential_type TEXT NOT NULL,
    definition      TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT 'builder',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS credentials (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    connection_id INTEGER NOT NULL REFERENCES connections(id),
    schema_said   TEXT NOT NULL,
    cred_said     TEXT NOT NULL,
    attributes    TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'issued',
    issued_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export interface SchemaRow {
  said: string;
  title: string;
  credential_type: string;
  definition: string;
  source: string;
  created_at: string;
}

export function listSchemas(): SchemaRow[] {
  return db
    .prepare(`SELECT * FROM schemas ORDER BY created_at DESC`)
    .all() as SchemaRow[];
}

export function getSchemaBySaid(said: string): SchemaRow | undefined {
  return db.prepare(`SELECT * FROM schemas WHERE said = ?`).get(said) as
    | SchemaRow
    | undefined;
}

export function upsertSchema(
  row: Omit<SchemaRow, "created_at">
): SchemaRow {
  db.prepare(
    `INSERT INTO schemas (said, title, credential_type, definition, source)
     VALUES (@said, @title, @credential_type, @definition, @source)
     ON CONFLICT(said) DO UPDATE SET
       title=@title, credential_type=@credential_type,
       definition=@definition, source=@source`
  ).run(row);
  return getSchemaBySaid(row.said)!;
}

export function deleteSchema(said: string): void {
  db.prepare(`DELETE FROM schemas WHERE said = ?`).run(said);
}

/** Seed the single mock web2 account if it does not exist. */
export function seedAdmin(): UserRow {
  const existing = getUserByUsername(config.admin.username);
  if (existing) return existing;

  db.prepare(
    `INSERT INTO users (username, display_name, email) VALUES (?, ?, ?)`
  ).run(config.admin.username, "Admin User", "admin@veridian-poc.test");

  return getUserByUsername(config.admin.username)!;
}

export function getUserByUsername(username: string): UserRow | undefined {
  return db
    .prepare(`SELECT * FROM users WHERE username = ?`)
    .get(username) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as
    | UserRow
    | undefined;
}

export function getLatestConnection(
  userId: number
): ConnectionRow | undefined {
  return db
    .prepare(
      `SELECT * FROM connections WHERE user_id = ? ORDER BY id DESC LIMIT 1`
    )
    .get(userId) as ConnectionRow | undefined;
}

export function insertConnection(
  row: Omit<ConnectionRow, "id" | "created_at" | "status"> & { status?: string }
): ConnectionRow {
  const info = db
    .prepare(
      `INSERT INTO connections (user_id, user_oobi, user_aid, platform_oobi, status)
       VALUES (@user_id, @user_oobi, @user_aid, @platform_oobi, @status)`
    )
    .run({ status: "connected", ...row });
  return db
    .prepare(`SELECT * FROM connections WHERE id = ?`)
    .get(info.lastInsertRowid) as ConnectionRow;
}

/** Forget all connections for a user (used by the disconnect / reset flow). */
export function deleteConnectionsForUser(userId: number): void {
  db.prepare(`DELETE FROM connections WHERE user_id = ?`).run(userId);
}

export function getLatestCredential(
  userId: number
): CredentialRow | undefined {
  return db
    .prepare(
      `SELECT * FROM credentials WHERE user_id = ? ORDER BY id DESC LIMIT 1`
    )
    .get(userId) as CredentialRow | undefined;
}

export function insertCredential(
  row: Omit<CredentialRow, "id" | "issued_at" | "status"> & { status?: string }
): CredentialRow {
  const info = db
    .prepare(
      `INSERT INTO credentials (user_id, connection_id, schema_said, cred_said, attributes, status)
       VALUES (@user_id, @connection_id, @schema_said, @cred_said, @attributes, @status)`
    )
    .run({ status: "issued", ...row });
  return db
    .prepare(`SELECT * FROM credentials WHERE id = ?`)
    .get(info.lastInsertRowid) as CredentialRow;
}

export default db;
