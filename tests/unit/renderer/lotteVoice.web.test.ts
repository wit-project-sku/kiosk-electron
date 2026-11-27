import { afterEach, describe, expect, it } from 'vitest';
import { VOICE_JEJU } from '@renderer/data/voice-jeju.generated';
import { VOICE_LOTTE } from '@renderer/data/voice-lotte.generated';
import { useKioskStore } from '@renderer/store/kioskStore';
import { screenKeys, sheetLine } from '@layouts/jeju/voice/lines';
import { Priority } from '@layouts/jeju/voice/speech';
import { LOTTE_KEY_ALIASES, LOTTE_SCREEN_INTROS } from '@layouts/lotte/lotteVoice';

const initial = useKioskStore.getState();

function asKiosk(kioskId: string, layout: string, translations: Record<string, Partial<Record<string, string>>> = {}): void {
  useKioskStore.setState({
    config: { ...initial.config, kioskId, layout } as typeof initial.config,
    translations: translations as typeof initial.translations,
  });
}

const say = (key: string, kioskId: string, lang: 'ko' | 'en' = 'ko'): string | undefined =>
  sheetLine(key, lang, kioskId, { priority: Priority.Screen })?.text;

afterEach(() => useKioskStore.setState(initial, true));

describe('롯데 voice guidance lines', () => {
  it('bundles the 롯데 sheet script', () => {
    expect(Object.keys(VOICE_LOTTE).length).toBeGreaterThan(80);
    expect(VOICE_LOTTE['global.voice.on']?.ko).toBeTruthy();
  });

  it("reads the site's own home row", () => {
    asKiosk('W013', 'LOTTE');
    expect(say('lotte.home', 'W013')).toContain('청량리점');
    asKiosk('W014', 'LOTTE');
    expect(say('lotte.home', 'W014')).toContain('건대스타시티점');
  });

  it('gives 롯데월드몰 its own 핫스팟 line and the stores the shared one', () => {
    asKiosk('W012', 'LOTTE');
    expect(say('lotte.building.hotspot', 'W012')).toContain('롯데월드타워');
    asKiosk('W013', 'LOTTE');
    expect(say('lotte.building.hotspot', 'W013')).not.toContain('롯데월드타워');
  });

  it("speaks 롯데's line for the shared photo flow's 제주 keys", () => {
    asKiosk('W012', 'LOTTE');
    expect(say('hanbok.capture', 'W012')).toBe(VOICE_LOTTE['lotte.photo.capture']?.ko);
    expect(say('hanbok.result@W008', 'W012')).toBe(VOICE_LOTTE['lotte.photo.result']?.ko);
  });

  it('has a sheet row for every screen intro and alias', () => {
    asKiosk('W013', 'LOTTE');
    const keys = [...Object.values(LOTTE_SCREEN_INTROS), ...Object.values(LOTTE_KEY_ALIASES)];
    for (const key of keys.filter((k): k is string => !!k)) {
      expect(say(key, 'W013'), key).toBeTruthy();
    }
  });

  it('routes 롯데 screens to 롯데 intros', () => {
    asKiosk('W012', 'LOTTE');
    expect(screenKeys('cinema', false, 'W012')).toEqual(['lotte.cinema.schedule']);
    expect(screenKeys('market', false, 'W012')).toEqual(['lotte.witstore', 'global.web.exit']);
  });

  it('prefers the copy synced at launch over the bundled one', () => {
    asKiosk('W012', 'LOTTE', { 'Voice_lotte.language': { ko: '새 문구' } });
    expect(say('lotte.language', 'W012')).toBe('새 문구');
  });

  it('leaves 제주 on its own script', () => {
    asKiosk('W008', 'JEJU_AIRPORT');
    expect(say('hanbok.capture', 'W008')).toBe(VOICE_JEJU['hanbok.capture']?.ko);
    expect(say('lotte.home', 'W008')).toBeUndefined();
    expect(screenKeys('home', false, 'W008')).toEqual(['jeju.home']);
  });
});
