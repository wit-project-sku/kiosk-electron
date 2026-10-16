import type { UpdateChannel } from '@shared/types/update';

/**
 * Resolve the release channel for this kiosk from the `UPDATE_CHANNEL` env var
 * (loaded from the app's `.env` by `loadEnvFile`, or set as a real OS env var).
 *
 * Switching a kiosk between channels requires NO code change or rebuild — just
 * set `UPDATE_CHANNEL=beta` (testing), `UPDATE_CHANNEL=demo` (office showroom)
 * or `UPDATE_CHANNEL=latest` (production, the default) and restart. Anything
 * other than an explicit `beta`/`demo` resolves to `latest`, so a typo can never
 * accidentally put a production kiosk on another channel.
 */
export function resolveUpdateChannel(): UpdateChannel {
  const raw = (process.env['UPDATE_CHANNEL'] ?? '').trim().toLowerCase();
  if (raw === 'beta' || raw === 'demo') return raw;
  return 'latest';
}
