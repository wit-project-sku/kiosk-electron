import { useCallback } from 'react';
import { useLanguageStore } from '@renderer/store/languageStore';
import { usePhotoStore } from '@renderer/store/photoStore';
import { kadaIconUrl } from '@renderer/assets/icons/kada';
import { KADA, KADA_LANGS, toKadaLang } from './kadaText';
import styles from './KadaHeader.module.css';

export interface KadaHeaderProps {
  /**
   * Title for the header's centre slot (Figma's 검색필드).
   *
   * The partner pages pass 'KADA' — that slot holds either a title OR the
   * EN/VN pill, never both, because Figma draws them in the same 1342×182 box:
   * the home frame puts the pill there, every page frame puts the wordmark
   * there. The shared photo workflow also sends one through PhotoHeaderProps,
   * which is why the pill cannot simply live here unconditionally.
   */
  title?: string;
  onHome: () => void;
  /**
   * Omitting this draws NO back arrow — KadaHeader deliberately differs from
   * the other four location headers, which render one unconditionally and fall
   * back to `onHome`. The difference exists so the home screen can show the
   * arrow as decoration (see `inertBack`) rather than as a control, but it also
   * means any screen that forgets to pass this silently loses its back button.
   * If back should simply leave the flow, pass the same handler as `onHome`.
   */
  onBack?: () => void;
  /**
   * Draw the back arrow with nothing behind it.
   *
   * The home screen wants it: Figma's header component always includes the
   * arrow, and the home frame is no exception, but home is the root of the hub
   * so there is nowhere for it to go. Rendered as a plain image rather than a
   * disabled <button> — it is decoration at that point, and a focusable control
   * that does nothing is worse for anyone tabbing or using a screen reader than
   * one that was never announced. Ignored when `onBack` is supplied.
   */
  inertBack?: boolean;
  subtitle?: string;
  /** Grey out and disable 홈/뒤로 — part of the shared PhotoHeaderProps contract. */
  navDisabled?: boolean;
  /**
   * Force-hide the EN/VN pill.
   *
   * Usually unnecessary: the pill hides itself while the photo workflow is
   * running (see below). This is the manual override for a caller that needs it
   * hidden for some other reason.
   */
  hideLanguage?: boolean;
}

/**
 * KADA (W202) header — Figma 5403:11277 (instance 4366:283 + group 4497:4921).
 *
 * Three controls on a 2160×700 band: a gold-filled home button, the EN/VN
 * language pill dead-centre, and an outlined back button. The generic kiosk
 * header component this is an instance of also carries a location pin, a date
 * and a search field; the KADA instance blanks all three, so they are absent
 * here rather than rendered empty.
 */
export function KadaHeader({
  title,
  onHome,
  onBack,
  inertBack = false,
  subtitle,
  navDisabled = false,
  hideLanguage = false,
}: KadaHeaderProps): JSX.Element {
  const current = useLanguageStore((s) => s.currentLanguage);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const lang = toKadaLang(current);

  /*
   * Drop the pill for the duration of a photo session.
   *
   * This is derived rather than passed in because the shared PhotoWorkflow
   * renders this header through the PhotoHeaderProps contract, which has no
   * such field — a prop would simply never arrive. Switching language mid-flow
   * would re-render the capture copy under a visitor who is already posing, and
   * the AR result is generated against the language the session started in.
   */
  const photoActive = usePhotoStore((s) => s.active);
  // The title and the pill compete for the same centre box, so a title wins it.
  const showLanguage = !hideLanguage && !photoActive && !title;

  const select = useCallback(
    (next: (typeof KADA_LANGS)[number]) => {
      if (next === lang) return;
      void setLanguage(next);
    },
    [lang, setLanguage],
  );

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.navBtn}
        style={{ left: 170 }}
        onClick={navDisabled ? undefined : onHome}
        disabled={navDisabled}
        aria-label={KADA.a11y.home[lang]}
      >
        <img src={kadaIconUrl('ico-home')} alt="" draggable={false} />
      </button>

      {title && <p className={styles.title}>{title}</p>}

      {showLanguage && (
        <div className={styles.pill} role="group" aria-label={KADA.a11y.language[lang]}>
          {/* One sliding plate rather than a background per button, so the
              gold never double-draws over the 5px border during the swap. */}
          <span className={styles.pillPlate} data-lang={lang} aria-hidden="true" />
          {KADA_LANGS.map((code) => (
            <button
              key={code}
              type="button"
              className={styles.pillBtn}
              data-active={code === lang}
              onClick={() => select(code)}
              aria-pressed={code === lang}
            >
              {code === 'en' ? 'EN' : 'VN'}
            </button>
          ))}
        </div>
      )}

      {onBack ? (
        <button
          type="button"
          className={styles.navBtn}
          style={{ left: 1815 }}
          onClick={navDisabled ? undefined : onBack}
          disabled={navDisabled}
          aria-label={KADA.a11y.back[lang]}
        >
          <img src={kadaIconUrl('ico-back')} alt="" draggable={false} />
        </button>
      ) : (
        inertBack && (
          <span className={styles.navBtn} style={{ left: 1815 }} aria-hidden="true">
            <img src={kadaIconUrl('ico-back')} alt="" draggable={false} />
          </span>
        )
      )}

      {subtitle && <p className={styles.caption}>{subtitle}</p>}
    </header>
  );
}
