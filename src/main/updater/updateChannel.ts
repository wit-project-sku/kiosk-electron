import type { UpdateChannel } from '@shared/types/update';

/** Every non-production channel. Each is a GitHub PRE-release with its own
 *  `<channel>.yml` metadata file and its own side-by-side install identity. */
const PRERELEASE_CHANNELS = ['beta', 'lab'] as const;

/**
 * Resolve the release channel for this kiosk from the `UPDATE_CHANNEL` env var
 * (loaded from the app's `.env` by `loadEnvFile`, or set as a real OS env var).
 *
 * Switching a kiosk between channels requires NO code change or rebuild — just
 * set `UPDATE_CHANNEL=beta` (testing), `UPDATE_CHANNEL=lab` (experimental) or
 * `UPDATE_CHANNEL=latest` (production, the default) and restart. Anything not
 * matching a known pre-release channel resolves to `latest`, so a typo can never
 * accidentally put a production kiosk on a test feed.
 */
export function resolveUpdateChannel(): UpdateChannel {
  const raw = (process.env['UPDATE_CHANNEL'] ?? '').trim().toLowerCase();
  return (PRERELEASE_CHANNELS as readonly string[]).includes(raw) ? (raw as UpdateChannel) : 'latest';
}

/**
 * True for every channel that is published as a GitHub pre-release.
 *
 * ★ Drives `autoUpdater.allowPrerelease`, and it must be derived rather than
 * written as `channel === 'beta'`: a `lab` kiosk with `allowPrerelease=false`
 * would fall through to `/releases/latest` — which excludes pre-releases — and
 * quietly install PRODUCTION.
 */
export const isPrereleaseChannel = (channel: UpdateChannel): boolean => channel !== 'latest';
