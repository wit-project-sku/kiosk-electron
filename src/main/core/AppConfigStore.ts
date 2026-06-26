/**
 * Application settings persistence backed by electron-store.
 *
 * Per the data architecture rule, lightweight application settings live in
 * electron-store (a small, atomic JSON file) rather than SQLite. SQLite remains
 * the source of truth for all domain/business data (customers, analytics,
 * sessions, reports, templates, sync queue).
 *
 * electron-store writes atomically and validates against defaults, so settings
 * survive crashes and never end up half-written.
 */

import Store from 'electron-store';
import type { AppSettings } from '@shared/types/domain';
import { DEFAULT_SETTINGS } from '@shared/constants';

let store: Store<AppSettings> | null = null;

function getStore(): Store<AppSettings> {
  if (!store) {
    store = new Store<AppSettings>({
      name: 'settings',
      defaults: DEFAULT_SETTINGS,
      // Merge unknown/missing keys with defaults on read for forward-compat.
      clearInvalidConfig: true,
    });
  }
  return store;
}

export const appConfig = {
  getAll(): AppSettings {
    // Spread over defaults so newly-added settings always have a value.
    return { ...DEFAULT_SETTINGS, ...getStore().store };
  },

  update(changes: Partial<AppSettings>): AppSettings {
    const s = getStore();
    for (const [key, value] of Object.entries(changes)) {
      s.set(key, value as never);
    }
    return this.getAll();
  },
};
