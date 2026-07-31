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
 */
interface UpdateStateShape {
  lastWindowHandled: number;
}

export class UpdateStateStore {
  private readonly store = new Store<UpdateStateShape>({
    name: 'update-state',
    defaults: { lastWindowHandled: 0 },
  });

  getLastWindowHandled(): number {
    return this.store.get('lastWindowHandled', 0);
  }

  setLastWindowHandled(epochMs: number): void {
    this.store.set('lastWindowHandled', epochMs);
  }
}
