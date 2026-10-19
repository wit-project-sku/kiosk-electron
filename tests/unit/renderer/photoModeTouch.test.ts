import { describe, expect, it } from 'vitest';
// Renderer module with no DOM/window use — imported relatively because unit tests are
// type-checked under tsconfig.node.json, which has no @renderer alias.
import { photoModeTouch, resolveButton } from '../../../src/renderer/src/lib/buttonCatalog';

const AT = '2026-10-19T14:00:00+09:00';

describe('photoModeTouch — 혼자찍기 / 같이찍기 tap counts', () => {
  it.each([
    ['W001', 116, 117],
    ['W002', 118, 119],
    ['W003', 120, 121],
    ['W004', 122, 123],
    ['W005', 124, 125],
    // 제주: ids fixed by the admin-be migration so stage and production agree.
    ['W006', 301, 302],
    ['W007', 303, 304],
    ['W008', 305, 306],
  ])('%s → solo %i, together %i', (kioskId, solo, together) => {
    expect(photoModeTouch(kioskId, 'solo', AT)).toEqual({
      buttonId: solo,
      buttonType: '혼자찍기',
      touchedAt: AT,
      backToHomeAt: AT,
    });
    expect(photoModeTouch(kioskId, 'together', AT)).toEqual({
      buttonId: together,
      buttonType: '같이찍기',
      touchedAt: AT,
      backToHomeAt: AT,
    });
  });

  it('records a zero-length session — only the count matters', () => {
    const touch = photoModeTouch('W004', 'solo', AT);
    expect(touch?.touchedAt).toBe(touch?.backToHomeAt);
  });

  it('sends nothing for KADA (no row) or an unknown kiosk', () => {
    expect(photoModeTouch('W202', 'solo', AT)).toBeNull();
    expect(photoModeTouch('W202', 'together', AT)).toBeNull();
    expect(photoModeTouch('W999', 'solo', AT)).toBeNull();
  });

  it('leaves the other 제주 slots resolving from the live list (no static id)', () => {
    expect(resolveButton('W006', 'home')?.id).toBeNull();
    expect(resolveButton('W007', 'photo')?.id).toBeNull();
    expect(resolveButton('W008', 'restroom')?.id).toBeNull();
  });
});
