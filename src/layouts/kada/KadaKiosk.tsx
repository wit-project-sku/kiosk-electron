/**
 * KADA (W202) screen router — Korea-ASEAN Digital Academy, Vietnam Chapter.
 *
 * The whole kiosk is six screens:
 *   home            → KadaHome, the Figma composition (5403:11277)
 *   kada_akcf … _wit → KadaImagePage, one flattened page per partner
 *   (photo overlay) → the shared PhotoWorkflow, identical to every other venue
 *
 * Navigation is a hub and spokes. The home screen's five orbiting badges open
 * the partner pages, and each page's left rail jumps straight to the other four
 * without going home first.
 *
 * What this layout deliberately does NOT do, and why — every one of these is a
 * subsystem the domestic kiosks mount here and KADA has no rows for:
 *   · no weather / exchange / flight / sailing sync — no screen reads them
 *   · no buttons or banners CMS — the home is a fixed composition, not a grid
 *   · no 위드마켓 / TAX-FREE / 기부 webviews — Korean-market flows
 *   · no Google Sheets localization — the ten strings live in kadaText.ts
 * Adding one back means adding the screen that needs it first.
 */
import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import type { KioskScreenId } from '@shared/types/kiosk';
import { useKioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { KioskArtboard } from '../components/KioskScreenImage';
import { PhotoWorkflow } from '../photo/PhotoWorkflow';
import { KadaHome } from './KadaHome';
import { KadaImagePage } from './KadaImagePage';
import { kadaPage, screenForPartner, type KadaPartner } from './kadaPages';
import { KADA_LANGS } from './kadaText';

/**
 * Theme the shared photo (AR) workflow for KADA — Figma 4618:2742
 * (Page_HanbokExplain_EN).
 *
 * KADA is the fleet's only DARK photo flow, which is why this block sets more
 * than the four accent variables the Korean venues do. The 한복 설명 screen there
 * is white cards and a white panel on a light background; here it is a
 * translucent wash and an unfilled gold outline over the KADA gradient, so the
 * card and panel SURFACES have to be re-pointed too, not just the accent.
 * HanbokSelect defaults every one of these to its Korean value, so nothing
 * changes for the other eight kiosks.
 *
 * `accent-soft` / `tint` stay light on purpose: they still drive the RESULT
 * screen and the capture chrome, which remain the shared light components.
 */
const PHOTO_THEME = {
  '--photo-accent': '#d2ae4f',
  // `soft` and `tint` are the accent's low-emphasis SURFACES. On the Korean
  // kiosks that means a pale cream on white; on KADA a cream panel over navy is
  // the "washed out gold" it looked like, so they are translucent gold instead.
  // Nothing on this layout renders them today (every surface that would is
  // overridden below) — they are kept on-palette so a future consumer inherits
  // something that belongs to the dark theme.
  '--photo-accent-soft': 'rgba(210, 174, 79, 0.18)',
  '--photo-tint': 'rgba(210, 174, 79, 0.10)',
  '--photo-accent-alt': '#616161',

  // 한복 설명 outfit cards (Figma 4618:2769). Unselected: a 20% white wash over
  // the navy with the same #e8e8e8 hairline the Korean kiosks use. Selected:
  // no fill at all — just a 10px gold ring, so the choice reads as a frame
  // around the outfit rather than a filled tile.
  '--photo-card-bg': 'rgba(255, 255, 255, 0.2)',
  '--photo-card-border': '#e8e8e8',
  '--photo-card-border-width': '5px',
  '--photo-card-sel-bg': 'transparent',
  '--photo-card-sel-border-width': '10px',
  '--photo-card-shadow': 'none',

  // "About HANBOK" panel (Figma 4618:2761): 5px gold outline, no fill, gold
  // heading, white body.
  '--photo-panel-bg': 'transparent',
  '--photo-panel-border': '#d2ae4f',
  '--photo-panel-border-width': '5px',
  '--photo-panel-shadow': 'none',
  '--photo-heading': '#d2ae4f',
  '--photo-body': '#ffffff',

  // The scrolling card+panel column has to stop above KADA's camera button
  // (y3046) rather than above the curved nav bar the Korean venues draw.
  '--photo-info-bottom': '854px',

  // The outfit-SELECTION screen (the one this flow opens on) inherits the card
  // variables above, so its grid tiles and category tabs already match. These
  // three invert the copy that sits on the bare background, which would
  // otherwise stay near-black on navy.
  '--photo-step-title': '#ffffff',
  '--photo-step-sub': '#a8adb5',
  '--photo-tab-text': '#e8e8e8',

  // Result / Save Photo screen (Figma 4649:6069). The Save and Retake buttons
  // and the QR frame need nothing here — they already read --photo-accent
  // (#d2ae4f) and --photo-accent-alt (#616161), which is exactly what that
  // frame specifies. Only the copy, which is near-black by default, inverts.
  '--photo-result-hint': '#ffffff',
  '--photo-result-note': '#ffffff',
  '--photo-hint-size': '68.648px',
  '--photo-qr-size': '214.525px',

  // Outfit screen: 'Alone' is the primary capture action and takes the venue
  // gold; 같이찍기 stays the shared grey.
  '--photo-capture-bg': '#d2ae4f',
  '--photo-capture-text': '#ffffff',

  // Selected category tab — solid gold, not the pale wash the Korean kiosks
  // use. That wash (--photo-accent-soft) was the one surface on this layout
  // reading as a lighter gold than #D2AE4F.
  '--photo-tab-sel-bg': '#d2ae4f',
  '--photo-tab-sel-border': '#d2ae4f',
  '--photo-tab-sel-text': '#102135',

  // KADA's camera-direction plate is 1450×2500, taller than the 2218 the Korean
  // venues' plates use — without this it would letterbox to 1287 wide inside
  // the shorter box and stop matching the artwork.
  '--photo-campopup-h': '2500px',
} as CSSProperties;

export function KadaKiosk(): JSX.Element {
  const controller = useKioskController();
  const language = useLanguageStore((s) => s.currentLanguage);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  /*
   * Pin the kiosk to a language KADA actually renders.
   *
   * languageStore is fleet-wide: it hydrates from electron-store and defaults to
   * Korean, which is right for the eight domestic venues and wrong here. A
   * freshly-provisioned W202 would otherwise boot into a language that has no
   * strings on this layout, no artwork for any partner page, and no way to leave
   * — KADA replaces the language SCREEN with a two-state EN/VN pill. English is
   * the fallback rather than Vietnamese because the opening ceremony is a
   * bilingual delegation event and English is the shared language on the signage.
   */
  useEffect(() => {
    if ((KADA_LANGS as readonly string[]).includes(language)) return;
    void setLanguage('en');
  }, [language, setLanguage]);

  /*
   * Where the header's back arrow goes.
   *
   * Back is NOT the same as home here, which is the whole reason this exists:
   * the rail lets a visitor walk AKCF → NIPA → PTIT without passing through
   * home, and on that third page an arrow that jumps to home would throw away
   * two steps they might want to retrace. A ref, not state, because nothing
   * renders from it — `screen` in the kiosk store is what drives the view.
   */
  const history = useRef<KioskScreenId[]>([]);

  const go = useCallback(
    (target: KioskScreenId) => {
      const from = controller.screen;
      if (target === 'home') history.current = [];
      else if (from !== target) history.current.push(from);
      controller.navigate(target);
    },
    [controller],
  );

  const goBack = useCallback(() => {
    const previous = history.current.pop();
    controller.navigate(previous ?? 'home');
  }, [controller]);

  const openPartner = useCallback((partner: KadaPartner) => go(screenForPartner(partner)), [go]);

  const cur = controller.screen;
  const page = kadaPage(cur);

  return (
    <KioskArtboard>
      {controller.photoActive ? (
        <div style={{ position: 'absolute', inset: 0, ...PHOTO_THEME }}>
          <PhotoWorkflow />
        </div>
      ) : page ? (
        // Keyed so switching partners via the rail remounts the page rather than
        // swapping the artwork under a stale scroll/paint of the previous one.
        <KadaImagePage
          key={page.screen}
          page={page}
          onHome={() => go('home')}
          onBack={goBack}
          onPartner={openPartner}
        />
      ) : (
        /* `home`, and anything unrecognised — a kiosk should never dead-end on a
           screen id it does not draw, and KADA has no list/detail screens that
           could legitimately be routed to. */
        <KadaHome onPhoto={controller.startPhoto} onPartner={openPartner} />
      )}
    </KioskArtboard>
  );
}
