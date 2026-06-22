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
