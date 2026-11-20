export function sqliteFiles() {
  return {
    "src/infrastructure/database.js":
      "import { DatabaseSync } from 'node:sqlite';\nimport fs from 'node:fs';\nimport path from 'node:path';\nexport function openDatabase(file = process.env.DATABASE_PATH ?? 'data/app.sqlite') { if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true }); const db = new DatabaseSync(file); db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;'); return db; }\n",
    "migrations/001_initial.sql":
      "CREATE TABLE IF NOT EXISTS app_events (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\n",
    "scripts/migrate.js":
      "import fs from 'node:fs/promises';\nimport crypto from 'node:crypto';\nimport { openDatabase } from '../src/infrastructure/database.js';\nconst db = openDatabase();\ntry { db.exec('BEGIN IMMEDIATE'); db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)'); for (const name of (await fs.readdir('migrations')).filter(f => f.endsWith('.sql')).sort()) { const sql = await fs.readFile('migrations/' + name, 'utf8'); const checksum = crypto.createHash('sha256').update(sql).digest('hex'); const previous = db.prepare('SELECT checksum FROM schema_migrations WHERE name = ?').get(name); if (previous) { if (previous.checksum !== checksum) throw new Error('Previously applied migration changed: ' + name); continue; } db.exec(sql); db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(name, checksum); } db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; } finally { db.close(); }\n",
    "tests/database.test.js":
      "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { openDatabase } from '../src/infrastructure/database.js';\ntest('SQLite transactions rollback failed writes', () => { const db = openDatabase(':memory:'); try { db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY); BEGIN'); db.prepare('INSERT INTO items VALUES (?)').run(1); db.exec('ROLLBACK'); assert.equal(db.prepare('SELECT COUNT(*) AS total FROM items').get().total, 0); } finally { db.close(); } });\n",
  };
}
