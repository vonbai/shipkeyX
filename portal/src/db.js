import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function initDb(dbPath) {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS runbooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      host TEXT NOT NULL DEFAULT '',
      port INTEGER,
      urls TEXT NOT NULL DEFAULT '',
      commands TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS secret_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      reference_uri TEXT NOT NULL,
      masked_preview TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      scope TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS runbooks_updated_at
    AFTER UPDATE ON runbooks
    FOR EACH ROW
    BEGIN
      UPDATE runbooks SET updated_at = datetime('now') WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS secret_refs_updated_at
    AFTER UPDATE ON secret_refs
    FOR EACH ROW
    BEGIN
      UPDATE secret_refs SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
  `);

  return db;
}

export async function getSetting(db, key) {
  const row = await db.get("SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setSetting(db, key, value) {
  await db.run(
    `
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
    `,
    [key, value]
  );
}
