import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { VIDEO_SETS, type VideoFilesBySet, type VideoSet } from '@shared/types/subtitle';
import { appPaths } from '@main/core/paths';
import { createLogger } from '@main/core/logger';
import { handle } from '../registry';

const log = createLogger('video-handlers');

const SETS: readonly VideoSet[] = VIDEO_SETS;

/**
 * The actual .mp4 files present in each resources/videos/<set>/ folder, read
 * fresh from disk on every call. This is the SINGLE source of truth for which
 * videos exist — there is no build-time manifest — so dropping a new file into
 * the folder (and referencing it from the subtitles API) makes it resolve
 * immediately, no rebuild required.
 */
function listVideoFiles(): VideoFilesBySet {
  const out = Object.fromEntries(SETS.map((s) => [s, [] as string[]])) as VideoFilesBySet;
  for (const set of SETS) {
    const dir = join(appPaths.videos, set);
    if (!existsSync(dir)) continue;
    try {
      out[set] = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp4'));
    } catch (error) {
      log.warn('Could not list video set', { set, dir, error: String(error) });
    }
  }
  log.info('Listed video files', Object.fromEntries(SETS.map((s) => [s, out[s].length])));
  return out;
}

export function registerVideoHandlers(_container: AppContainer): void {
  handle(IpcChannels.VideosList, () => listVideoFiles());
}
