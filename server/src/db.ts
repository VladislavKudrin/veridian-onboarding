import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { config } from "./config";

export type Role = "issuer" | "holder";

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  email: string;
  role: Role;
  password_hash: string;
  created_at: string;
}

export interface RequestRow {
  id: number;
  user_id: number;
  schema_said: string;
  attributes: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  cred_said: string | null;
  reason: string | null;
  created_at: string;
  decided_at: string | null;
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

  CREATE TABLE IF NOT EXISTS credential_requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    schema_said TEXT NOT NULL,
    attributes  TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    cred_said   TEXT,
    reason      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at  TEXT
  );
`);

// Lightweight migration for DBs created before roles/passwords existed.
function addColumnIfMissing(table: string, column: string, def: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}
addColumnIfMissing("users", "role", "TEXT NOT NULL DEFAULT 'holder'");
addColumnIfMissing("users", "password_hash", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("schemas", "login_enabled", "INTEGER NOT NULL DEFAULT 0");

export interface SchemaRow {
  said: string;
  title: string;
  credential_type: string;
  definition: string;
  source: string;
  login_enabled: number;
  created_at: string;
}

/** Toggle whether a schema is accepted for "log in with credential". */
export function setSchemaLoginEnabled(said: string, enabled: boolean): void {
  db.prepare(`UPDATE schemas SET login_enabled = ? WHERE said = ?`).run(
    enabled ? 1 : 0,
    said
  );
}

/** SAIDs of schemas the issuer accepts as login credentials. */
export function loginEnabledSaids(): string[] {
  return (
    db
      .prepare(`SELECT said FROM schemas WHERE login_enabled = 1`)
      .all() as { said: string }[]
  ).map((r) => r.said);
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
  row: Omit<SchemaRow, "created_at" | "login_enabled">
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

/** Seed the issuer/admin account if it does not exist. */
export function seedAdmin(): UserRow {
  const hash = bcrypt.hashSync(config.admin.password, 10);
  const existing = getUserByUsername(config.admin.username);
  if (existing) {
    // Ensure the issuer role + a password (covers DBs migrated from v1).
    db.prepare(`UPDATE users SET role = 'issuer', password_hash = ? WHERE id = ?`).run(
      existing.password_hash || hash,
      existing.id
    );
    return getUserByUsername(config.admin.username)!;
  }

  db.prepare(
    `INSERT INTO users (username, display_name, email, role, password_hash)
     VALUES (?, ?, ?, 'issuer', ?)`
  ).run(config.admin.username, "Issuer", "issuer@veridian-poc.test", hash);

  return getUserByUsername(config.admin.username)!;
}

/** Create a self-registered holder account. */
export function createUser(input: {
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  role?: Role;
}): UserRow {
  const info = db
    .prepare(
      `INSERT INTO users (username, display_name, email, role, password_hash)
       VALUES (@username, @display_name, @email, @role, @password_hash)`
    )
    .run({
      username: input.username,
      display_name: input.displayName,
      email: input.email,
      role: input.role ?? "holder",
      password_hash: input.passwordHash,
    });
  return getUserById(Number(info.lastInsertRowid))!;
}

/** All registered holders. */
export function listHolders(): UserRow[] {
  return db
    .prepare(`SELECT * FROM users WHERE role = 'holder' ORDER BY id`)
    .all() as UserRow[];
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

/**
 * Forget a user's connections (disconnect / start over). Credentials reference
 * connections via a foreign key, so clear them first (the credential lives on
 * in the wallet regardless — this only resets our records).
 */
export function deleteConnectionsForUser(userId: number): void {
  const reset = db.transaction((uid: number) => {
    db.prepare(`DELETE FROM credentials WHERE user_id = ?`).run(uid);
    db.prepare(`DELETE FROM connections WHERE user_id = ?`).run(uid);
  });
  reset(userId);
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

export function listCredentials(userId: number): CredentialRow[] {
  return db
    .prepare(`SELECT * FROM credentials WHERE user_id = ? ORDER BY id DESC`)
    .all(userId) as CredentialRow[];
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

// ── Credential requests (holder applies → issuer accepts/declines) ───────────

export function createRequest(input: {
  user_id: number;
  schema_said: string;
  attributes: string;
}): RequestRow {
  const info = db
    .prepare(
      `INSERT INTO credential_requests (user_id, schema_said, attributes)
       VALUES (@user_id, @schema_said, @attributes)`
    )
    .run(input);
  return getRequest(Number(info.lastInsertRowid))!;
}

export function getRequest(id: number): RequestRow | undefined {
  return db
    .prepare(`SELECT * FROM credential_requests WHERE id = ?`)
    .get(id) as RequestRow | undefined;
}

export function listRequestsForUser(userId: number): RequestRow[] {
  return db
    .prepare(
      `SELECT * FROM credential_requests WHERE user_id = ? ORDER BY id DESC`
    )
    .all(userId) as RequestRow[];
}

export function listAllRequests(): RequestRow[] {
  return db
    .prepare(`SELECT * FROM credential_requests ORDER BY id DESC`)
    .all() as RequestRow[];
}

export function setRequestAccepted(id: number, credSaid: string): void {
  db.prepare(
    `UPDATE credential_requests
     SET status = 'accepted', cred_said = ?, decided_at = datetime('now')
     WHERE id = ?`
  ).run(credSaid, id);
}

export function setRequestDeclined(id: number, reason: string): void {
  db.prepare(
    `UPDATE credential_requests
     SET status = 'declined', reason = ?, decided_at = datetime('now')
     WHERE id = ?`
  ).run(reason, id);
}

/** Mark an accepted request's credential as revoked (TEL + our records). */
export function setRequestRevoked(id: number): void {
  const r = getRequest(id);
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE credential_requests SET status = 'revoked', decided_at = datetime('now') WHERE id = ?`
    ).run(id);
    if (r?.cred_said) {
      db.prepare(`UPDATE credentials SET status = 'revoked' WHERE cred_said = ?`).run(
        r.cred_said
      );
    }
  });
  tx();
}

export default db;
