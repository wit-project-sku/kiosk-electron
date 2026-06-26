import type { PhotoSession } from '@shared/types/photo';
import type { EntityId } from '@shared/types/domain';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';

interface PhotoSessionRow {
  id: number;
  session_id: string;
  clothing_key: string | null;
  style_key: string | null;
  result_image_path: string;
  drive_sync_state: string;
  drive_file_id: string | null;
  created_at: string;
}

function toDomain(row: PhotoSessionRow): PhotoSession {
  return {
    id: row.id,
    sessionId: row.session_id,
    clothingKey: row.clothing_key,
    styleKey: row.style_key,
    resultImagePath: row.result_image_path,
    driveSyncState:
      row.drive_sync_state === 'synced'
        ? 'synced'
        : row.drive_sync_state === 'failed'
          ? 'failed'
          : 'pending',
    driveFileId: row.drive_file_id,
    createdAt: row.created_at,
  };
}

export interface CreatePhotoSessionInput {
  sessionId: string;
  clothingKey: string | null;
  styleKey: string | null;
  resultImagePath: string;
}

export class PhotoSessionRepository extends BaseRepository {
  constructor(db: Database) {
    super(db);
  }

  create(input: CreatePhotoSessionInput): PhotoSession {
    const now = new Date().toISOString();
    const result = this.conn
      .prepare(
        `INSERT INTO photo_sessions
         (session_id, clothing_key, style_key, result_image_path, drive_sync_state, created_at)
         VALUES (@sessionId, @clothingKey, @styleKey, @resultImagePath, 'pending', @now)`,
      )
      .run({
        sessionId: input.sessionId,
        clothingKey: input.clothingKey,
        styleKey: input.styleKey,
        resultImagePath: input.resultImagePath,
        now,
      });
    return this.findById(Number(result.lastInsertRowid))!;
  }

  findById(id: EntityId): PhotoSession | null {
    const row = this.conn.prepare('SELECT * FROM photo_sessions WHERE id = ?').get(id) as
      | PhotoSessionRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  findBySessionId(sessionId: string): PhotoSession | null {
    const row = this.conn
      .prepare('SELECT * FROM photo_sessions WHERE session_id = ?')
      .get(sessionId) as PhotoSessionRow | undefined;
    return row ? toDomain(row) : null;
  }

  listPendingDriveSync(limit: number): PhotoSession[] {
    const rows = this.conn
      .prepare(
        `SELECT * FROM photo_sessions WHERE drive_sync_state = 'pending'
         ORDER BY created_at ASC LIMIT ?`,
      )
      .all(limit) as PhotoSessionRow[];
    return rows.map(toDomain);
  }

  markDriveSynced(id: EntityId, driveFileId: string): void {
    this.conn
      .prepare(
        `UPDATE photo_sessions SET drive_sync_state = 'synced', drive_file_id = @driveFileId WHERE id = @id`,
      )
      .run({ id, driveFileId });
  }

  markDriveFailed(id: EntityId): void {
    this.conn
      .prepare(`UPDATE photo_sessions SET drive_sync_state = 'failed' WHERE id = @id`)
      .run({ id });
  }
}
