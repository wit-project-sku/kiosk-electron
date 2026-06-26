import type { CreateImageInput, EntityId, ImageAsset } from '@shared/types/domain';
import { BaseRepository } from './BaseRepository';
import type { Database } from '../Database';

interface ImageRow {
  id: number;
  customer_id: number | null;
  file_name: string;
  file_path: string;
  thumbnail_path: string | null;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

function toDomain(row: ImageRow): ImageAsset {
  return {
    id: row.id,
    customerId: row.customer_id,
    fileName: row.file_name,
    filePath: row.file_path,
    thumbnailPath: row.thumbnail_path,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

export class ImageRepository extends BaseRepository {
  constructor(db: Database) {
    super(db);
  }

  findById(id: EntityId): ImageAsset | null {
    const row = this.conn.prepare('SELECT * FROM images WHERE id = ?').get(id) as
      | ImageRow
      | undefined;
    return row ? toDomain(row) : null;
  }

  findManyByIds(ids: EntityId[]): ImageAsset[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.conn
      .prepare(`SELECT * FROM images WHERE id IN (${placeholders}) ORDER BY created_at DESC`)
      .all(...ids) as ImageRow[];
    return rows.map(toDomain);
  }

  /** List images for a customer, or all unassigned images when null. */
  listByCustomer(customerId: EntityId | null): ImageAsset[] {
    const rows = (
      customerId === null
        ? this.conn.prepare('SELECT * FROM images ORDER BY created_at DESC').all()
        : this.conn
            .prepare('SELECT * FROM images WHERE customer_id = ? ORDER BY created_at DESC')
            .all(customerId)
    ) as ImageRow[];
    return rows.map(toDomain);
  }

  create(input: CreateImageInput): ImageAsset {
    const now = new Date().toISOString();
    const result = this.conn
      .prepare(
        `INSERT INTO images
           (customer_id, file_name, file_path, thumbnail_path, mime_type, byte_size, width, height, created_at)
         VALUES
           (@customerId, @fileName, @filePath, @thumbnailPath, @mimeType, @byteSize, @width, @height, @now)`,
      )
      .run({ ...input, now });
    return this.findById(Number(result.lastInsertRowid))!;
  }

  delete(id: EntityId): ImageAsset | null {
    const existing = this.findById(id);
    if (!existing) return null;
    this.conn.prepare('DELETE FROM images WHERE id = ?').run(id);
    return existing;
  }
}
