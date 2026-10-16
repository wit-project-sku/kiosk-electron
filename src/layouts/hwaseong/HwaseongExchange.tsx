import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useLang, type Lang } from '@renderer/lib/i18n';
import { ui } from '@renderer/lib/uiText';
import { useExchangeStore } from '@renderer/store/exchangeStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import type { ExchangeSnapshot } from '@shared/types/exchange';
import jpnFlag from '@renderer/assets/photos/insadong/exchange/jpn.svg';
import usaFlag from '@renderer/assets/photos/insadong/exchange/usa.svg';
import chyFlag from '@renderer/assets/photos/insadong/exchange/chy.svg';
import eurFlag from '@renderer/assets/photos/insadong/exchange/eur.svg';
import gbpFlag from '@renderer/assets/photos/insadong/exchange/gbp.svg';
import cadFlag from '@renderer/assets/photos/insadong/exchange/cad.svg';
import hkgFlag from '@renderer/assets/photos/insadong/exchange/hkg.svg';
import thbFlag from '@renderer/assets/photos/insadong/exchange/thb.svg';
import sarFlag from '@renderer/assets/photos/insadong/exchange/sar.svg';
import swapIcon from '@renderer/assets/photos/hwaseong/exchange/exchange-swap.svg';
import pickerPanel from '@renderer/assets/photos/hwaseong/exchange/exchange-picker-panel.svg';
import krwGroup from '@renderer/assets/photos/osan/exchange/krw-group.svg';
import krwVector from '@renderer/assets/photos/osan/exchange/krw-vector.svg';
import krwVector1 from '@renderer/assets/photos/osan/exchange/krw-vector1.svg';
import krwVector2 from '@renderer/assets/photos/osan/exchange/krw-vector2.svg';
import krwMask from '@renderer/assets/photos/osan/exchange/krw-mask.svg?url';
import krwImage from '@renderer/assets/photos/osan/exchange/krw-image.png';
import backspaceIcon from '@renderer/assets/photos/osan/exchange/keypad-backspace.svg';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import styles from './HwaseongExchange.module.css';

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

/** Calculator currencies: every rate above plus KRW (the won is the base of every conversion). */
interface Currency {
  code: string;
  /** API unit (e.g. "JPY(100)"); KRW has none. */
  unit: string | null;
  /** Units per quoted rate (JPY(100) → 100). */
  unitCount: number;
  flag: string | null;
}

const CURRENCIES: Currency[] = [
  ...DISPLAY.map((d) => ({
    code: d.unit.replace(/\(\d+\)/, ''),
    unit: d.unit,
    unitCount: Number(d.unit.match(/\((\d+)\)/)?.[1] ?? 1),
    flag: d.flag,
  })),
  { code: 'KRW', unit: null, unitCount: 1, flag: null },
];
const KRW_INDEX = CURRENCIES.length - 1;
/** The calculator opens on USD → KRW (the rate visitors ask for most). */
const USD_INDEX = Math.max(0, CURRENCIES.findIndex((c) => c.code === 'USD'));

/** Keypad (7956:78689) — the last row holds 0 (under key 2) and ⌫ (under key 3). */
const KEYPAD: (string | null)[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'back'],
];

const MAX_DIGITS = 9;

/** `26.08.30. 19:30 기준` from the snapshot's fetch time (local clock). */
function formatStamp(snapshot: ExchangeSnapshot | null, lang: Lang): string {
  if (!snapshot) return '';
  const d = new Date(snapshot.fetchedAt);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number): string => String(n).padStart(2, '0');
  const t = `${p(d.getFullYear() % 100)}.${p(d.getMonth() + 1)}.${p(d.getDate())}. ${p(d.getHours())}:${p(d.getMinutes())}`;
  return ui('exchangeAsOf', lang).replace('{t}', t);
}

/** KRW flag — Figma 7956:78635 composite: circle pieces plus the masked photo. */
function KrwFlag(): JSX.Element {
  return (
    <div className={styles.krwFlag}>
      <img className={styles.krwPiece} src={krwGroup} alt="" draggable={false} style={{ left: 0, top: 0, width: 169.991, height: 169.992 }} />
      <img className={styles.krwPiece} src={krwVector} alt="" draggable={false} style={{ left: 92.64, top: 0.35, width: 77.365, height: 169.297 }} />
      <img className={styles.krwPiece} src={krwVector1} alt="" draggable={false} style={{ left: 0, top: 0, width: 118.862, height: 169.997 }} />
      <img className={styles.krwPiece} src={krwVector2} alt="" draggable={false} style={{ left: 53.69, top: 53.69, width: 62.626, height: 62.626 }} />
      <div className={styles.krwMask} style={{ maskImage: `url("${krwMask}")`, WebkitMaskImage: `url("${krwMask}")` }}>
        <img src={krwImage} alt="" draggable={false} />
      </div>
    </div>
  );
}

/** A currency's flag at its flag size: the KRW composite or the currency's SVG. */
function CurrencyFlag({ c, className }: { c: Currency; className?: string }): JSX.Element {
  return c.flag === null ? <KrwFlag /> : <img className={className} src={c.flag} alt="" draggable={false} />;
}

interface HwaseongExchangeProps {
  controller: KioskController;
}

/**
 * 환율 — Figma 7956:78337 (실시간 환율), 7956:78606 (환율계산기), 78689 (keypad
 * open), 78806 (currency picker open). The frames are 오산's 환율 in 화성 main 1
 * / main 2, so this is the 오산 page without its ♿ layout. Rates come from the
 * Korea Eximbank snapshot (same as insadong).
 */
export function HwaseongExchange({ controller }: HwaseongExchangeProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  const exchange = useExchangeStore((s) => s.exchange);
  const won = ui('won', lang);
  const stamp = formatStamp(exchange, lang);
  const banner = hwaseongIconUrl('banner-search');

  const [view, setView] = useState<'live' | 'calc'>('live');
  const [fromIndex, setFromIndex] = useState(USD_INDEX);
  const [toIndex, setToIndex] = useState(KRW_INDEX);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  /* Empty until the visitor types: the field shows the placeholder (as on
     인사동 / 제주) instead of a pre-filled 1000. */
  const [amount, setAmount] = useState('');
  const [keypadOpen, setKeypadOpen] = useState(false);

  const rows = DISPLAY.map((d) => {
    const match = exchange?.rates.find((r) => r.code === d.unit);
    return { ...d, rateText: match ? `${match.rateText}${won}` : '—' };
  });

  /* KRW per one unit of a currency; null until the snapshot has its rate. */
  const krwPerUnit = (c: Currency): number | null => {
    if (c.unit === null) return 1;
    const match = exchange?.rates.find((r) => r.code === c.unit);
    return match ? match.rate / c.unitCount : null;
  };

  const from = CURRENCIES[fromIndex]!;
  const to = CURRENCIES[toIndex]!;
  const rFrom = krwPerUnit(from);
  const rTo = krwPerUnit(to);
  const amountNum = Number(amount) || 0;
  const resultNum = rFrom !== null && rTo !== null ? (amountNum * rFrom) / rTo : null;
  const resultText =
    resultNum === null ? '—' : resultNum.toLocaleString('en-US', { maximumFractionDigits: to.unit === null ? 0 : 2 });
  const baseText =
    rFrom !== null && rTo !== null
      ? `1 ${from.code} = ${(rFrom / rTo).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${to.code}`
      : '—';

  const press = (key: string): void => {
    if (key === 'back') {
      setAmount((a) => a.slice(0, -1));
      return;
    }
    setAmount((a) => ((a === '0' ? key : a + key).slice(0, MAX_DIGITS)));
  };

  const choose = (index: number): void => {
    if (picker === 'from') setFromIndex(index);
    else setToIndex(index);
    setPicker(null);
  };

  /*
   * ♿ (실시간 환율 7956:78078; 환율계산기 7956:77643, keypad 77718, picker
   * 77933): the page keeps HwaseongKiosk's shift and the two tabs drop to the
   * foot (3438). 실시간 has no promo and its rows start at 856; 계산기 brings the
   * promo up to 146 and the header to 719, and its fields move down by that 573
   * (amount 1954, result 2570) — the same marks as 오산's ♿ 환율.
   */
  const low = useAccessibilityStore((st) => st.lowReach);
  const calcLow = low && view === 'calc';
  const header = <HwaseongHeader controller={controller} title="환율" onHome={goHome} />;

  return (
    <div className={low ? `${styles.root} ${styles.low}` : styles.root}>
      <HwaseongPageBg />

      {calcLow ? <div className={styles.lowHeader}>{header}</div> : header}

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${view === 'live' ? styles.tabSelected : ''}`}
          onClick={() => setView('live')}
        >
          {ui('exchangeTabLive', lang)}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${view === 'calc' ? styles.tabSelected : ''}`}
          onClick={() => setView('calc')}
        >
          {ui('exchangeTabCalc', lang)}
        </button>
      </div>

      {view === 'live' ? (
        <>
          <p className={styles.stamp}>{stamp}</p>
          <div className={styles.listClip}>
            <div className={styles.list}>
              {rows.map((c) => (
                <div key={c.unit} className={styles.row}>
                  <div className={styles.left}>
                    <img className={styles.flag} src={c.flag} alt="" draggable={false} />
                    <span className={styles.label}>{c.label}</span>
                  </div>
                  <span className={`${styles.rate} ${lang !== 'ko' ? styles.rateLong : ''}`}>{c.rateText}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className={calcLow ? styles.calcLow : styles.calcStd}>
          <div className={styles.baseBox}>
            <p className={styles.baseTitle}>{ui('exchangeBaseRate', lang)}</p>
            <p className={styles.baseRate}>{baseText}</p>
          </div>
          <p className={styles.stamp} style={{ top: 1204, right: 893 }}>
            {stamp}
          </p>

          <p className={styles.fieldLabel} style={{ top: 1244 }}>
            {ui('exchangeAmountLabel', lang)}
          </p>
          <div className={`${styles.field} ${styles.fieldAmount}`} style={{ top: 1381 }} onClick={() => setKeypadOpen(true)}>
            {amount === '' ? (
              <span className={`${styles.fieldValue} ${styles.fieldPlaceholder}`}>{ui('exchangeAmountPlaceholder', lang)}</span>
            ) : (
              <span className={styles.fieldValue}>{amountNum.toLocaleString('en-US')}</span>
            )}
            <button
              type="button"
              className={styles.fieldCurBtn}
              onClick={(e) => {
                e.stopPropagation();
                setKeypadOpen(false);
                setPicker('from');
              }}
            >
              <CurrencyFlag c={from} className={styles.fieldCurFlag} />
              <span className={styles.fieldCurLabel}>{from.code}</span>
              <span className={styles.fieldChevron}>▼</span>
            </button>
          </div>

          <button
            type="button"
            className={styles.swap}
            onClick={() => {
              setFromIndex(toIndex);
              setToIndex(fromIndex);
            }}
            aria-label="통화 바꾸기"
          >
            <img src={swapIcon} alt="" draggable={false} />
          </button>

          <p className={styles.fieldLabel} style={{ top: 1855 }}>
            {ui('exchangeResultLabel', lang)}
          </p>
          <div className={`${styles.field} ${styles.fieldResult}`}>
            {amount === '' ? (
              <span className={`${styles.fieldValue} ${styles.fieldPlaceholder}`}>{ui('exchangeResultPlaceholder', lang)}</span>
            ) : (
              <span className={styles.fieldValue}>{resultText}</span>
            )}
            <button
              type="button"
              className={styles.fieldCurBtn}
              onClick={() => {
                setKeypadOpen(false);
                setPicker('to');
              }}
            >
              <CurrencyFlag c={to} className={styles.fieldCurFlag} />
              <span className={styles.fieldCurLabel}>{to.code}</span>
              <span className={styles.fieldChevron}>▼</span>
            </button>
          </div>

          {picker !== null && (
            <>
              <div className={styles.pickerBackdrop} onClick={() => setPicker(null)} aria-hidden />
              <div className={styles.picker} style={{ top: picker === 'from' ? 1378 : 1997 }}>
                <img className={styles.pickerPanel} src={pickerPanel} alt="" draggable={false} />
                <div className={styles.pickerList}>
                  {CURRENCIES.map((c, i) => (
                    <button key={c.code} type="button" className={styles.pickerItem} onClick={() => choose(i)}>
                      <span className={styles.pickerFlagWrap}>
                        <CurrencyFlag c={c} className={styles.pickerFlag} />
                      </span>
                      <span className={styles.pickerLabel}>{c.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {keypadOpen && (
            <>
          <div className={styles.keypadBackdrop} onClick={() => setKeypadOpen(false)} aria-hidden />
          <div className={styles.keypad}>
            {KEYPAD.map((row, r) => (
              <div key={r} className={`${styles.keyRow} ${r === KEYPAD.length - 1 ? styles.keyRowLast : ''}`}>
                {row.map((k, i) =>
                  k === null ? null : k === 'back' ? (
                    <button
                      key={i}
                      type="button"
                      className={`${styles.key} ${styles.keyBackspace}`}
                      onClick={() => press(k)}
                      aria-label="지우기"
                    >
                      <img className={styles.keyBackspaceImg} src={backspaceIcon} alt="" draggable={false} />
                    </button>
                  ) : (
                    <button key={i} type="button" className={styles.key} onClick={() => press(k)}>
                      {k}
                    </button>
                  ),
                )}
              </div>
            ))}
          </div>
            </>
          )}
        </div>
      )}

      {/* The 상점 검색 promo (orange strip) — opens 검색. ♿: 실시간 draws none;
          계산기 lifts it to 146 (3267 − 3121). */}
      {banner && !(low && !calcLow) && (
        <div className={calcLow ? styles.bannerLow : styles.contents}>
        <button
          type="button"
          className={styles.banner}
          onClick={() => controller.navigate('search', '검색')}
          aria-label={ui('searchShops', lang)}
        >
          <img src={banner} alt="" draggable={false} />
        </button>
        </div>
      )}

      <HwaseongLeftNav onHome={goHome} />
    </div>
  );
}
