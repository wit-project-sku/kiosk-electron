import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import {
  LEGACY_VIDEO_SETS,
  VIDEO_FOLDERS,
  VIDEO_SETS,
  type VideoFilesBySet,
  type VideoFolder,
} from '@shared/types/subtitle';
import { appPaths } from '@main/core/paths';
import { createLogger } from '@main/core/logger';
import { handle } from '../registry';

const log = createLogger('video-handlers');

/** Every folder listed — the live sets plus the legacy ones still read. */
const FOLDERS: readonly VideoFolder[] = VIDEO_FOLDERS;
/** Only live sets are CREATED; a legacy folder is read if present, never made. */
const CREATE: ReadonlySet<string> = new Set(VIDEO_SETS);

/**
 * The actual .mp4 files present in each <videos root>/<set>/ folder, read fresh
 * from disk on every call. This is the SINGLE source of truth for which videos
 * exist — there is no build-time manifest — so dropping a new file into the
 * folder (and referencing it from the subtitles data) makes it resolve
 * immediately, no rebuild required.
 *
 * Every set's folder is CREATED if missing. Videos are not shipped in the
 * installer (see appPaths.videos), so on a freshly-installed kiosk the root is
 * bare and whoever loads the footage has to know both the path and the exact
 * folder name — `jeju-airport` vs `jeju-terminal` is precisely the kind of
 * detail that gets guessed wrong once and then debugged as "the videos don't
 * play". Creating the empty tree on first launch turns that into a copy-paste.
 */
function listVideoFiles(): VideoFilesBySet {
  const out = Object.fromEntries(FOLDERS.map((s) => [s, [] as string[]])) as VideoFilesBySet;
  for (const set of FOLDERS) {
    const dir = join(appPaths.videos, set);
    try {
      // Legacy folders are read where they exist but never created — making one
      // would advertise a layout we are trying to retire.
      if (CREATE.has(set)) mkdirSync(dir, { recursive: true });
      else if (!existsSync(dir)) continue;
      out[set] = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp4'));
    } catch (error) {
      log.warn('Could not list video set', { set, dir, error: String(error) });
    }
  }
  const counts = Object.fromEntries(FOLDERS.map((s) => [s, out[s].length]));
  log.info('Listed video files', counts);
  for (const legacy of LEGACY_VIDEO_SETS) {
    if (out[legacy].length > 0) {
      log.warn(
        `Videos found in the legacy "${legacy}" folder. They still play (folded into ` +
          `the 제주 sets), but move them into jeju-airport / jeju-terminal / jeju-heritage ` +
          `so each venue plays its own footage.`,
        { dir: join(appPaths.videos, legacy), count: out[legacy].length },
      );
    }
  }
  return out;
}

export function registerVideoHandlers(_container: AppContainer): void {
  handle(IpcChannels.VideosList, () => listVideoFiles());
}
