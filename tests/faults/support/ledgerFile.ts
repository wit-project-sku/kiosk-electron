// Reads and edits the app's shot-ledger.db from the test process with Node's own SQLite
// (node:sqlite), so it does not need better-sqlite3 built for Node as well as Electron.
// Edits happen only while the app is closed — they stand in for time passing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface LedgerRow {
  eventId: string;
  outfitCode: string;
  state: 'open' | 'pending' | 'rejected' | 'sent';
  isSuccess: boolean | null;
  v1Sent: boolean;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: number;
  createdAt: number;
  photoPath: string | null;
}

const dbPath = (userData: string): string => join(userData, 'logs', 'shot-ledger.db');

export function readLedger(userData: string): LedgerRow[] {
  if (!existsSync(dbPath(userData))) return [];
  // The app may be mid-write; wait for its lock as the app itself does (busy_timeout).
  const db = new DatabaseSync(dbPath(userData), { readOnly: true, timeout: 5_000 });
  try {
    const rows = db.prepare('SELECT * FROM shots ORDER BY created_at').all() as Record<
      string,
      unknown
    >[];
    return rows.map((r) => ({
      eventId: String(r['event_id']),
      outfitCode: String(r['outfit_code']),
      state: r['state'] as LedgerRow['state'],
      isSuccess: r['is_success'] === null ? null : Number(r['is_success']) === 1,
      v1Sent: Number(r['v1_sent']) === 1,
      attempts: Number(r['attempts']),
      lastError: (r['last_error'] as string | null) ?? null,
      nextAttemptAt: Number(r['next_attempt_at']),
      createdAt: Number(r['created_at']),
      photoPath: (r['photo_path'] as string | null) ?? null,
    }));
  } finally {
    db.close();
  }
}

/** Move a row's clock back by `ms` — as if that much time had passed with the app off. */
export function ageLedger(userData: string, ms: number, where: 'open' | 'rejected'): number {
  const db = new DatabaseSync(dbPath(userData), { timeout: 5_000 });
  try {
    const sql =
      where === 'open'
        ? 'UPDATE shots SET created_at = created_at - ? WHERE state = ?'
        : 'UPDATE shots SET next_attempt_at = next_attempt_at - ? WHERE state = ?';
    return Number(db.prepare(sql).run(ms, where).changes);
  } finally {
    db.close();
  }
}

export function ledgerText(userData: string): string[] {
  const path = join(userData, 'logs', 'shot-ledger.txt');
  return existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean) : [];
}
