/**
 * Drives the 제주 kiosk from its barrier-free keypad (JNM JD-KP100).
 *
 * 제주 only — mounted by JejuKiosk, and by nothing else. The other five layouts
 * have no such hardware attached.
 *
 * ── The pad, as measured ────────────────────────────────────────────────────
 * It enumerates as an ordinary USB HID keyboard, so every key arrives as a
 * plain `keydown`. What each key actually sends was measured on the device
 * rather than assumed — logged off the device itself on 2026-09-03 — and two of
 * the results were NOT what a reasonable guess would have produced:
 *
 *   1  2  3        ▲          Digit1…Digit9, Digit0 — TOP-ROW codes, location 0.
 *   4  5  6      ◀ ○ ▶        Not Numpad1…Numpad9, which is what a numeric pad
 *   7  8  9        ▼          would normally send.
 *   *  0  #      △    ✕
 *
 *   ▲▼◀▶  ArrowUp / ArrowDown / ArrowLeft / ArrowRight
 *   ○     Enter
 *   ✕     Backspace
 *   △     KeyH  ("h" — a plain letter, for reasons known only to the firmware)
 *   *     ShiftLeft + Digit8   ← two events, ~1ms apart
 *   #     ShiftLeft + Digit3   ← two events, ~1ms apart
 *
 * ── The trap ────────────────────────────────────────────────────────────────
 * `*` and `#` are Shift+8 and Shift+3, so their `e.code` is `Digit8` / `Digit3`
 * — IDENTICAL to the number keys 8 and 3. Anything here that dispatches on
 * `e.code` alone would read a press of `*` as a press of `8`. So `*` and `#`
 * are matched on `e.key` FIRST, before the modifier guard that rejects
 * everything else carrying a modifier — which is what discards the bare
 * `ShiftLeft` leading each of them. Keep that order if you add digit handling.
 *
 * ── What each key does, and when ────────────────────────────────────────────
 * Every key is read against what is on the screen, not against a fixed table.
 * The same press means different things depending on what the visitor is in:
 *
 *   ▲▼◀▶   move the ring · scroll a board that has no ring to move (see
 *          scrollNav) · the photo lightbox keeps ◀▶ for its own gallery
 *   ○      press the ringed thing · land the ring when there is none
 *   ✕      close the topmost overlay · else press the screen's 뒤로
 *   △      press the screen's 홈
 *   *      delete a character while an entry surface is open · else page up
 *   #      confirm (검색) while one is open · else page down
 *   0–9    type into an open keyboard or number pad
 *   0      otherwise toggles ♿ 저상 화면
 *   1–9    otherwise nothing yet — see The digits, below
 *
 * Two of those read the screen through a marker attribute rather than through a
 * screen name: DISMISS_SELECTOR and the digit keys' `data-vk-digit`. That is
 * deliberate. A map keyed on `controller.screen` would already be wrong for the
 * 한복/틀린그림찾기 flow, which is not routed by screen id at all (JejuKiosk
 * swaps the whole foreground on `photoActive`), and it would need editing every
 * time a screen grew an overlay. What is ON the screen is the truth.
 *
 * ── The digits ──────────────────────────────────────────────────────────────
 * `1`–`9` and `0` TYPE while an on-screen keyboard is open. Otherwise `0`
 * toggles 저상 화면 and `1`–`9` do nothing.
 *
 * 제주 has no native `<input>` anywhere: every text field on every screen routes
 * through FloatingKeyboard, whose keys are ordinary `<button>`s inside the
 * artboard. So the pad could always type by arrowing onto a key and pressing
 * `○` — but the phone-number field on JejuPhotoRegister accepts digits only
 * (`/^\d$/`), and making someone cross a 30-key keyboard ten times with a
 * number pad under their hand is absurd. Digits click the keyboard's matching
 * number key directly, the same way `✕`, `△` and `0` click their own buttons.
 *
 * The 환율계산기's own number pad carries the same `data-vk-digit` marker, so
 * entering an amount to convert works from the pad without a line of screen-
 * specific code here. Any future entry surface joins by marking its keys.
 *
 * `1`–`9` are left with nothing to do off a keyboard on purpose. Jump-to-tile is
 * where they belong, but that needs number badges drawn on the tiles first —
 * press `4` today and the ring would move for no visible reason. That is a
 * design change, not just code, and binding them to something else in the
 * meantime would teach a mapping we would have to take back. When the badges
 * land the branch is already here: keyboard open → type, otherwise → jump.
 *
 * ── Arrows read as well as steer ────────────────────────────────────────────
 * ▲▼ move the ring between things that can be PRESSED, which is the whole story
 * on the home grid and nothing like the story on 항공편 or 여객선: those boards
 * are rows of text in a scroll box with not one focusable element among them.
 * So the arrows are situational. A box of pure data gets them outright and
 * scrolls; a list of pressable cards is walked, because every row has to be
 * selectable; and an arrow that runs out of ring to move scrolls whatever the
 * ring is sitting in rather than doing nothing. `*` / `#` follow the same
 * precedence, a screenful at a time. See scrollNav.
 *
 * ── The keyboard has an owner ───────────────────────────────────────────────
 * Everything here hangs off ONE `keydown` listener on the host window, which
 * only fires when this window has OS focus and the focus inside it is not in a
 * `<webview>` guest. Both are losable, and when either is lost the pad looks
 * broken rather than limited. The guest case is handled at the bottom of this
 * file; the window case is not the renderer's to fix (see DisplayWindow).
 *
 * ── No audio ────────────────────────────────────────────────────────────────
 * There is no audio guidance on this kiosk and none planned (confirmed
 * 2026-09-03), so `△ * #` are NOT reserved for the play/pause and volume roles
 * a barrier-free pad conventionally gives them. They drive real screen actions
 * instead. Anyone adding speech later should expect to negotiate for them.
 */
import { useEffect, useRef } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { collectTargets, needsTabIndex, pickNext, readingOrder, type Dir } from './spatialNav';
import { canScroll, largestScroller, reveal, scrollableAncestor, scrollStep } from './scrollNav';
import './keypadFocus.css';

/** Marks the one element wearing the focus ring. Styled in keypadFocus.css. */
const FOCUS_ATTR = 'data-keypad-focus';

/** On `<body>` while the pad is in use, so the ring only shows for pad users. */
const MODE_CLASS = 'jeju-keypad';

/** The four arrow keys, by `e.code`. Everything else the pad sends is inert. */
const ARROW_DIRS: Readonly<Record<string, Dir>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * The 제주 header's back button, by the label JejuHeader gives it.
 *
 * `✕` reuses the on-screen button rather than calling `controller.navigate`
 * itself, which keeps one behaviour instead of two: pages that override where
 * back goes (JejuPageFrame's `onBack`, the photo flow's own chrome) are
 * followed automatically, and a page that has DISABLED its nav — 틀린그림찾기,
 * mid-round, where leaving throws away a photo that is still generating — stays
 * un-leavable from the pad too, because `:not([disabled])` finds nothing.
 *
 * On the home screen there is no header and so no match, and `✕` does nothing.
 * That is correct: there is nowhere above home to go.
 */
const BACK_SELECTOR = 'button[aria-label="뒤로"]:not([disabled])';

/**
 * The 제주 header's home button — `△`'s target, and the same arrangement as
 * {@link BACK_SELECTOR}: clicking the real button rather than navigating
 * directly means a screen that has disabled its nav stays un-leavable from the
 * pad too. On the home screen there is no header, so `△` does nothing.
 */
const HOME_SELECTOR = 'button[aria-label="홈"]:not([disabled])';

/** Elements that should keep their own Enter behaviour instead of being clicked. */
const TEXT_ENTRY = /^(INPUT|TEXTAREA|SELECT)$/;

/**
 * A number key on the open on-screen keyboard, for the pad's digits to click.
 *
 * Marked with an attribute rather than found by its label so that restyling a
 * key, or localizing it, cannot silently break typing. VirtualKeyboard sets it;
 * see the comment there.
 */
const vkDigitSelector = (digit: string): string => `button[data-vk-digit="${digit}"]`;

/**
 * The ♿ 저상 화면 toggle, present on the left rail of every 제주 screen.
 *
 * `0`'s target, and the one shortcut on this pad that is not merely faster than
 * arrowing to the button. Low-reach exists for a visitor who cannot reach the
 * top of a 3840px portrait panel; the keypad is mounted low, by the card
 * reader, within reach of exactly that visitor. Making them travel the screen
 * to find the control that fixes the screen being out of reach is backwards, so
 * it gets a key of its own.
 *
 * `0` rather than one of `1`–`9` because those are the natural jump-to-tile
 * keys the day the tiles carry numbers; `0` would have no tile to point at.
 */
const LOW_REACH_SELECTOR = 'button[aria-label="저상 화면"]:not([disabled])';

/**
 * The topmost dismissible thing, when a screen has one up.
 *
 * `✕` means one thing everywhere — "get me out of what I am in" — and an open
 * overlay is what a visitor is in. Before this, ✕ on the 환율계산기 with its
 * number pad up left the screen entirely, throwing away the amount they were
 * part-way through entering, because ✕ only ever knew about the header.
 *
 * A marker attribute rather than a label, because what closes an overlay is not
 * one shape: some are a labelled ✕ button, some are a bare backdrop `<div>`
 * with no role at all. Marking the backdrops does NOT make them focusable, and
 * must not — they cover the whole artboard, and anything focusable that size
 * becomes a hole the arrows fall into.
 *
 * Carried today by the search keyboard's tray (FloatingKeyboard, so every
 * screen that opens one), the 환율계산기's number pad and currency picker, the
 * 날씨 panel, the MBTI 결과 modal, the 개인정보 처리방침 modal, and the photo
 * lightbox. Each explains it where it sets it.
 *
 * Screens that instead unwind their own state through `onBack` — 이벤트's event
 * detail, 소개's 관광명소 drill-down, AI 검색's step 2, 한복 설명 — need no
 * marker: ✕ presses their real 뒤로 button, and their override does the rest.
 */
const DISMISS_SELECTOR = '[data-pad-dismiss]';

/**
 * The delete key of whatever entry surface is open — `*`'s job while typing.
 *
 * 지우기 is what both of 제주's entry surfaces call it: the search keyboard's
 * dark backspace key and the 환율계산기's own number pad. The label is the
 * contract, and it is the accessible name a screen reader would read out too,
 * so it cannot drift without someone noticing.
 *
 * `*` and not `✕`, though ✕ is the key that LOOKS like an erase: ✕ already
 * means back on every screen, and a visitor who has learned that would be
 * stranded on the one screen where it silently meant something else. Deleting
 * is a need that exists only while an entry surface is up, so it goes on a key
 * that has nothing to do there — `*` pages, and there is nothing to page.
 */
const DELETE_SELECTOR = 'button[aria-label="지우기"]:not([disabled])';

/** The confirm key of an open entry surface — `#`'s job while typing. */
const CONFIRM_SELECTOR = 'button[aria-label="검색"]:not([disabled])';

/**
 * How far one `*` / `#` press travels, as a fraction of the visible height.
 *
 * Under 1 so the jump overlaps the previous view. Landing exactly one screenful
 * on means everything the visitor just passed is gone with no shared row to
 * orient by, which on a 3840px panel is disorienting; 70% leaves a strip of
 * what they were looking at.
 */
const PAGE_FRACTION = 0.7;

/**
 * Hard stop on the paging walk.
 *
 * `*`/`#` page by repeatedly stepping the ring rather than by scrolling the
 * container, so the ring is always left on a real element instead of being
 * scrolled off into nowhere. That is a loop over unknown content, so it gets a
 * ceiling — 40 steps is far more than any 제주 screen holds in one direction.
 */
const PAGE_MAX_STEPS = 40;

/**
 * How far one arrow press scrolls a data board, as a fraction of the box.
 *
 * A quarter of the visible list is three or four 항공편 rows at the kiosk's own
 * scale — enough that holding ▼ travels, small enough that the rows the visitor
 * was mid-way through reading are still on screen after the press.
 */
const SCROLL_STEP_FRACTION = 0.25;

/**
 * The same, for `*` / `#`. Just under a full box for the reason PAGE_FRACTION
 * is under a screenful: landing with no shared row to orient by is worse than
 * travelling slightly less far.
 */
const SCROLL_PAGE_FRACTION = 0.85;

export function useJejuKeypad(controller: KioskController): void {
  const { screen, photoActive } = controller;

  /** The element currently wearing the ring, if it is still in the document. */
  const focusedRef = useRef<HTMLElement | null>(null);
  /** Whether the visitor is driving with the pad (vs. touching the panel). */
  const padModeRef = useRef(false);

  useEffect(() => {
    /**
     * The 제주 artboard. Scoping the search to it keeps the pad inside the kiosk
     * design and away from the app-level siblings mounted next to it in
     * App.tsx, such as KioskSwitcher's dev drawer.
     */
    const root = (): ParentNode => document.querySelector('[data-kiosk-artboard]') ?? document;

    const setFocus = (el: HTMLElement | null): void => {
      const prev = focusedRef.current;
      if (prev && prev !== el) prev.removeAttribute(FOCUS_ATTR);
      focusedRef.current = el;
      if (!el) return;

      // The home screen's weather panel and search field are [role="button"]
      // divs — tappable, but not focusable until they carry a tabindex. -1
      // keeps them out of the Tab sequence, which nothing here uses anyway.
      if (needsTabIndex(el)) el.tabIndex = -1;

      el.setAttribute(FOCUS_ATTR, '');
      // Focus without the browser's own scrolling, then scroll deliberately:
      // `block: 'nearest'` moves the list only as far as it must, so walking a
      // long 항공편 or 도와줘 하영 list creeps line by line instead of snapping
      // the focused row to the top on every press. `reveal` rather than a bare
      // scrollIntoView because a smooth scroll can be dropped outright — see
      // scrollNav, where the same hazard is described in full.
      el.focus({ preventScroll: true });
      reveal(el, () => focusedRef.current === el);
    };

    /** Land on the first thing in reading order — used when nothing is focused. */
    const focusFirst = (): void => {
      const [first] = readingOrder(collectTargets(root()));
      setFocus(first?.el ?? null);
    };

    const enterPadMode = (): void => {
      if (padModeRef.current) return;
      padModeRef.current = true;
      document.body.classList.add(MODE_CLASS);
    };

    /**
     * A box of pure DATA that the arrows should scroll outright, or null.
     *
     * The 항공편 and 여객선 boards are `<div>` rows of `<span>` cells inside an
     * `overflow-y: auto` box — nothing in them can be pressed, so the ring can
     * only ever sit on the tabs above. Before this, ▼ there found no candidate
     * and the pad did nothing on the screen visitors spend the longest reading.
     *
     * Three conditions, and all three matter:
     *  - the box has somewhere left to go in `dir` — at the end, the arrows go
     *    back to being navigation and the ring walks off the list;
     *  - the ring is NOT inside it — a list of pressable cards is read by
     *    walking it, and sliding the box out from under the ring would strand
     *    the visitor somewhere they cannot see;
     *  - the box holds nothing focusable — so the home grid, whose panels are
     *    full of tiles, is never scrolled past instead of navigated.
     */
    const dataBox = (dir: Dir): HTMLElement | null => {
      const box = largestScroller(root(), dir);
      if (!box || !canScroll(box, dir)) return null;

      const current = focusedRef.current;
      if (current?.isConnected && box.contains(current)) return null;
      if (collectTargets(box).length > 0) return null;

      return box;
    };

    /** Whatever box is in play, for when the ring has run out of room. */
    const nearestBox = (dir: Dir): HTMLElement | null => {
      const current = focusedRef.current;
      const near = current?.isConnected ? scrollableAncestor(current, dir) : null;
      const box = near ?? largestScroller(root(), dir);
      return box && canScroll(box, dir) ? box : null;
    };

    const move = (dir: Dir): void => {
      // Reading beats steering: on a board of pure data the arrows scroll it.
      const data = dataBox(dir);
      if (data && scrollStep(data, dir, SCROLL_STEP_FRACTION)) return;

      const targets = collectTargets(root());
      const current = focusedRef.current;

      if (targets.length > 0) {
        // Nothing focused yet, or what was focused has since left the DOM (a
        // screen changed under us): the first press of any arrow lands rather
        // than moves, so the visitor always sees where they are before they steer.
        if (!current || !current.isConnected) {
          focusFirst();
          return;
        }

        const next = pickNext(current.getBoundingClientRect(), targets, dir);
        if (next) {
          setFocus(next);
          return;
        }
      }

      // No landing spot that way. Rather than the dead press this used to be,
      // scroll whatever the ring is sitting in — the edge of the FOCUSABLE
      // graph is rarely the edge of what there is to read.
      const box = nearestBox(dir);
      if (box) scrollStep(box, dir, SCROLL_STEP_FRACTION);
    };

    const activate = (): void => {
      const el = focusedRef.current;
      // Nothing to press yet: land the ring rather than sit there. A first
      // press that visibly does something is how the visitor learns the pad is
      // alive — the arrows already behave this way.
      if (!el || !el.isConnected) {
        focusFirst();
        return;
      }
      // Text fields keep their own Enter semantics; everything else is a
      // button-shaped thing and gets clicked. Clicking rather than relying on
      // the browser's native Enter-activates-button covers the [role="button"]
      // divs, which it would not fire for.
      if (TEXT_ENTRY.test(el.tagName)) return;
      el.click();
    };

    /**
     * Move the ring roughly one screenful in `dir`.
     *
     * Walks `pickNext` repeatedly instead of scrolling the container directly.
     * Two things fall out of that for free: the ring always ends on a real
     * element (so the next arrow press has an anchor), and setFocus's own
     * scrollIntoView brings it into view — no separate scrolling code, and no
     * way for the two to disagree about where the visitor is.
     *
     * All candidate rects are measured once, up front, and nothing scrolls
     * until the final setFocus, so they stay valid for the whole walk.
     */
    const page = (dir: Dir): void => {
      // Same precedence as the arrows — a board of data pages as a board of
      // data, a screenful at a time. See dataBox.
      const data = dataBox(dir);
      if (data && scrollStep(data, dir, SCROLL_PAGE_FRACTION)) return;

      const targets = collectTargets(root());
      const current = focusedRef.current;

      if (targets.length === 0 || !current || !current.isConnected) {
        if (targets.length > 0) {
          focusFirst();
          return;
        }
        const empty = nearestBox(dir);
        if (empty) scrollStep(empty, dir, SCROLL_PAGE_FRACTION);
        return;
      }

      const startRect = current.getBoundingClientRect();
      const goal = window.innerHeight * PAGE_FRACTION;

      let rect = startRect;
      let landing: HTMLElement | null = null;
      for (let step = 0; step < PAGE_MAX_STEPS; step++) {
        const next = pickNext(rect, targets, dir);
        // Ran out of screen before covering a page: stop on the last real
        // element rather than giving up and moving nothing.
        if (!next) break;
        landing = next;
        rect = next.getBoundingClientRect();
        if (Math.abs(rect.top - startRect.top) >= goal) break;
      }

      if (landing) {
        setFocus(landing);
        return;
      }

      // A page press that found no landing spot at all: scroll instead, for the
      // same reason the arrows do.
      const box = nearestBox(dir);
      if (box) scrollStep(box, dir, SCROLL_PAGE_FRACTION);
    };

    /** Press a real on-screen control. False when the screen has no such one. */
    const clickChrome = (selector: string): boolean => {
      const el = root().querySelector<HTMLElement>(selector);
      if (!el) return false;
      el.click();
      return true;
    };

    /**
     * Press the LAST match instead of the first — for ✕, which has to close the
     * topmost layer.
     *
     * Screens can have two dismissible things up at once: the 제주 home screen
     * opens its 날씨 panel and can then open the search keyboard over it. Later
     * in the document is what these screens paint on top, because every overlay
     * is appended after the content it covers, so the last match is the one the
     * visitor is actually looking at. Closing the first would shut the panel out
     * from under an open keyboard.
     */
    const clickLast = (selector: string): boolean => {
      const all = root().querySelectorAll<HTMLElement>(selector);
      const el = all[all.length - 1];
      if (!el) return false;
      el.click();
      return true;
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      // Something else already dealt with this key. Never fight a component for
      // the keys it owns: the photo lightbox drives its own gallery with ◀ ▶,
      // and without this a press would slide the gallery and move the ring
      // behind it at once.
      //
      // THE CONTRACT, for anyone adding such a component: claim the key in the
      // CAPTURE phase — `addEventListener('keydown', fn, true)` — and call
      // `preventDefault`. A bubble-phase listener is not enough. This hook is
      // mounted by JejuKiosk at the router level, so it registers before any
      // screen or overlay does, and listeners on the same target fire in
      // registration order: in the bubble phase the pad would go first and the
      // ring would already have moved. Capture always runs ahead of it.
      if (e.defaultPrevented) return;

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // `*` and `#` FIRST, and matched on `e.key` — see the trap at the top of
      // this file. Their `e.code` is Digit8 / Digit3, indistinguishable from the
      // number keys 8 and 3, and they are the one pair on this pad that arrives
      // with a modifier held, so they have to clear the guard below.
      if (e.key === '*' || e.key === '#') {
        enterPadMode();
        e.preventDefault();

        // While an entry surface is open the pair change jobs: there is nothing
        // to page on a screen whose content is a keyboard, and a visitor typing
        // a phone number or an amount needs to fix a mistake far more often
        // than they need to travel. `*` deletes, `#` accepts. See
        // DELETE_SELECTOR for why deleting is not on `✕`.
        if (e.key === '*' && clickChrome(DELETE_SELECTOR)) return;
        if (e.key === '#' && clickChrome(CONFIRM_SELECTOR)) return;

        page(e.key === '*' ? 'up' : 'down');
        return;
      }

      // Everything else on this pad is unmodified. That discards the bare
      // `ShiftLeft` event leading each `*`/`#` press, and any shifted digit
      // that reaches here without being one of the two handled above.
      if (e.shiftKey || e.key === 'Shift') return;

      // Any real press means a visitor is on the pad, including the keys that
      // do nothing yet — better that a digit lights the ring so they can see
      // where they are than that it appear to be a dead machine.
      enterPadMode();

      const dir = ARROW_DIRS[e.code];
      if (dir) {
        // Arrows would otherwise scroll the nearest scroll container out from
        // under us, on top of the move we are making.
        e.preventDefault();
        move(dir);
        return;
      }

      if (e.code === 'Enter') {
        e.preventDefault();
        activate();
        return;
      }

      if (e.code === 'Backspace') {
        // Backspace is the browser's historical "go back" and, in any text
        // field, a delete. Neither is wanted from `✕`.
        e.preventDefault();
        // One layer at a time. An open overlay — the search keyboard, the
        // 환율계산기's number pad, its currency picker — is what the visitor is
        // inside, so that closes first and the screen stays put. Only once
        // there is nothing on top does ✕ mean leave the screen.
        if (clickLast(DISMISS_SELECTOR)) return;
        clickChrome(BACK_SELECTOR);
        return;
      }

      // `△` sends a plain `h` (measured, not chosen — see the key map above).
      // Worth knowing that this makes the letter h unusable for anything else
      // on 제주 while the pad is attached.
      if (e.code === 'KeyH') {
        e.preventDefault();
        clickChrome(HOME_SELECTOR);
        return;
      }

      // Digits, in priority order.
      //
      // `e.key` is safe here despite the `*`/`#` collision: those two were
      // handled and returned above, and anything still shifted was rejected.
      if (/^[0-9]$/.test(e.key)) {
        // 1. Typing wins wherever a keyboard is open — a visitor entering a
        //    phone number means the digit, and nothing else.
        const vkKey = root().querySelector<HTMLElement>(vkDigitSelector(e.key));
        if (vkKey) {
          e.preventDefault();
          vkKey.click();
          return;
        }

        // 2. `0` toggles 저상 화면 when there is no field to type into.
        if (e.key === '0') {
          const toggle = root().querySelector<HTMLElement>(LOW_REACH_SELECTOR);
          if (toggle) {
            e.preventDefault();
            toggle.click();
          }
          return;
        }

        // 3. `1`–`9` have no target yet, so they do nothing. Not an oversight:
        //    there is nothing on screen for them to point AT until the home
        //    tiles carry number badges. Wiring them to something arbitrary
        //    would teach a visitor a mapping we would then have to take back.
      }
    };

    /**
     * A touch means the pad is not what is driving any more: drop the ring so
     * the screen goes back to looking like the touch kiosk it is.
     */
    const onPointerDown = (): void => {
      if (!padModeRef.current) return;
      padModeRef.current = false;
      document.body.classList.remove(MODE_CLASS);
      setFocus(null);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
      setFocus(null);
      document.body.classList.remove(MODE_CLASS);
      padModeRef.current = false;
    };
  }, []);

  /**
   * Re-land on the new screen after every navigation.
   *
   * Without this a pad user is stranded the moment they press `○`: the element
   * they were on unmounts with the old screen, the ring goes with it, and the
   * next arrow press has no anchor to move from. Landing on the first thing in
   * reading order means every screen opens with a visible starting point.
   *
   * Only while the pad is in use — a touch visitor must never see a ring appear
   * on its own. And after a frame, so React has painted the screen being
   * measured rather than the one being left.
   */
  useEffect(() => {
    if (!padModeRef.current) return;
    const id = requestAnimationFrame(() => {
      const root = document.querySelector('[data-kiosk-artboard]') ?? document;
      const prev = document.querySelector<HTMLElement>(`[${FOCUS_ATTR}]`);
      prev?.removeAttribute(FOCUS_ATTR);

      const [first] = readingOrder(collectTargets(root));
      focusedRef.current = first?.el ?? null;
      if (!first) return;

      if (needsTabIndex(first.el)) first.el.tabIndex = -1;
      first.el.setAttribute(FOCUS_ATTR, '');
      first.el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [screen, photoActive]);

  /**
   * Take the keyboard back off a `<webview>` the visitor has left.
   *
   * This is the one that made the pad look broken rather than merely limited.
   * A `<webview>` guest is a SEPARATE process with its own focus: while one
   * holds it, `keydown` is delivered to the guest document and the host's
   * window listener above never runs at all. Touch the WIT Store page once —
   * scroll it, tap a product — and the guest owns the keyboard from then on.
   * Going home does not give it back, because 제주 keeps all three web layers
   * mounted from boot (collapsed to 0x0, not unmounted), so the element the
   * guest lives in is still there holding host focus. The pad then appears dead
   * on EVERY screen until the kiosk is restarted.
   *
   * So on every navigation, if host focus is parked on a webview belonging to a
   * layer the visitor is no longer looking at, blur it. Not conditional on pad
   * mode: the whole failure is a pad user arriving at a kiosk a touch visitor
   * left in this state, before any pad key has been pressed.
   *
   * A webview that IS the visible screen keeps focus — the remote page's own
   * keys are its business while it is in front.
   */
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active.tagName !== 'WEBVIEW') return;
    if (!active.closest('[data-keypad-inert]')) return;
    active.blur();
    document.body.focus();
  }, [screen, photoActive]);
}
