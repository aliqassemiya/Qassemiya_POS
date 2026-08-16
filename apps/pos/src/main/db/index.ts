import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { Kysely, SqliteDialect, CamelCasePlugin } from "kysely";
import { app } from "electron";
import type { Database } from "./schema";
import { runMigrations } from "./migrate";

let db: Kysely<Database> | null = null;
let sqlite: BetterSqlite3.Database | null = null;

export function getDbPath(): string {
  return path.join(app.getPath("userData"), "qassemiya-pos.sqlite");
}

/** Opens (creating if needed) the local SQLite database and applies pending migrations. */
export function initDb(): Kysely<Database> {
  if (db) return db;

  const dbPath = getDbPath();
  sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  runMigrations(sqlite);

  db = new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqlite }),
    plugins: [new CamelCasePlugin()],
  });

  return db;
}

export function getDb(): Kysely<Database> {
  if (!db) throw new Error("Database not initialized — call initDb() first");
  return db;
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
    sqlite = null;
  }
}
