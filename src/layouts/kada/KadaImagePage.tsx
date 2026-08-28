import { useLanguageStore } from '@renderer/store/languageStore';
import { Hotspot, KioskScreenImage } from '@layouts/components/KioskScreenImage';
import { kadaPageUrl } from '@renderer/assets/kada';
import { kadaIconUrl } from '@renderer/assets/icons/kada';
import { KadaHeader } from './KadaHeader';
import { toKadaLang } from './kadaText';
import { toRect, type KadaPage, type KadaPartner } from './kadaPages';
import styles from './KadaImagePage.module.css';

interface KadaImagePageProps {
  page: KadaPage;
  onHome: () => void;
  onBack: () => void;
  onPartner: (partner: KadaPartner) => void;
}

/** Drawn in the header's centre slot on every partner page (Figma 4586:90462). */
const HEADER_TITLE = 'KADA';

/**
 * One KADA (W202) partner page — a full-bleed artwork export, the shared
 * header, and transparent tap targets over the partner rail painted down the
 * left edge.
 *
 * Generic on purpose: the five pages differ only by their row in KADA_PAGES, so
 * adding a partner or re-measuring a rail is a data edit, not a new component.
 */
export function KadaImagePage({
  page,
  onHome,
  onBack,
  onPartner,
}: KadaImagePageProps): JSX.Element {
  const lang = toKadaLang(useLanguageStore((s) => s.currentLanguage));
  const image = kadaPageUrl(page.asset[lang]);

  return (
    <div className={styles.screen}>
      {image ? (
        <KioskScreenImage image={image} alt="">
          {page.rail.map((link) => (
            <Hotspot
              key={link.to}
              rect={toRect(link)}
              label={link.to.toUpperCase()}
              onClick={() => onPartner(link.to)}
            />
          ))}
        </KioskScreenImage>
      ) : (
        /* The artwork for this language has not been exported. Say which file is
           missing rather than shipping a blank screen — the same thing every
           other location's asset resolver does. */
        <div className={styles.missing}>
          <p className={styles.missingTitle}>{page.label}</p>
          <p className={styles.missingHint}>
            Missing artwork
            <br />
            src/renderer/src/assets/kada/{page.asset[lang]}.png
          </p>
        </div>
      )}

      {/* This variant's artwork has no logo bar baked in — see
          KadaPage.missingPartnerBar. Drawn at the same box the other nine
          paint it into, so the page ends the same way they do. */}
      {page.missingPartnerBar?.includes(lang) && kadaIconUrl('partner-bar') && (
        <img
          className={styles.partnerBar}
          src={kadaIconUrl('partner-bar')}
          alt=""
          draggable={false}
        />
      )}

      {/*
        The artwork is exported from the full Figma frame, and SOME of those
        frames have a header baked in while others do not (Page_AKCF hides its
        Component 29; Page_PTIT and Page_WITGLOBAL show theirs). This band paints
        over that top strip so all five pages get the same live header.
        It is safe to cover: on every page the topmost content — the rail arc —
        starts at y≥700, and the page gradient is flat #102135 until y2732, so
        the band is the exact colour it hides.
      */}
      <div className={styles.headerBand} aria-hidden="true" />
      <KadaHeader title={HEADER_TITLE} onHome={onHome} onBack={onBack} />
    </div>
  );
}
