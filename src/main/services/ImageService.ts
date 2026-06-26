import { copyFile, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EntityId, ImageAsset } from '@shared/types/domain';
import { SUPPORTED_IMAGE_EXT, SUPPORTED_VIDEO_EXT } from '@shared/constants';
import { AppError } from '@main/core/AppError';
import { appPaths } from '@main/core/paths';
import { createLogger } from '@main/core/logger';
import type { ImageRepository } from '@main/database/repositories/ImageRepository';
import type { SyncService } from './sync/SyncService';
import type { AnalyticsService } from './AnalyticsService';

const log = createLogger('image-service');

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const ALLOWED_EXT = new Set<string>([...SUPPORTED_IMAGE_EXT, ...SUPPORTED_VIDEO_EXT]);

/**
 * Manages media assets: copies originals into the app's media library, persists
 * metadata, and cleans up files on delete. Designed for thousands of assets —
 * files live on disk (not in SQLite) and the DB stores only lightweight rows.
 *
 * Thumbnail generation is intentionally pluggable: the import path records a
 * thumbnail slot so an optional encoder (e.g. sharp) can be added later without
 * touching the schema or callers.
 */
export class ImageService {
  constructor(
    private readonly repo: ImageRepository,
    private readonly sync: SyncService,
    private readonly analytics: AnalyticsService,
  ) {}

  list(customerId: EntityId | null): ImageAsset[] {
    return this.repo.listByCustomer(customerId);
  }

  findManyByIds(ids: EntityId[]): ImageAsset[] {
    return this.repo.findManyByIds(ids);
  }

  async importMany(customerId: EntityId | null, sourcePaths: string[]): Promise<ImageAsset[]> {
    const imported: ImageAsset[] = [];
    for (const source of sourcePaths) {
      imported.push(await this.importOne(customerId, source));
    }
    return imported;
  }

  private async importOne(customerId: EntityId | null, source: string): Promise<ImageAsset> {
    const ext = extname(source).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      throw AppError.validation(`Unsupported file type: ${ext || 'unknown'}`);
    }

    let fileStat: Awaited<ReturnType<typeof stat>>;
    try {
      fileStat = await stat(source);
    } catch {
      throw AppError.filesystem(`Source file is not accessible: ${source}`);
    }

    // Content-addressable-ish unique name avoids collisions in the library.
    const storedName = `${randomUUID()}${ext}`;
    const destPath = join(appPaths.media, storedName);

    try {
      await copyFile(source, destPath);
    } catch (error) {
      log.error('Failed to copy media into library', error);
      throw AppError.filesystem('Could not copy the file into the media library.');
    }

    const asset = this.repo.create({
      customerId,
      fileName: basename(source),
      filePath: destPath,
      thumbnailPath: null,
      mimeType: MIME_BY_EXT[ext] ?? 'application/octet-stream',
      byteSize: fileStat.size,
      width: null,
      height: null,
    });

    this.sync.enqueue('upload_image', { id: asset.id });
    this.analytics.track({ name: 'photo_taken', customerId, payload: { source: 'import' } });
    log.info('Imported media asset', { id: asset.id, name: asset.fileName });
    return asset;
  }

  /** Persist a camera capture supplied as a base64 data URL. */
  async saveCapture(
    customerId: EntityId | null,
    dataUrl: string,
    fileName: string,
  ): Promise<ImageAsset> {
    const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
    if (!match) {
      throw AppError.validation('Invalid capture data.');
    }
    const mimeType = match[1]!;
    const buffer = Buffer.from(match[2]!, 'base64');

    const ext = mimeType === 'image/png' ? '.png' : '.jpg';
    const storedName = `${randomUUID()}${ext}`;
    const destPath = join(appPaths.media, storedName);

    try {
      await writeFile(destPath, buffer);
    } catch (error) {
      log.error('Failed to write capture', error);
      throw AppError.filesystem('Could not save the captured image.');
    }

    const asset = this.repo.create({
      customerId,
      fileName,
      filePath: destPath,
      thumbnailPath: null,
      mimeType,
      byteSize: buffer.byteLength,
      width: null,
      height: null,
    });

    this.sync.enqueue('upload_image', { id: asset.id });
    this.analytics.track({ name: 'photo_taken', customerId, payload: { source: 'camera' } });
    log.info('Saved camera capture', { id: asset.id });
    return asset;
  }

  async delete(id: EntityId): Promise<EntityId> {
    const removed = this.repo.delete(id);
    if (!removed) throw AppError.notFound(`Image ${id} was not found.`);

    // Best-effort filesystem cleanup; DB row is already gone.
    await this.safeUnlink(removed.filePath);
    if (removed.thumbnailPath) await this.safeUnlink(removed.thumbnailPath);

    this.analytics.track({
      name: 'photo_deleted',
      customerId: removed.customerId,
      payload: { id },
    });
    log.info('Deleted media asset', { id });
    return id;
  }

  private async safeUnlink(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch (error) {
      log.warn('Failed to remove media file (ignored)', { path, error: String(error) });
    }
  }
}
