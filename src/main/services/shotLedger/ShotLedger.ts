import { isDue, type ShotRow } from './plan';

/** Where shot rows live — SqliteShotLedger in the app, MemoryShotLedger in tests. */
export interface ShotLedger {
  get(eventId: string): ShotRow | null;
  /** Insert or replace the whole row. */
  save(row: ShotRow): void;
  /** Rows due at `now`: least-tried first (a row that keeps failing cannot starve the rest), then oldest. */
  due(now: number, limit: number): ShotRow[];
  /** Delete `sent` rows acknowledged before `before`; returns how many. */
  pruneSent(before: number): number;
  /** Rows the server has not acknowledged, by state. */
  unsent(): { open: number; pending: number; rejected: number };
  /** Append one line to the human-readable ledger. Never throws. */
  note(line: string): void;
  /** Drop text-ledger lines older than `before`. Never throws. */
  pruneNotes(now: number, keepMs: number): void;
}

/** In-memory ledger: unit tests, and the fallback when the ledger file cannot be opened. */
export class MemoryShotLedger implements ShotLedger {
  readonly rows = new Map<string, ShotRow>();
  readonly notes: string[] = [];

  get(eventId: string): ShotRow | null {
    return this.rows.get(eventId) ?? null;
  }

  save(row: ShotRow): void {
    this.rows.set(row.eventId, { ...row });
  }

  due(now: number, limit: number): ShotRow[] {
    return [...this.rows.values()]
      .filter((row) => isDue(row, now))
      .sort((a, b) => a.attempts - b.attempts || a.createdAt - b.createdAt)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }

  pruneSent(before: number): number {
    let removed = 0;
    for (const [id, row] of this.rows) {
      if (row.state === 'sent' && (row.sentAt ?? 0) < before) {
        this.rows.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  unsent(): { open: number; pending: number; rejected: number } {
    const count = { open: 0, pending: 0, rejected: 0 };
    for (const row of this.rows.values()) {
      if (row.state !== 'sent') count[row.state] += 1;
    }
    return count;
  }

  note(line: string): void {
    this.notes.push(line);
  }

  pruneNotes(): void {
    // Nothing to prune in memory.
  }
}
