/**
 * 제주 voice guidance — the barrier-free keypad's spoken half.
 *
 * Off by default. While off it says nothing at all; the first keypad press of a
 * visit turns it on (that press is spent on it, so the visitor hears what the
 * pad does before anything moves — except a digit typed into an open keyboard,
 * which must not be lost). Key 3 turns it off for the rest of the visit: the
 * other keys then just work, and key 3 turns it back on. The idle reset says
 * goodbye and turns it off, alongside the language and ♿ resets.
 *
 * What it says, by layer (see speech.ts for how they share one voice):
 *   L1  the screen's intro, once per screen change and per tab / step — intro.ts
 *   L2  the element the keypad ring lands on — useJejuKeypad's focus event
 *   L3  state: voice on/off, language, ♿, going home/back, idle warning
 *
 * Keys, only while no on-screen keyboard is open (then digits type, as before):
 *   1 repeat the screen intro and the focused element · 2 read the long text
 *   3 voice on/off · 7 / 8 volume down / up · 9 how the keys work
 *
 * Mounted next to useJejuKeypad by JejuKiosk, and its keydown runs in the
 * CAPTURE phase so it can claim a key before the pad acts on it — the contract
 * described at useJejuKeypad's onKeyDown.
 *
 * The AR 한복 flow is voiced from photoStore alone (usePhotoVoice below) — its
 * phase, gesture gate, countdown and error — so the flow's own code, where the
 * timers and locks live, is not touched. Screens with tabs, steps or modals
 * declare their current intro with intro.ts's useVoiceIntro.
 *
 * Not covered yet: the 🔊 rail button (waiting on design) and earphone plug
 * detection (depends on the kiosk PC's sound driver).
 */
import { useEffect, useRef } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { IDLE_TIMEOUT_MS } from '@renderer/hooks/useKioskController';
import { useInactivityReset } from '@renderer/hooks/useInactivityReset';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { usePhotoStore } from '@renderer/store/photoStore';
import { BACK_SELECTOR, FOCUS_EVENT, HOME_SELECTOR } from '../keypad/useJejuKeypad';
import { announceKeys, currentIntro, setPhotoIntro, speakKey } from './intro';
import { focusLine, sheetLine, toVoiceLang } from './lines';
import { Priority, say, stop, canSpeak, listVoices, type Line } from './speech';
import { useVoiceStore } from './voiceStore';

/** Spoken this long before the idle reset — the spec's 2m30s. */
const IDLE_WARN_MS = IDLE_TIMEOUT_MS - 30_000;

/**
 * The goodbye runs just ahead of useKioskController's own reset, which switches
 * the language back to Korean: a visitor who chose English hears it in English.
 */
const IDLE_GOODBYE_MS = IDLE_TIMEOUT_MS - 500;

/** Every key the JD-KP100 sends — see the map at the top of useJejuKeypad. */
const PAD_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace', 'KeyH']);
const isPadKey = (e: KeyboardEvent): boolean =>
  PAD_CODES.has(e.code) || /^[0-9*#]$/.test(e.key);

/** 홈/뒤로 present but disabled: the photo is still being made (틀린그림찾기). */
const LOCKED_SELECTOR = 'button[aria-label="홈"][disabled], button[aria-label="뒤로"][disabled]';
const DISMISS_SELECTOR = '[data-pad-dismiss]';
/** An open on-screen keyboard or number pad: digits type there, not here. */
const TYPING_SELECTOR = 'button[data-vk-digit]';
/**
 * Long text that key 2 reads in full, in document order. A screen opts in by
 * marking the element(s) — several when the text is split across cards.
 */
const MORE_SELECTOR = '[data-voice-more]';

/** `enabled` false: the keys stay silent — the 시스템 점검 notice has no screen to describe. */
export function useJejuVoice(controller: KioskController, enabled = true): void {
  const { screen, photoActive, kioskId } = controller;
  const on = useVoiceStore((s) => s.on);
  const dismissed = useVoiceStore((s) => s.dismissed);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Latest screen for the listeners below, which subscribe once.
  const stateRef = useRef({ screen, photoActive, kioskId });
  stateRef.current = { screen, photoActive, kioskId };

  useEffect(() => {
    const root = (): ParentNode => document.querySelector('[data-kiosk-artboard]') ?? document;
    const lang = () => toVoiceLang(useLanguageStore.getState().currentLanguage);
    const line = (key: string, priority: Priority, extra?: Partial<Line>): Line | null => {
      const l = sheetLine(key, lang(), stateRef.current.kioskId, { priority });
      return l && { ...l, ...extra };
    };

    const announceScreen = (): void => {
      const { screen: s, photoActive: p, kioskId: k } = stateRef.current;
      announceKeys(currentIntro(s, p, k));
    };

    const announceFocus = (): void => {
      const el = document.querySelector<HTMLElement>('[data-keypad-focus]');
      if (!el) return;
      say(focusLine(el, lang(), stateRef.current.kioskId, stateRef.current.screen === 'fillme'));
    };

    const turnOn = (): void => {
      // Lands in main.log — the first thing to check when a kiosk "says nothing".
      // eslint-disable-next-line no-console
      console.info(`[voice] on — lang ${lang()}, voices: ${listVoices().map((v) => v.lang).join(', ') || 'none loaded'}`);
      useVoiceStore.getState().turnOn();
      say(line('global.voice.on', Priority.State, { lead: true }));
      announceScreen();
    };

    const turnOff = (): void => {
      // eslint-disable-next-line no-console
      console.info('[voice] off');
      useVoiceStore.getState().dismiss();
      stop();
      say(line('global.voice.off', Priority.State, { force: true }));
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.key === 'Shift') return;
      if (!enabledRef.current || !isPadKey(e)) return;

      const typing = root().querySelector(TYPING_SELECTOR) !== null;
      const isDigit = !e.shiftKey && /^[0-9]$/.test(e.key);

      // A held key auto-repeats: without this, holding 3 flips voice on and off,
      // 7 / 8 run to the end of the scale and 0 flickers ♿. One press, one action.
      if (e.repeat && isDigit && !typing) {
        e.preventDefault();
        return;
      }

      const { on, dismissed } = useVoiceStore.getState();
      if (!on) {
        if (dismissed) {
          if (e.key === '3' && !typing) {
            e.preventDefault();
            turnOn();
          }
          return;
        }
        if (!(isDigit && typing)) e.preventDefault();
        turnOn();
        return;
      }

      // Any press interrupts — the key's own action speaks next, if it has a line.
      stop();

      if (!typing && !e.shiftKey && /^[0-9]$/.test(e.key)) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            announceScreen();
            announceFocus();
            return;
          case '2': {
            e.preventDefault();
            const text = Array.from(root().querySelectorAll<HTMLElement>(MORE_SELECTOR), (el) => el.innerText)
              .join('\n')
              .trim();
            const l = lang();
            if (text && canSpeak(l)) say({ text, lang: l, priority: Priority.Screen });
            return;
          }
          case '3':
            e.preventDefault();
            turnOff();
            return;
          case '7':
          case '8': {
            e.preventDefault();
            const store = useVoiceStore.getState();
            store.stepVolume(e.key === '8' ? 1 : -1);
            // The new level as a number, one to five — at the new volume.
            say(line(`num.${useVoiceStore.getState().volumeStep + 1}`, Priority.State));
            return;
          }
          case '9':
            e.preventDefault();
            say(line('global.keys.help', Priority.State));
            return;
          default:
            return;
        }
      }

      // The home screen draws 홈/뒤로 too, but pressing them goes nowhere from there.
      const { screen: s, photoActive: p } = stateRef.current;
      if (s === 'home' && !p) return;

      if ((e.code === 'KeyH' || e.code === 'Backspace') && root().querySelector(LOCKED_SELECTOR)) {
        if (!root().querySelector(DISMISS_SELECTOR)) say(line('shoot.locked', Priority.State));
      } else if (e.code === 'KeyH' && root().querySelector(HOME_SELECTOR)) {
        say(line('global.nav.home', Priority.State, { lead: true }));
      } else if (
        e.code === 'Backspace' &&
        !root().querySelector(DISMISS_SELECTOR) &&
        root().querySelector(BACK_SELECTOR)
      ) {
        say(line('global.nav.back', Priority.State, { lead: true }));
      }
    };

    // A touch interrupts too; touching never turns voice on.
    const onPointerDown = (): void => stop();

    const onFocus = (): void => {
      if (useVoiceStore.getState().on) announceFocus();
    };

    const unsubLang = useLanguageStore.subscribe((s, prev) => {
      if (s.currentLanguage === prev.currentLanguage || !useVoiceStore.getState().on) return;
      // In the new language — each row names its own language.
      say(line('global.lang.changed', Priority.State, { lead: true }));
    });

    const unsubLowReach = useAccessibilityStore.subscribe((s, prev) => {
      if (s.lowReach === prev.lowReach || !useVoiceStore.getState().on) return;
      say(line(s.lowReach ? 'global.lowreach.on' : 'global.lowreach.off', Priority.State));
    });

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener(FOCUS_EVENT, onFocus);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener(FOCUS_EVENT, onFocus);
      unsubLang();
      unsubLowReach();
      stop();
    };
  }, []);

  // L1 on every screen change. Not on mount, and not while voice is off.
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    if (useVoiceStore.getState().on) announceKeys(currentIntro(screen, photoActive, kioskId));
  }, [screen, photoActive, kioskId]);

  usePhotoVoice();
  useStateVoice();

  useInactivityReset({
    enabled: on,
    timeoutMs: IDLE_WARN_MS,
    onIdle: () => {
      const lang = toVoiceLang(useLanguageStore.getState().currentLanguage);
      say(sheetLine('global.idle.warn', lang, kioskId, { priority: Priority.State }));
    },
  });

  useInactivityReset({
    enabled: on || dismissed,
    timeoutMs: IDLE_GOODBYE_MS,
    onIdle: () => {
      const lang = toVoiceLang(useLanguageStore.getState().currentLanguage);
      const wasOn = useVoiceStore.getState().on;
      stop();
      useVoiceStore.getState().reset();
      if (wasOn) say(sheetLine('global.idle.reset', lang, kioskId, { priority: Priority.State, force: true }));
    },
  });
}

/** `data-voice-state` value → its sheet line. */
const STATE_LINES: Readonly<Record<string, string>> = {
  loading: 'state.loading',
  error: 'state.error.network',
  empty: 'state.empty',
  preparing: 'state.preparing',
};

/** "Loading" is only worth saying when it lasts — the spec's 3 seconds. */
const LOADING_GRACE_MS = 3000;

/**
 * L3 for the screens' own loading / error / empty messages. 제주 has no shared
 * component for them — each screen draws its own — so the screens mark the
 * message element with `data-voice-state` and this watches the artboard for one
 * to appear (or change kind). Each element is announced once per kind.
 */
function useStateVoice(): void {
  useEffect(() => {
    const root = document.querySelector('[data-kiosk-artboard]');
    if (!root) return undefined;
    const said = new WeakMap<Element, string>();
    const timers = new Set<number>();

    const scan = (): void => {
      for (const el of root.querySelectorAll<HTMLElement>('[data-voice-state]')) {
        const kind = el.dataset['voiceState'] ?? '';
        if (said.get(el) === kind || !STATE_LINES[kind]) continue;
        said.set(el, kind);
        // After the screen's intro, not over it: the intro says where you are.
        if (kind !== 'loading') {
          speakKey(STATE_LINES[kind]!, Priority.State, true);
          continue;
        }
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          if (el.isConnected && el.dataset['voiceState'] === 'loading') {
            speakKey(STATE_LINES['loading']!, Priority.State, true);
          }
        }, LOADING_GRACE_MS);
        timers.add(timer);
      }
    };

    const observer = new MutationObserver(scan);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-voice-state'] });
    return () => {
      observer.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
  }, []);
}

const CAPTURING = new Set(['preview', 'countdown']);

/**
 * The AR 한복 flow's lines, read off photoStore. Every intro it sets is also
 * the flow's current intro for key 1 (setPhotoIntro).
 *
 *   outfit → capture   hanbok.capture, then shoot.palm while the palm gate waits
 *   palm gate held     shoot.paused
 *   counting           num.10 … num.1, one per second as main broadcasts them
 *   → generating       shoot.capture, hanbok.waiting, shoot.game
 *   → result           shoot.done (the ready popup over the game)
 *   error              shoot.failed
 */
function usePhotoVoice(): void {
  useEffect(
    () =>
      usePhotoStore.subscribe((s, prev) => {
        if (s.phase !== prev.phase) {
          if (CAPTURING.has(s.phase) && !CAPTURING.has(prev.phase)) {
            const keys = s.gestureGate === 'waiting' ? ['hanbok.capture', 'shoot.palm'] : ['hanbok.capture'];
            setPhotoIntro(keys);
            if (useVoiceStore.getState().on) announceKeys(keys);
          } else if (s.phase === 'generating') {
            setPhotoIntro(['hanbok.waiting', 'shoot.game']);
            if (useVoiceStore.getState().on) announceKeys(['shoot.capture', 'hanbok.waiting', 'shoot.game']);
          } else if (s.phase === 'result') {
            setPhotoIntro(['shoot.done']);
            if (useVoiceStore.getState().on) speakKey('shoot.done');
          } else if (!CAPTURING.has(s.phase)) {
            setPhotoIntro(null);
          }
        }
        if (!useVoiceStore.getState().on) return;

        if (s.gestureGate !== prev.gestureGate && s.phase === prev.phase) {
          if (s.gestureGate === 'waiting') speakKey('shoot.palm');
          else if (s.gestureGate === 'held') speakKey('shoot.paused');
        }
        const n = s.countdown;
        if (n !== prev.countdown && n != null && n >= 1 && n <= 10 && s.gestureGate !== 'held') {
          speakKey(`num.${n}`);
        }
        if (s.errorMessage && s.errorMessage !== prev.errorMessage) speakKey('shoot.failed');
      }),
    [],
  );
}
