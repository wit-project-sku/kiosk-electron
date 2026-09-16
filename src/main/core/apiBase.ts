/**
 * The ONE place the witteria API base is resolved from the environment.
 *
 * `WITTERIA_API_BASE` is a MAIN-process env var read at runtime (not a build-time
 * `VITE_*`), so pointing a machine at stage is an .env edit plus a restart — no
 * rebuild. Setting it to `https://api-stage-v3.witteria.com` moves every witteria
 * call on that kiosk together, which is the point: one switch, not one per
 * feature.
 *
 * The individual services under main/services each still inline this same
 * expression (`process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE`). They
 * predate this module and behave identically; migrating them is a tidy-up worth
 * doing on its own, not smuggled into a feature branch. New code should use this.
 */
import { DEFAULT_WITTERIA_API_BASE } from '@shared/constants';

/** Base URL with any trailing slashes removed, e.g. `https://api-v3.witteria.com`. */
export function witteriaApiBase(): string {
  return (process.env['WITTERIA_API_BASE'] || DEFAULT_WITTERIA_API_BASE).replace(/\/+$/, '');
}

/**
 * Just the origin of {@link witteriaApiBase}, for the CSP's `connect-src`.
 * Falls back to the raw default if the env var is not a parseable URL — a typo
 * there should not take the whole CSP down with it.
 */
export function witteriaApiOrigin(): string {
  try {
    return new URL(witteriaApiBase()).origin;
  } catch {
    return DEFAULT_WITTERIA_API_BASE;
  }
}
