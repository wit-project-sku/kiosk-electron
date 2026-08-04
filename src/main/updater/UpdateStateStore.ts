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
 */
interface UpdateStateShape {
  lastWindowHandled: number;
  lastCommandHandled: number;
}

export class UpdateStateStore {
  private readonly store = new Store<UpdateStateShape>({
    name: 'update-state',
    defaults: { lastWindowHandled: 0, lastCommandHandled: 0 },
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
}
