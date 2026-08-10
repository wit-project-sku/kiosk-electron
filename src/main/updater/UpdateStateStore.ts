import Store from 'electron-store';

/**
 * Tiny persistent store for the update scheduler, so the weekly maintenance
 * window survives app restarts (kiosks reboot nightly). Lives next to the other
 * electron-store data in userData (`update-state.json`).
 *
 * `lastWindowHandled` = epoch ms of the most recent weekly window whose check we
 * completed. On startup the scheduler compares it against the most recent past
 * window: if a window is newer than this, it was MISSED (kiosk was off) and we
 * check immediately as a catch-up, then record it here.
 *
 * `lastCommandHandled` = epoch ms of the most recent operator-initiated update
 * request (the admin-site button) that we already acted on. UpdateCommandService
 * only triggers when the server's timestamp is NEWER than this, which is what
 * makes the remote trigger idempotent and lets a kiosk that was powered off
 * catch up on its next poll. Both channels persist here so the two triggers stay
 * independent — handling one never masks the other.
 *
 * `pendingInstall` / `blockedVersion` = the install-verification pair, and the
 * only thing standing between the fleet and a restart LOOP. `quitAndInstall`
 * quits the app as soon as the installer process has been SPAWNED — it never
 * reports whether the installer actually replaced anything. If the silent NSIS
 * install then aborts (needs elevation for a per-machine install, files locked,
 * the app was launched from a copied folder the installer doesn't own), the
 * kiosk is left CLOSED and still on the old version, and the next check restarts
 * the whole cycle a few minutes later — forever.
 *
 * So: the version we are about to install is recorded BEFORE quitting, and the
 * next startup compares it against the version actually running. Same version =
 * the install worked, clear it. Different version = that attempt failed; after
 * {@link MAX_INSTALL_ATTEMPTS} failures the version is BLOCKED — the kiosk keeps
 * running and keeps reporting the error, but never quits for that version again.
 */
interface PendingInstall {
  /** The version whose installer we spawned. */
  version: string;
  /** How many times we have spawned an installer for it. */
  attempts: number;
  /** epoch ms of the most recent attempt (diagnostics only). */
  at: number;
}

interface UpdateStateShape {
  lastWindowHandled: number;
  lastCommandHandled: number;
  pendingInstall: PendingInstall | null;
  blockedVersion: string | null;
}

export type { PendingInstall };

export class UpdateStateStore {
  private readonly store = new Store<UpdateStateShape>({
    name: 'update-state',
    defaults: {
      lastWindowHandled: 0,
      lastCommandHandled: 0,
      pendingInstall: null,
      blockedVersion: null,
    },
  });

  getLastWindowHandled(): number {
    return this.store.get('lastWindowHandled', 0);
  }

  setLastWindowHandled(epochMs: number): void {
    this.store.set('lastWindowHandled', epochMs);
  }

  getLastCommandHandled(): number {
    return this.store.get('lastCommandHandled', 0);
  }

  setLastCommandHandled(epochMs: number): void {
    this.store.set('lastCommandHandled', epochMs);
  }

  getPendingInstall(): PendingInstall | null {
    return this.store.get('pendingInstall', null);
  }

  /** Record that an installer for `version` is about to be spawned. */
  recordInstallAttempt(version: string, now: number): PendingInstall {
    const previous = this.getPendingInstall();
    const attempts = previous && previous.version === version ? previous.attempts + 1 : 1;
    const pending: PendingInstall = { version, attempts, at: now };
    this.store.set('pendingInstall', pending);
    return pending;
  }

  clearPendingInstall(): void {
    this.store.set('pendingInstall', null);
  }

  getBlockedVersion(): string | null {
    return this.store.get('blockedVersion', null);
  }

  /** Stop auto-installing a version that repeatedly fails to apply. */
  setBlockedVersion(version: string | null): void {
    this.store.set('blockedVersion', version);
  }
}
