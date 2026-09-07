import { useLanguageStore } from '@renderer/store/languageStore';
import { Hotspot } from '@layouts/components/KioskScreenImage';
import { kadaIconUrl } from '@renderer/assets/icons/kada';
import { KadaHeader } from './KadaHeader';
import { KADA, toKadaLang } from './kadaText';
import { KADA_HOME_BADGES, toRect, type KadaPartner } from './kadaPages';
import styles from './KadaHome.module.css';

interface KadaHomeProps {
  /** Opens the K-CULTURE CHALLENGE photo workflow. */
  onPhoto: () => void;
  /** Opens a partner's page — one of the five orbiting badges was tapped. */
  onPartner: (partner: KadaPartner) => void;
}

/**
 * KADA (W202) home — Figma 5403:11277.
 *
 * The screen is one composition rather than a tile grid: a ringed title lock-up
 * over the partner-logo row, the five partner badges orbiting a horizon arc, and
 * a single destination — the K-CULTURE CHALLENGE camera button.
 *
 * Three kinds of layer, and the split is deliberate:
 *   · flattened art   — the page gradient and the whole orbit composition, each
 *                       exported once from Figma (see the CSS for why)
 *   · exported vector — ring, dividers, partner wordmarks, button chrome
 *   · live DOM        — every string, because it has to switch EN ⇄ VN
 * Only that last requirement stops this screen being a single flat image like
 * the four pages behind it; see KadaImagePage for those.
 */
export function KadaHome({ onPhoto, onPartner }: KadaHomeProps): JSX.Element {
  const lang = toKadaLang(useLanguageStore((s) => s.currentLanguage));

  return (
    <div className={styles.screen}>
      <img className={styles.bg} src={kadaIconUrl('bg')} alt="" draggable={false} />

      {/* Both nav controls are inert here: this IS home, and it is the root of
          the hub so the back arrow has nowhere to go. Figma draws them anyway
          (the header is one shared component), and they are kept so the header
          does not visibly reflow between home and the partner pages. */}
      <KadaHeader onHome={() => {}} inertBack />

      {/* ── Title lock-up (Figma 4587:33265 at 215,919) ─────────────────── */}
      <img className={styles.ring} src={kadaIconUrl('ring-outline')} alt="" draggable={false} />

      <p className={styles.eyebrow}>{KADA.eyebrow[lang]}</p>

      <h1 className={styles.title}>
        {KADA.title.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </h1>

      <img className={styles.dividerTop} src={kadaIconUrl('divider')} alt="" draggable={false} />

      <p className={styles.strapline}>
        {KADA.strapline[lang].map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>

      <img className={styles.dividerBottom} src={kadaIconUrl('divider')} alt="" draggable={false} />

      {/* Partner wordmarks, baked art at their Figma boxes (4366:279 … 4366:29523). */}
      <div className={styles.logos}>
        <img
          className={styles.logoAkcf}
          src={kadaIconUrl('logo-akcf')}
          alt="AKCF"
          draggable={false}
        />
        <span className={styles.logoNipa}>
          <img src={kadaIconUrl('logo-nipa-a')} alt="NIPA" draggable={false} />
          <img src={kadaIconUrl('logo-nipa-b')} alt="" draggable={false} />
        </span>
        <img
          className={styles.logoPtit}
          src={kadaIconUrl('logo-ptit')}
          alt="PTIT"
          draggable={false}
        />
        <img
          className={styles.logoSku}
          src={kadaIconUrl('logo-sku')}
          alt="Seokyeong University"
          draggable={false}
        />
        <img
          className={styles.logoWit}
          src={kadaIconUrl('logo-witglobal')}
          alt="WIT Global"
          draggable={false}
        />
      </div>

      {/* ── Orbiting partner badges (Figma 4492:276) ────────────────────── */}
      {/* aria-hidden: the five names this draws (PTIT · AKCF · SKU · NIPA · WIT
          GLOBAL) are painted into the art, and each already reaches a screen
          reader as the alt text of its wordmark in the logo row above —
          announcing them twice is worse than not announcing the decoration. */}
      <img
        className={styles.orbit}
        src={kadaIconUrl('orbit-group')}
        alt=""
        draggable={false}
        aria-hidden="true"
      />

      {/* The five badges are the way into the partner pages. Their rects are the
          discs the composite draws, so each target is exactly the circle the
          visitor sees — see KADA_HOME_BADGES. */}
      {KADA_HOME_BADGES.map((badge) => (
        <Hotspot
          key={badge.partner}
          rect={toRect(badge)}
          label={badge.label}
          onClick={() => onPartner(badge.partner)}
        />
      ))}

      {/* ── The camera ──────────────────────────────────────────────────── */}
      <button
        type="button"
        className={styles.photo}
        onClick={onPhoto}
        aria-label={KADA.a11y.photo[lang]}
      >
        <img
          className={styles.photoRing}
          src={kadaIconUrl('photo-button-bg')}
          alt=""
          draggable={false}
        />
        <img
          className={styles.photoIcon}
          src={kadaIconUrl('ico-camera')}
          alt=""
          draggable={false}
        />
        <span className={styles.photoLabel}>
          {KADA.photoButton[lang].map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      </button>
    </div>
  );
}
