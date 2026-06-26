// Inspect the kiosk's SQLite databases without any native module.
// Uses Node's built-in node:sqlite (Node >= 22.5 / system Node v24).
//
// Usage:
//   node scripts/db-inspect.mjs                       # list tables + row counts (both DBs)
//   node scripts/db-inspect.mjs <table>               # dump rows of <table> from kiosk.db
//   node scripts/db-inspect.mjs <table> <limit>       # dump up to <limit> rows
//   node scripts/db-inspect.mjs outbox --payment      # dump from the payment outbox DB
//
// Read-only: safe to run while the kiosk app is open (WAL allows readers).

import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import process from 'node:process';

const userData = join(process.env.APPDATA ?? '', 'kiosk-app');
const KIOSK_DB = join(userData, 'data', 'kiosk.db');
const OUTBOX_DB = join(userData, 'payment-agent', 'outbox.sqlite');

const args = process.argv.slice(2);
const payment = args.includes('--payment');
const positional = args.filter((a) => !a.startsWith('--'));
const table = positional[0];
const limit = Number(positional[1] ?? 50);

function open(file) {
  return new DatabaseSync(file, { readOnly: true });
}

function listTables(file) {
  console.log(`\n==================== ${file} ====================`);
  try {
    const db = open(file);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all();
    for (const { name } of tables) {
      const n = db.prepare(`SELECT COUNT(*) c FROM "${name}"`).get().c;
      console.log(`  ${name.padEnd(28)} ${n} rows`);
    }
    db.close();
  } catch (e) {
    console.log('  ERROR:', e.message);
  }
}

function dump(file, name, max) {
  const db = open(file);
  const rows = db.prepare(`SELECT * FROM "${name}" LIMIT ?`).all(max);
  console.log(`\n${name} — showing ${rows.length} row(s):\n`);
  console.dir(rows, { depth: null, maxArrayLength: null });
  db.close();
}

if (!table) {
  listTables(KIOSK_DB);
  listTables(OUTBOX_DB);
  console.log('\nTip: `node scripts/db-inspect.mjs <table> [limit]` to dump rows.');
} else {
  dump(payment ? OUTBOX_DB : KIOSK_DB, table, limit);
}
