import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useLang } from '@renderer/lib/i18n';
import { ui } from '@renderer/lib/uiText';
import { useExchangeStore } from '@renderer/store/exchangeStore';
import jpnFlag from '@renderer/assets/photos/insadong/exchange/jpn.svg';
import usaFlag from '@renderer/assets/photos/insadong/exchange/usa.svg';
import chyFlag from '@renderer/assets/photos/insadong/exchange/chy.svg';
import eurFlag from '@renderer/assets/photos/insadong/exchange/eur.svg';
import gbpFlag from '@renderer/assets/photos/insadong/exchange/gbp.svg';
import cadFlag from '@renderer/assets/photos/insadong/exchange/cad.svg';
import hkgFlag from '@renderer/assets/photos/insadong/exchange/hkg.svg';
import thbFlag from '@renderer/assets/photos/insadong/exchange/thb.svg';
import sarFlag from '@renderer/assets/photos/insadong/exchange/sar.svg';
import { InsadongHeader } from './InsadongHeader';
import styles from './InsadongExchange.module.css';

/** Currencies to show → API `cur_unit` + flag asset + display label. */
const DISPLAY = [
  { unit: 'JPY(100)', label: 'JPN (100¥)', flag: jpnFlag },
  { unit: 'USD', label: 'USA (1$)', flag: usaFlag },
  { unit: 'EUR', label: 'EUR (1€)', flag: eurFlag },
  { unit: 'CNH', label: 'CHY (1¥)', flag: chyFlag },
  { unit: 'GBP', label: 'GBP (1£)', flag: gbpFlag },
  { unit: 'CAD', label: 'CAD (1$)', flag: cadFlag },
  { unit: 'HKD', label: 'HKD (1$)', flag: hkgFlag },
  { unit: 'THB', label: 'THB (1฿)', flag: thbFlag },
  { unit: 'SAR', label: 'SAR (1﷼)', flag: sarFlag },
];

interface InsadongExchangeProps {
  controller: KioskController;
  debug?: boolean;
}

/** 환율 — live currency rates from the Korea Eximbank API (cached in main). */
export function InsadongExchange({ controller }: InsadongExchangeProps): JSX.Element {
  const banner = useRotatingBanner();
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  const exchange = useExchangeStore((s) => s.exchange);
  const won = ui('won', lang);

  const rows = DISPLAY.map((d) => {
    const match = exchange?.rates.find((r) => r.code === d.unit);
    return { ...d, rateText: match ? `${match.rateText}${won}` : '—' };
  });

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="환율" onHome={goHome} />

      <div className={styles.results}>
        <div className={styles.list}>
          {rows.map((c) => (
            <div key={c.unit} className={styles.row}>
              <div className={styles.left}>
                <img className={styles.flag} src={c.flag} alt="" draggable={false} />
                <span className={styles.label}>{c.label}</span>
              </div>
              <span className={styles.rate}>{c.rateText}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      {banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
