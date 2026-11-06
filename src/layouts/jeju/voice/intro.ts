/**
 * Screen intros (L1) for the parts of a screen that change without a route
 * change — a tab, a step, a modal — and one-off cues for screens to speak.
 *
 * A screen that has such parts says which intro is current with
 * `useVoiceIntro`. That one call covers all three moments it is heard:
 *   - arriving on the screen: useJejuVoice's screen announcement (a parent
 *     effect, so it runs after this hook's layout effect) reads it instead of
 *     the route's default from lines.ts;
 *   - changing tab / step / modal: this hook speaks it;
 *   - key 1 (repeat): reads it again.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { KioskScreenId } from '@shared/types/kiosk';
import { useKioskStore } from '@renderer/store/kioskStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { screenKeys, sheetLine, toVoiceLang } from './lines';
import { dropQueued, Priority, say } from './speech';
import { useVoiceStore } from './voiceStore';

/** Set by the mounted screen part (useVoiceIntro). */
let partIntro: readonly string[] | null = null;
/** Set by the photo flow's stage (useJejuVoice watches photoStore). */
let photoIntro: readonly string[] | null = null;

export function setPhotoIntro(keys: readonly string[] | null): void {
  photoIntro = keys;
}

/** What the current screen's intro is right now, most specific first. */
export function currentIntro(screen: KioskScreenId, photoActive: boolean, kioskId: string): readonly string[] {
  if (partIntro) return partIntro;
  if (photoActive && photoIntro) return photoIntro;
  return screenKeys(screen, photoActive, kioskId);
}

const lang = () => toVoiceLang(useLanguageStore.getState().currentLanguage);
const kioskId = () => useKioskStore.getState().config.kioskId;

/**
 * Lines spoken as one sentence: each leads, so the next follows it. `follow`
 * waits for the line playing instead of cutting it.
 */
export function announceKeys(keys: readonly string[], follow = false): void {
  dropQueued(Priority.Screen);
  keys.forEach((key, i) => {
    const l = sheetLine(key, lang(), kioskId(), { priority: Priority.Screen });
    say(l && { ...l, lead: i < keys.length - 1, after: follow });
  });
}

/**
 * One sheet line now — state cues like a countdown number or "entered".
 * `after` lets the line wait for the current one rather than cut it.
 */
export function speakKey(key: string, priority: Priority = Priority.State, after = false): void {
  const l = sheetLine(key, lang(), kioskId(), { priority });
  say(l && { ...l, after });
}

/**
 * Declare the intro of the screen part now showing (null when the route's own
 * intro applies). Pass a stable list per state — it is compared by content.
 */
export function useVoiceIntro(keys: readonly string[] | null): void {
  const signature = keys?.join('|') ?? '';
  // The route this intro belongs to. A component kept mounted across a route
  // change (JejuScreen, from one 준비중 page to the next) must leave that
  // announcement to the screen change, or the intro is said twice.
  const route = useKioskStore((s) => s.screen);
  const last = useRef<{ signature: string; route: string } | null>(null);

  useLayoutEffect(() => {
    partIntro = signature ? signature.split('|') : null;
    const prev = last.current;
    last.current = { signature, route };
    // On mount, or with the route, the screen announcement speaks it.
    if (!prev || prev.route !== route) return;
    // Following, not cutting: a visitor's own press has already silenced the old
    // line (useJejuVoice stops on every input), so anything still playing means
    // this change came by itself — 한복 settling on the 제주 tab once its tabs
    // load would otherwise cut hanbok.select off after a syllable.
    if (partIntro && useVoiceStore.getState().on) announceKeys(partIntro, true);
  }, [signature, route]);

  useLayoutEffect(
    () => () => {
      partIntro = null;
    },
    [],
  );
}

/**
 * useVoiceIntro as an element, for a branch that cannot call a hook of its own —
 * one return among several in a component with early returns (PhotoWorkflow's
 * result pages). Renders nothing.
 *
 * Such a branch appears without a route change, so no screen announcement will
 * read it: it speaks for itself on mount.
 */
export function VoiceIntro({ keys }: { keys: readonly string[] }): null {
  useVoiceIntro(keys);
  useEffect(() => {
    if (useVoiceStore.getState().on) announceKeys(keys, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);
  return null;
}
