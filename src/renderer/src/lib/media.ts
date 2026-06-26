import type { ImageAsset } from '@shared/types/domain';

/** Extract the stored file name (last path segment) from an absolute path. */
function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? '';
}

/** Build a `media://` URL for an asset's original file. */
export function assetUrl(asset: ImageAsset): string {
  return `media://asset/${encodeURIComponent(baseName(asset.filePath))}`;
}

/** Build a `media://` URL for an asset's thumbnail, falling back to original. */
export function thumbUrl(asset: ImageAsset): string {
  if (asset.thumbnailPath) {
    return `media://thumb/${encodeURIComponent(baseName(asset.thumbnailPath))}`;
  }
  return assetUrl(asset);
}

export function generatedUrl(fileName: string): string {
  return `media://generated/${encodeURIComponent(fileName)}`;
}

export function isVideo(asset: ImageAsset): boolean {
  return asset.mimeType.startsWith('video/');
}
