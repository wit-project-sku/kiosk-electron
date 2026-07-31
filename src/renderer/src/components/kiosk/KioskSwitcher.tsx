import { useCallback, useEffect, useRef, useState } from 'react';
import { KIOSK_LOCATIONS, type KioskLocationCode } from '@shared/config/kioskLocations';
import { isOk } from '@shared/types/result';
import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH } from '@layouts/components/KioskScreenImage';
import { useKioskStore } from '@renderer/store/kioskStore';
import { usePhotoStore } from '@renderer/store/photoStore';
import styles from './KioskSwitcher.module.css';

const LOCATIONS = Object.values(KIOSK_LOCATIONS);

/** Hide the revealed drawer handle again after this long without opening it. */
const REVEAL_TIMEOUT_MS = 15_000;

/**
 * In-app kiosk-location switcher — the built-in equivalent of
 * `tools/location-tester`, so a tester can move one build between W001–W005
 * without touching config files.
 *
 * Active ONLY when the app's `.env` carries `DEV_MODE=true` (read in main and
 * delivered via the bootstrap payload) or under `npm run dev`, and only on the
 * home screen with no photo flow running — so it can never overlay a visitor
 * screen on a live kiosk.
 *
 * Nothing is drawn until asked for: tapping the home screen's location pin
 * reveals the drawer handle, and the handle opens the drawer. The handle hides
 * again on the next tap anywhere else, or after {@link REVEAL_TIMEOUT_MS} — but
 * never while the drawer itself is open.
 *
 * Renders inside its own copy of the 2160×3840 artboard, scaled exactly like
 * {@link KioskArtboard}, so 1 CSS px = 1 Figma px here too and the button/drawer
 * sit at kiosk scale instead of tiny OS-sized chrome. It is a SIBLING of the
 * layout (mounted once in App.tsx), so no layout file is touched.
 */
export function KioskSwitcher(): JSX.Element | null {
  const devMode = useKioskStore((s) => s.devMode);
  const screen = useKioskStore((s) => s.screen);
  const currentId = useKioskStore((s) => s.config.kioskId);
  const photoActive = usePhotoStore((s) => s.active);

  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<KioskLocationCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);

  const enabled = devMode || import.meta.env.DEV;
  const visible = enabled && screen === 'home' && !photoActive;

  // Mirror KioskArtboard's uniform fit so this chrome scales with the kiosk.
  useEffect(() => {
    if (!visible) return;
    const el = stageRef.current;
    if (!el) return;
    const update = (): void => {
      const scale = Math.min(
        window.innerWidth / ARTBOARD_WIDTH,
        window.innerHeight / ARTBOARD_HEIGHT,
      );
      el.style.setProperty('--switcher-scale', String(scale));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [visible]);

  // Never leave the drawer open (or the handle showing) behind a content screen
  // or the photo flow.
  useEffect(() => {
    if (!visible) {
      setOpen(false);
      setRevealed(false);
    }
  }, [visible]);

  // The handle is a peek, not a permanent fixture: it disappears again shortly
  // after being revealed so a forgotten tap can't leave it on screen. The timer
  // is suspended while the drawer is open and restarts when it closes.
  useEffect(() => {
    if (!revealed || open) return;
    const id = setTimeout(() => setRevealed(false), REVEAL_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [revealed, open]);

  // Touching anything else also dismisses the handle — the kiosk should go back
  // to looking untouched as soon as attention moves on. Listening on
  // `pointerdown` (not `click`) matters twice: the reveal itself happens on
  // `click`, whose pointerdown has already passed, so this cannot self-close;
  // and it fires before the layout's own tap handlers, so the handle is gone by
  // the time a tile navigates. The handle itself is excluded, or its own
  // pointerdown would dismiss it before the click could open the drawer.
  useEffect(() => {
    if (!revealed || open) return;
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node | null;
      if (target && handleRef.current?.contains(target)) return;
      setRevealed(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [revealed, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const select = useCallback(
    (code: KioskLocationCode) => {
      if (code === currentId || switching) return;
      setError(null);
      setSwitching(code);
      // Packaged builds relaunch, so this promise never settles; in dev the app
      // reloads in place and resolves, which just closes the drawer.
      void window.api.kiosk.switchLocation(code).then(
        (result) => {
          if (isOk(result)) {
            setOpen(false);
            setSwitching(null);
          } else {
            setError(result.error.message);
            setSwitching(null);
          }
        },
        (e: unknown) => {
          setError(e instanceof Error ? e.message : '전환에 실패했습니다.');
          setSwitching(null);
        },
      );
    },
    [currentId, switching],
  );

  if (!visible) return null;

  return (
    <div className={styles.root}>
      <div ref={stageRef} className={styles.stage}>
        {/* Invisible reveal hotspot over the home screen's location pin. Every
            layout draws that pin at the same artboard spot (x170, in the 82px
            row at y130) and it is static decoration in all of them — Insadong's
            <MapPin>, Osan's location-pin.svg, Hwaseong's inline SVG — so
            covering it steals no existing tap target. */}
        <button
          type="button"
          className={styles.revealHotspot}
          onClick={() => setRevealed(true)}
          aria-label="키오스크 전환 메뉴 표시 (DEV)"
          tabIndex={-1}
        />

        {revealed && (
          <button
            ref={handleRef}
            type="button"
            className={styles.trigger}
            onClick={() => setOpen(true)}
            aria-label="키오스크 위치 전환 (DEV)"
          >
            <i />
            <i />
            <i />
          </button>
        )}

        {open && (
          <div className={styles.backdrop} onClick={() => setOpen(false)} role="presentation">
            <aside
              className={styles.drawer}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="키오스크 위치 선택"
            >
              <header className={styles.head}>
                <div>
                  <h2 className={styles.title}>키오스크 전환</h2>
                  <p className={styles.sub}>선택하면 해당 키오스크로 자동 재시작됩니다.</p>
                </div>
                <button
                  type="button"
                  className={styles.close}
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                >
                  ✕
                </button>
              </header>

              <ul className={styles.list}>
                {LOCATIONS.map((loc) => {
                  const isCurrent = loc.code === currentId;
                  return (
                    <li key={loc.code}>
                      <button
                        type="button"
                        className={`${styles.item} ${isCurrent ? styles.itemCurrent : ''}`}
                        onClick={() => select(loc.code)}
                        disabled={isCurrent || switching !== null}
                      >
                        <span className={styles.code}>{loc.code}</span>
                        <span className={styles.meta}>
                          <span className={styles.name}>{loc.name}</span>
                          <span className={styles.layout}>
                            {loc.layout}
                            {loc.hasCardTerminal ? ' · 카드단말기' : ''}
                            {loc.hasDonation ? ' · 기부' : ''}
                          </span>
                        </span>
                        <span className={styles.state}>
                          {isCurrent ? '현재' : switching === loc.code ? '재시작 중…' : '전환'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {error && <p className={styles.error}>{error}</p>}

              <footer className={styles.foot}>DEV_MODE=true (.env) 일 때만 표시됩니다.</footer>
            </aside>
          </div>
        )}

        {switching && (
          <div className={styles.restarting} role="status">
            <div className={styles.spinner} aria-hidden="true" />
            <p>{KIOSK_LOCATIONS[switching]?.name} 으로 전환 중…</p>
          </div>
        )}
      </div>
    </div>
  );
}
