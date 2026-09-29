/**
 * 인사동 환율 — Figma 7553:50260 (실시간 환율) and 7553:50518 (환율계산기).
 *
 * Same screen, same logic and same geometry as the 제주 환율 page
 * (layouts/jeju/JejuExchange.tsx); only the palette changes. The two frames
 * put every box on the SAME coordinates Jeju uses — tabs at y700, the 기준 환율
 * pill at 683/985/794×283, the two 1820×270 fields at y1381 / y1997 and the
 * 162px swap button at 1028/1743 — so this is a straight port with
 * #FFEAC7 → #FFE6E6 and #FF7F0F → --kiosk-primary (#FE6C50).
 *
 * Two tabs, 실시간 환율 open by default:
 *   실시간 환율  read-only rate list — white pill, 210 row on a 250 pitch,
 *                150 flag, with a "…기준" stamp hung above it.
 *   환율계산기   amount + currency → converted amount, with a numeric keypad
 *                and a currency dropdown per field.
 *
 * The keypad and the two dropdowns are mutually exclusive overlays — opening
 * one closes the others, and a tap anywhere else closes all of them.
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
import { iconUrl } from '@renderer/assets/icons/insadong';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useExchangeStore } from '@renderer/store/exchangeStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { pick, useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
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
import { barrierFreeTitle } from './barrierFree';
import bf from './barrierFree.module.css';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongExchange.module.css';

interface InsadongExchangeProps {
  controller: KioskController;
  debug?: boolean;
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
 * `tab`'s initial state). 실시간 환율 leads, matching Figma 7553:50260 where it
 * is the active tab: it is the read-only view a visitor who only wants to
 * glance at a rate needs, and the calculator is one tap away.
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
      // Written closed-up in the design (7553:50579), not "환율 계산기" — which
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

/*
 * Placeholders for the two empty fields. Both fields open EMPTY — the 기준 환율
 * pill above already states the 1-unit rate, so seeding a `1` would show the
 * same number twice and cost the visitor a backspace before they could type.
 *
 * The pair is deliberately asymmetric: 금액 is tappable, so its hint is an
 * instruction, while 환전 is read-only (`.fieldResult` sets cursor:default), so
 * its hint explains that the number arrives by itself rather than inviting a
 * tap that does nothing.
 */
const AMOUNT_PLACEHOLDER = {
  ko: '금액을 입력하세요', en: 'Enter amount', ja: '金額を入力してください',
  zh: '请输入金额', zh_cn: '请输入金额', zh_tw: '請輸入金額',
  vi: 'Nhập số tiền', th: 'กรอกจำนวนเงิน', ru: 'Введите сумму',
  id: 'Masukkan jumlah', es: 'Ingrese el importe',
};

const RESULT_PLACEHOLDER = {
  ko: '자동으로 계산됩니다', en: 'Calculated automatically', ja: '自動で計算されます',
  zh: '自动计算', zh_cn: '自动计算', zh_tw: '自動計算',
  vi: 'Tự động tính', th: 'คำนวณอัตโนมัติ', ru: 'Рассчитается автоматически',
  id: 'Dihitung otomatis', es: 'Se calcula automáticamente',
};

const BASE_LABEL = {
  ko: '기준 환율', en: 'Base rate', ja: '基準為替レート', zh: '基准汇率',
  vi: 'Tỷ giá cơ sở', th: 'อัตราอ้างอิง', ru: 'Базовый курс', id: 'Kurs dasar',
};

/** When the snapshot was fetched — `{t}` is the `26.08.30. 19:30` stamp. */
const AS_OF = {
  ko: '{t} 기준', en: 'As of {t}', ja: '{t} 基準', zh: '{t} 基准',
  vi: 'Tính đến {t}', th: 'ณ {t}', ru: 'на {t}', id: 'Per {t}',
};

/** The 원 suffix on the live list. */
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

/** Group digits for display. Never called with `''` — an empty field draws
 *  AMOUNT_PLACEHOLDER instead — but the `|| '0'` keeps it total. */
function groupDigits(digits: string): string {
  return Number(digits || '0').toLocaleString('en-US');
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

/** 환율 — live currency rates from the Korea Eximbank API (cached in main). */
export function InsadongExchange({ controller }: InsadongExchangeProps): JSX.Element {
  const lang = useLang();
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const banner = useRotatingBanner();
  const exchange = useExchangeStore((s) => s.exchange);
  const goHome = (): void => controller.navigate('home', 'Back');

  /** Opens on 실시간 환율, the left-hand tab — see TABS. */
  const [tab, setTab] = useState<TabId>('live');
  const [fromUnit, setFromUnit] = useState('USD');
  const [toUnit, setToUnit] = useState('KRW');
  const [digits, setDigits] = useState('');
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

  const result = convert(Number(digits || '0'));
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

  // Cap the entry so a leaned-on key can't overflow the 1050px value slot.
  const pressKey = (key: string): void =>
    setDigits((d) => (d.replace(/^0+/, '') + key).slice(0, 12));

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
  const asOf = formatFetchedAt(exchange?.fetchedAt);

  return (
    <div
      className={
        lowReach
          ? `${bf.lowRoot} ${tab === 'calc' ? bf.shiftExchangeCalc : bf.shiftExchangeLive}`
          : undefined
      }
    >
      {lowReach && <div className={bf.modeBar}>{barrierFreeTitle(lang)}</div>}
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="환율" onHome={goHome} />

      <div className={lowReach ? `${styles.tabs} ${styles.tabsLow}` : styles.tabs}>
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={`${styles.tab} ${tab === tb.id ? styles.tabOn : ''}`}
            aria-pressed={tab === tb.id}
            onClick={() => {
              closeOverlays();
              setTab(tb.id);
              /* VideoSubtitle files a clip per TAB — see the 재생조건 column
                 and the Key#N entries in videoMap. */
              void window.api.kiosk.setScreen(`exchange_${tb.id}`);
            }}
          >
            {sheetText(tb.key, lang, tb.label)}
          </button>
        ))}
      </div>

      {tab === 'calc' ? (
        <>
          <div className={lowReach ? `${styles.basePill} ${styles.basePillLow}` : styles.basePill}>
            <span className={styles.basePillLabel}>{sheetText('Exchange_desc_1', lang, BASE_LABEL)}</span>
            <span className={styles.basePillRate}>
              {oneUnit === undefined
                ? `1 ${from.ccy} = — ${to.ccy}`
                : `1 ${from.ccy} = ${formatAmount(oneUnit)} ${to.ccy}`}
            </span>
          </div>
          {asOf !== undefined && (
            <p className={styles.baseStamp}>{pick(AS_OF, lang).replace('{t}', asOf)}</p>
          )}

          {/* Closes whichever overlay is open. Sits under them, over everything
              else, so the fields below can't be tapped through it. */}
          {overlayOpen && (
            <button
              type="button"
              className={styles.backdrop}
              aria-label="닫기"
              data-pad-dismiss
              onClick={closeOverlays}
            />
          )}

          {/* ── 금액 ── */}
          <p className={`${styles.fieldLabel} ${styles.labelAmount}`}>{pick(AMOUNT_LABEL, lang)}</p>
          <button
            type="button"
            className={`${styles.field} ${styles.fieldAmount}`}
            onClick={openKeypad}
            aria-label={pick(AMOUNT_LABEL, lang)}
          />
          <p
            className={`${styles.value} ${styles.valueAmount} ${digits === '' ? styles.placeholder : ''}`}
          >
            {/* Caret LEADS the placeholder and TRAILS a typed number, which is
                where a real text input puts it in each state. */}
            {digits === '' ? (
              <>
                {keypad && <span className={styles.caretBar} />}
                {pick(AMOUNT_PLACEHOLDER, lang)}
              </>
            ) : (
              <>
                {groupDigits(digits)}
                {keypad && <span className={styles.caretBar} />}
              </>
            )}
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
            {iconUrl('exchange-swap') && (
              <img src={iconUrl('exchange-swap')} alt="" className={styles.swapImg} draggable={false} />
            )}
          </button>

          {/* ── 환전 ── */}
          <p className={`${styles.fieldLabel} ${styles.labelResult}`}>{pick(RESULT_LABEL, lang)}</p>
          <div className={`${styles.field} ${styles.fieldResult}`} />
          <p
            className={`${styles.value} ${styles.valueResult} ${digits === '' ? styles.placeholder : ''}`}
          >
            {/* An empty 금액 leaves nothing to convert, so this shows its own
                hint rather than a 0. The '—' is still the MISSING-RATE case:
                an amount was typed but the feed has no row for the pair. */}
            {digits === ''
              ? pick(RESULT_PLACEHOLDER, lang)
              : result === undefined
                ? '—'
                : formatAmount(result)}
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
              className={`${styles.dropdown} ${picker === 'from' ? styles.dropdownAmount : styles.dropdownResult} ${
                lowReach && picker !== 'from' ? styles.dropdownResultLow : ''
              }`}
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
                      open panel — it marks which row is selected. */}
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
            <div className={lowReach ? `${styles.keypad} ${styles.keypadLow}` : styles.keypad}>
              <div className={styles.keypadScrim} />
              <div className={styles.keys}>
                {[0, 1, 2].map((row) => (
                  <div key={row} className={styles.keyRow}>
                    {/* `data-vk-digit` — the barrier-free keypad's own number
                        keys type straight into this one, the same marker the
                        search keyboard carries. */}
                    {KEYS.slice(row * 3, row * 3 + 3).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={styles.key}
                        data-vk-digit={k}
                        onClick={() => pressKey(k)}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                ))}
                <div className={`${styles.keyRow} ${styles.keyRowShort}`}>
                  <button type="button" className={styles.key} data-vk-digit="0" onClick={() => pressKey('0')}>
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
        <>
          {/* The snapshot's age (7553:50514). Only drawn when there IS a
              snapshot — on the 환율 정보를 불러오지 못했습니다 screen it would
              be dating nothing. */}
          {exchange && asOf !== undefined && !lowReach && (
            <p className={styles.liveStamp}>{pick(AS_OF, lang).replace('{t}', asOf)}</p>
          )}
          <div className={lowReach ? `${styles.results} ${styles.resultsLow}` : styles.results}>
            {exchange ? (
              <div className={styles.list}>
                {liveRows.map((r) => (
                  <div key={r.unit} className={styles.row}>
                    <span className={styles.left}>
                      <img
                        src={r.flag}
                        alt=""
                        className={`${styles.ccyFlag} ${styles.flag}`}
                        draggable={false}
                      />
                      <span className={styles.label}>{r.label}</span>
                    </span>
                    <span className={`${styles.rate} ${lang !== 'ko' ? styles.rateLong : ''}`}>
                      {r.rateText}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>{pick(NO_RATES, lang)}</p>
            )}
          </div>
        </>
      )}

      <InsadongLeftNav onHome={goHome} />

      {banner && (
        <button
          type="button"
          className={`${styles.banner} ${lowReach && tab !== 'calc' ? styles.bannerHidden : ''}`}
          onClick={() => controller.startPhoto()}
          aria-label="가상 한복 체험"
        >
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </div>
  );
}
