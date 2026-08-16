import type BetterSqlite3 from "better-sqlite3";
import migration0001Init from "./migrations/0001_init.sql?raw";
import migration0002ProductImage from "./migrations/0002_product_image.sql?raw";
import migration0003ReturnRefundMethod from "./migrations/0003_return_refund_method.sql?raw";

/**
 * Hand-written SQL migrations, applied in order and tracked in a
 * `_migrations` table so re-launching the app is a no-op once caught up.
 * Bundled at build time via Vite's `?raw` import (no runtime file I/O needed
 * to locate migration files inside the packaged app).
 */
const MIGRATIONS: Array<{ name: string; sql: string }> = [
  { name: "0001_init", sql: migration0001Init },
  { name: "0002_product_image", sql: migration0002ProductImage },
  { name: "0003_return_refund_method", sql: migration0003ReturnRefundMethod },
];

export function runMigrations(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);

  const applied = new Set(
    sqlite.prepare<[], { name: string }>(`SELECT name FROM _migrations`).all().map((row) => row.name),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    const runMigration = sqlite.transaction(() => {
      sqlite.exec(migration.sql);
      sqlite
        .prepare(`INSERT INTO _migrations (name, applied_at) VALUES (?, ?)`)
        .run(migration.name, new Date().toISOString());
    });
    runMigration();
    // eslint-disable-next-line no-console
    console.log(`[db] applied migration ${migration.name}`);
  }
}
