/**
 * 제주공항 (W006) 환율 — Figma 제주>환율-나라선택01, the 2026-08-24 redraw:
 * 6412:76217 (calculator), 6412:76438 (keyboard open), 6412:76521 / 6412:76726
 * (currency dropdown on the top / bottom field) and 6219:99645 (실시간 환율).
 * The 베리어프리 (♿) half follows the newer 2026-08-27 frames — 6326:84606,
 * 6460:117343, 6460:117395, 6460:118038 and 6460:117849.
 *
 * One screen, two tabs — 실시간 환율 on the left and open by default, 환율계산기
 * on the right:
 *   실시간 환율  the same read-only rate list the other three layouts already
 *                ship (identical row: white pill, 170 flag, 60px label/rate)
 *   환율계산기   amount + currency → converted amount, with a numeric keypad and
 *                a currency dropdown per field
 *
 * The keypad and the two dropdowns are mutually exclusive overlays — opening one
 * closes the others, and a tap anywhere else closes all of them.
 *
 * ── Rate maths ────────────────────────────────────────────────────────
 * `ExchangeRate.rate` is 매매기준율 in KRW per `unitSize` units, and the unit is
 * baked into the Eximbank code: `JPY(100)` and `IDR(100)` are quoted per 100,
 * everything else per 1. KRW is NOT in the feed at all, so it is synthesized
 * with rate 1. Getting this wrong is a silent 100× error, so all conversion
 * goes through `krwPerUnit` and nothing else divides.
 */
import { useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useExchangeStore } from '@renderer/store/exchangeStore';
import { pick, useLang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import type { Lang } from '@renderer/lib/i18n';
import korFlag from '@renderer/assets/photos/insadong/exchange/kor.png';
import jpnFlag from '@renderer/assets/photos/insadong/exchange/jpn.svg';
import usaFlag from '@renderer/assets/photos/insadong/exchange/usa.svg';
import eurFlag from '@renderer/assets/photos/insadong/exchange/eur.svg';
import chyFlag from '@renderer/assets/photos/insadong/exchange/chy.svg';
import gbpFlag from '@renderer/assets/photos/insadong/exchange/gbp.svg';
import cadFlag from '@renderer/assets/photos/insadong/exchange/cad.svg';
import hkgFlag from '@renderer/assets/photos/insadong/exchange/hkg.svg';
import thbFlag from '@renderer/assets/photos/insadong/exchange/thb.svg';
import sarFlag from '@renderer/assets/photos/insadong/exchange/sar.svg';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuExchange.module.css';

interface Props {
  controller: KioskController;
}

type TabId = 'calc' | 'live';
/** Which field's dropdown is open, if any. */
type Picker = 'from' | 'to' | null;

interface Currency {
  /** Eximbank `cur_unit` — the key into `ExchangeSnapshot.rates`. */
  unit: string;
  /** Code shown beside the flag in the calculator (Figma: "JPY", "KRW"). */
  ccy: string;
  /** Row label in the 실시간 환율 list (Figma: "JPN (100¥)"). */
  label: string;
  flag: string;
}

/**
 * The nine currencies the other layouts already list, plus KRW for the
 * calculator. Order matches those screens so a visitor sees the same list
 * everywhere. Codes are Eximbank's, NOT ISO — Chinese yuan is `CNH`.
 */
const CURRENCIES: Currency[] = [
  { unit: 'KRW',      ccy: 'KRW', label: 'KOR (1₩)',   flag: korFlag },
  { unit: 'JPY(100)', ccy: 'JPY', label: 'JPN (100¥)', flag: jpnFlag },
  { unit: 'USD',      ccy: 'USD', label: 'USA (1$)',   flag: usaFlag },
  { unit: 'EUR',      ccy: 'EUR', label: 'EUR (1€)',   flag: eurFlag },
  { unit: 'CNH',      ccy: 'CNY', label: 'CHY (1¥)',   flag: chyFlag },
  { unit: 'GBP',      ccy: 'GBP', label: 'GBP (1£)',   flag: gbpFlag },
  { unit: 'CAD',      ccy: 'CAD', label: 'CAD (1$)',   flag: cadFlag },
  { unit: 'HKD',      ccy: 'HKD', label: 'HKD (1$)',   flag: hkgFlag },
  { unit: 'THB',      ccy: 'THB', label: 'THB (1฿)',   flag: thbFlag },
  { unit: 'SAR',      ccy: 'SAR', label: 'SAR (1﷼)',   flag: sarFlag },
];

const byUnit = (unit: string): Currency =>
  CURRENCIES.find((c) => c.unit === unit) ?? (CURRENCIES[0] as Currency);

/**
 * Row order IS the drawn order — .tabs is a two-up flex row with no per-tab
 * positioning — and the first entry is also the tab the page opens on (see
 * `tab`'s initial state). 실시간 환율 leads: it is the read-only view, so it is
 * what a visitor who only wants to glance at a rate needs, and the calculator
 * is one tap away for the visitor who wants to do something.
 */
const TABS: ReadonlyArray<{ id: TabId; key: string; label: Partial<Record<Lang, string>> }> = [
  {
    id: 'live',
    key: 'Exchange_tab_2',
    label: {
      ko: '실시간 환율', en: 'Live Rates', ja: 'リアルタイム為替', zh: '实时汇率',
      vi: 'Tỷ giá trực tiếp', th: 'อัตราเรียลไทม์', ru: 'Курсы валют', id: 'Kurs Terkini',
    },
  },
  {
    id: 'calc',
    key: 'Exchange_tab_1',
    label: {
      // Written closed-up in the design (6412:76320), not "환율 계산기" — which
      // IS how the sheet spells it, and the sheet wins. Kept as the fallback.
      ko: '환율계산기', en: 'Converter', ja: '為替計算機', zh: '汇率计算器',
      vi: 'Máy tính tỷ giá', th: 'เครื่องคำนวณ', ru: 'Калькулятор', id: 'Kalkulator',
    },
  },
];

const AMOUNT_LABEL = {
  ko: '금액:', en: 'Amount:', ja: '金額:', zh: '金额:',
  vi: 'Số tiền:', th: 'จำนวนเงิน:', ru: 'Сумма:', id: 'Jumlah:',
};

const RESULT_LABEL = {
  ko: '환전:', en: 'Converted:', ja: '換算:', zh: '兑换:',
  vi: 'Quy đổi:', th: 'แลกเปลี่ยน:', ru: 'Обмен:', id: 'Konversi:',
};

/**
 * Localized sheet string with the authored table behind it — the same
 * `sheetText` contract JejuHome and JejuAbout use, so an operator edit reaches
 * the kiosk on the next night sync with no rebuild.
 *
 * Wired 2026-08-27: Localization_Jeju has carried `Exchange_tab_1` / `_tab_2` /
 * `_desc_1` in all eight languages for a while and this screen was reading none
 * of them. `Exchange_desc_2` (금액) and `_desc_3` (환전) are deliberately NOT
 * wired: the design's labels end in a colon the sheet does not store, and the
 * sheet's English is lower-cased mid-sentence prose ("amount", "currency
 * exchange") rather than a field label.
 */
const exchangeText = (key: string, lang: Lang, fallback: Partial<Record<Lang, string>>): string =>
  sheetText(key, lang, fallback);

const BASE_LABEL = {
  ko: '기준 환율', en: 'Base rate', ja: '基準為替レート', zh: '基准汇率',
  vi: 'Tỷ giá cơ sở', th: 'อัตราอ้างอิง', ru: 'Базовый курс', id: 'Kurs dasar',
};

/** When the snapshot was fetched — `{t}` is the `26.08.30. 19:30` stamp. */
const AS_OF = {
  ko: '{t} 기준', en: 'As of {t}', ja: '{t} 基準', zh: '{t} 基准',
  vi: 'Tính đến {t}', th: 'ณ {t}', ru: 'на {t}', id: 'Per {t}',
};

/** The 원 suffix on the live list, matching HwaseongExchange. */
const WON = {
  ko: '원', en: ' KRW', ja: 'ウォン', zh: '韩元',
  vi: ' KRW', th: ' KRW', ru: ' KRW', id: ' KRW',
};

const NO_RATES = {
  ko: '환율 정보를 불러오지 못했습니다.\n잠시 후 다시 시도해주세요.',
  en: 'Exchange rates are unavailable.\nPlease try again shortly.',
  ja: '為替レートを取得できませんでした。\nしばらくしてからお試しください。',
  zh: '暂时无法获取汇率。\n请稍后再试。',
  vi: 'Không tải được tỷ giá.\nVui lòng thử lại sau.',
  th: 'ไม่สามารถโหลดอัตราแลกเปลี่ยนได้\nโปรดลองอีกครั้ง',
  ru: 'Курсы валют недоступны.\nПопробуйте позже.',
  id: 'Kurs tidak tersedia.\nSilakan coba lagi nanti.',
};

/** Eximbank bakes the quote size into the code: `JPY(100)` is per 100 yen. */
function unitSize(unit: string): number {
  return /\(100\)/.test(unit) ? 100 : 1;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Group digits for display. `''` shows as `0`, matching an empty kiosk field. */
function groupDigits(digits: string): string {
  const n = Number(digits || '0');
  return n.toLocaleString('en-US');
}

/** Trim to at most 2 decimals, then group — 1,460,150 / 0.72 / 9.19. */
function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * `fetchedAt` → the design's `26.08.30. 19:30`. Hand-formatted rather than
 * `toLocaleString`: the frame draws a fixed two-digit-year shape, and the kiosk
 * renders eight languages that would each format it differently.
 */
function formatFetchedAt(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(d.getFullYear() % 100)}.${p(d.getMonth() + 1)}.${p(d.getDate())}. ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function JejuExchange({ controller }: Props): JSX.Element {
  const lang = useLang();
  const exchange = useExchangeStore((s) => s.exchange);

  /** Opens on 실시간 환율, the left-hand tab — see TABS. */
  const [tab, setTab] = useState<TabId>('live');
  const [fromUnit, setFromUnit] = useState('USD');
  const [toUnit, setToUnit] = useState('KRW');
  const [digits, setDigits] = useState('1000');
  const [picker, setPicker] = useState<Picker>(null);
  const [keypad, setKeypad] = useState(false);

  /**
   * KRW per ONE unit of `unit`. The single place the (100) quote size is
   * divided out; `undefined` when the feed has no row for that currency.
   */
  const krwPerUnit = useMemo(() => {
    return (unit: string): number | undefined => {
      if (unit === 'KRW') return 1;
      const row = exchange?.rates.find((r) => r.code === unit);
      if (!row || !Number.isFinite(row.rate) || row.rate <= 0) return undefined;
      return row.rate / unitSize(unit);
    };
  }, [exchange]);

  const from = byUnit(fromUnit);
  const to = byUnit(toUnit);
  const fromRate = krwPerUnit(fromUnit);
  const toRate = krwPerUnit(toUnit);

  const convert = (value: number): number | undefined =>
    fromRate !== undefined && toRate !== undefined ? (value * fromRate) / toRate : undefined;

  const amount = Number(digits || '0');
  const result = convert(amount);
  const oneUnit = convert(1);

  const closeOverlays = (): void => {
    setPicker(null);
    setKeypad(false);
  };

  const openKeypad = (): void => {
    setPicker(null);
    setKeypad(true);
  };

  const openPicker = (which: Exclude<Picker, null>): void => {
    setKeypad(false);
    setPicker((cur) => (cur === which ? null : which));
  };

  const chooseCurrency = (unit: string): void => {
    if (picker === 'from') setFromUnit(unit);
    else if (picker === 'to') setToUnit(unit);
    setPicker(null);
  };

  const pressKey = (key: string): void => {
    // Cap the entry so a leaned-on key can't overflow the 1050px value slot.
    setDigits((d) => (d.replace(/^0+/, '') + key).slice(0, 12));
  };

  const backspace = (): void => setDigits((d) => d.slice(0, -1));

  /** Swap the two currencies; the typed amount stays as typed. */
  const swap = (): void => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
    closeOverlays();
  };

  const liveRows = CURRENCIES.filter((c) => c.unit !== 'KRW').map((c) => {
    const row = exchange?.rates.find((r) => r.code === c.unit);
    return { ...c, rateText: row ? `${row.rateText}${pick(WON, lang)}` : '—' };
  });

  const overlayOpen = keypad || picker !== null;

  /*
   * Low-reach: the whole calculator block rides one shift (see .rootLow), and
   * everything else is a per-element class. The two tabs take DIFFERENT frame
   * shapes — 실시간 환율 drops the promo banner and starts its header at y116 so
   * the rate list gets the banner's height, while 환율계산기 keeps the banner
   * under the mode bar and starts at y686. See the .rootLow comment block.
   */
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const lowShift = lowReach ? styles.rootLow : '';
  const asOf = formatFetchedAt(exchange?.fetchedAt);

  return (
    <JejuPageFrame
      controller={controller}
      title="환율"
      onBack={() => controller.navigate('home', '뒤로')}
      lowReachModeBar
      lowReachBarBanner={tab === 'calc'}
      lowReachShift={tab === 'calc' ? 686 : 116}
    >
      <div className={lowShift}>
      <div className={`${styles.tabs} ${lowReach ? styles.tabsLow : ''}`}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            aria-pressed={tab === t.id}
            onClick={() => {
              closeOverlays();
              setTab(t.id);
            }}
          >
            {exchangeText(t.key, lang, t.label)}
          </button>
        ))}
      </div>

      {tab === 'calc' ? (
        <>
          <div className={`${styles.basePill} ${lowReach ? styles.basePillLow : ''}`}>
            <span className={styles.basePillLabel}>
              {exchangeText('Exchange_desc_1', lang, BASE_LABEL)}
            </span>
            <span className={styles.basePillRate}>
              {oneUnit === undefined
                ? `1 ${from.ccy} = — ${to.ccy}`
                : `1 ${from.ccy} = ${formatAmount(oneUnit)} ${to.ccy}`}
            </span>
            {asOf !== undefined && (
              <span className={styles.basePillStamp}>{pick(AS_OF, lang).replace('{t}', asOf)}</span>
            )}
          </div>

          {/* Closes whichever overlay is open. Sits under them, over everything
              else, so the fields below can't be tapped through it. */}
          {overlayOpen && (
            <button type="button" className={styles.backdrop} aria-label="닫기" onClick={closeOverlays} />
          )}

          {/* ── 금액 ── */}
          <p className={`${styles.fieldLabel} ${styles.labelAmount}`}>{pick(AMOUNT_LABEL, lang)}</p>
          <button
            type="button"
            className={`${styles.field} ${styles.fieldAmount}`}
            onClick={openKeypad}
            aria-label={pick(AMOUNT_LABEL, lang)}
          />
          <p className={`${styles.value} ${styles.valueAmount}`}>
            {groupDigits(digits)}
            {keypad && <span className={styles.caretBar} />}
          </p>
          <button
            type="button"
            className={`${styles.ccyBtn} ${styles.ccyAmount}`}
            onClick={() => openPicker('from')}
          >
            <img src={from.flag} alt="" className={styles.ccyFlag} draggable={false} />
            <span className={styles.ccyCode}>{from.ccy}</span>
          </button>
          <p className={`${styles.caret} ${styles.caretAmount}`}>▼</p>

          <button type="button" className={styles.swap} onClick={swap} aria-label="통화 바꾸기">
            {jejuIconUrl('ico-swap') && (
              <img src={jejuIconUrl('ico-swap')} alt="" className={styles.swapImg} draggable={false} />
            )}
          </button>

          {/* ── 환전 ── */}
          <p className={`${styles.fieldLabel} ${styles.labelResult}`}>{pick(RESULT_LABEL, lang)}</p>
          <div className={`${styles.field} ${styles.fieldResult}`} />
          <p className={`${styles.value} ${styles.valueResult}`}>
            {result === undefined ? '—' : formatAmount(result)}
          </p>
          <button
            type="button"
            className={`${styles.ccyBtn} ${styles.ccyResult}`}
            onClick={() => openPicker('to')}
          >
            <img src={to.flag} alt="" className={styles.ccyFlag} draggable={false} />
            <span className={styles.ccyCode}>{to.ccy}</span>
          </button>
          <p className={`${styles.caret} ${styles.caretResult}`}>▼</p>

          {picker !== null && (
            <div
              className={`${styles.dropdown} ${picker === 'from' ? styles.dropdownAmount : styles.dropdownResult}`}
            >
              {CURRENCIES.map((c) => (
                <button
                  key={c.unit}
                  type="button"
                  className={styles.option}
                  onClick={() => chooseCurrency(c.unit)}
                >
                  <img src={c.flag} alt="" className={styles.ccyFlag} draggable={false} />
                  <span className={styles.ccyCode}>{c.ccy}</span>
                  {/* The closed button's ▼ follows the current pick into the
                      open panel (6219:99583) — it marks which row is selected. */}
                  {c.unit === (picker === 'from' ? fromUnit : toUnit) && (
                    <span className={styles.optionCaret} aria-hidden="true">
                      ▼
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {keypad && (
            <div className={`${styles.keypad} ${lowReach ? styles.keypadLow : ''}`}>
              <div className={styles.keypadScrim} />
              <div className={styles.keys}>
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className={`${styles.keyRow} ${row === 1 ? styles.keyRowTall : ''}`}
                  >
                    {KEYS.slice(row * 3, row * 3 + 3).map((k) => (
                      <button key={k} type="button" className={styles.key} onClick={() => pressKey(k)}>
                        {k}
                      </button>
                    ))}
                  </div>
                ))}
                <div className={`${styles.keyRow} ${styles.keyRowShort}`}>
                  <button type="button" className={styles.key} onClick={() => pressKey('0')}>
                    0
                  </button>
                  <button type="button" className={styles.key} onClick={backspace} aria-label="지우기">
                    {jejuIconUrl('ico-backspace') && (
                      <img
                        src={jejuIconUrl('ico-backspace')}
                        alt=""
                        className={styles.keyIcon}
                        draggable={false}
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={`${styles.liveScroll} ${lowReach ? styles.liveScrollLow : ''}`}>
          {exchange ? (
            <div className={styles.liveList}>
              {liveRows.map((r) => (
                <div key={r.unit} className={styles.liveRow}>
                  <span className={styles.liveLeft}>
                    <img src={r.flag} alt="" className={styles.ccyFlag} draggable={false} />
                    <span className={styles.liveLabel}>{r.label}</span>
                  </span>
                  <span className={styles.liveRate}>{r.rateText}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>{pick(NO_RATES, lang)}</p>
          )}
        </div>
      )}
      </div>
    </JejuPageFrame>
  );
}
