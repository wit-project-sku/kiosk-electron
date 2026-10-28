/**
 * 제주공항 AR 한복체험 — 국적 선택. Sits between the 사진 보기 popup and the
 * finished photo.
 *
 * While this is on screen Monitor 2 already shows the photo, BLURRED, under a
 * "select your nationality" notice (photo:releaseResultDisplay with
 * lock 'nationality'). Picking a country here is what unblurs it and lets the
 * result page through — see PhotoWorkflow.
 *
 * A search field over a list rather than a <select>: ~240 countries is far too
 * many to scroll on a kiosk, so the field filters the list as the visitor
 * types on the docked keyboard (Korean 두벌식 composes through HangulComposer,
 * the same as 제주 검색). Names come from Intl.DisplayNames, so every UI
 * language gets real country names without a translation table, and the
 * search matches the visitor's language, English and Korean at once.
 *
 * Flags are SVG components (country-flag-icons): Windows Chromium has no
 * regional-indicator emoji, so 🇰🇷 would render as the letters "KR".
 */
import { useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import * as Flags from 'country-flag-icons/react/3x2';
import { countries } from 'country-flag-icons';
import type { SupportedLanguage } from '@shared/types/kiosk';
import { pick } from '@renderer/lib/i18n';
import { HangulComposer } from '../insadong/keyboard/hangul';
import { VirtualKeyboard, type KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import keyboardStyles from '../insadong/keyboard/FloatingKeyboard.module.css';
import styles from './JejuNationalityPicker.module.css';

interface Props {
  lang: SupportedLanguage;
  /** The visitor picked a country and pressed 확인 — ISO 3166-1 alpha-2. */
  onConfirm: (code: string) => void;
}

/**
 * Codes the flag set carries that are not anyone's nationality: uninhabited
 * territories, the EU, and the ITU-only AC / TA / IC.
 */
const NOT_NATIONALITIES = new Set(['AC', 'AQ', 'BV', 'EU', 'GS', 'HM', 'IC', 'IO', 'TA', 'TF', 'UM']);
const CODES = countries.filter((c) => !NOT_NATIONALITIES.has(c));

/** Who actually comes through 제주공항 — shown as one-tap tiles before any search. */
const POPULAR = ['KR', 'CN', 'TW', 'JP', 'HK', 'US', 'VN', 'TH', 'PH', 'MY', 'SG', 'MN'];

/** Artboard y of the docked keyboard tray (FloatingKeyboard's 1000px tray, flush to the bottom). */
const KEYBOARD_TOP = 3840 - 1000;

const T = {
  eyebrow: {
    ko: '마지막 단계', en: 'One last step', ja: '最後のステップ', zh: '最后一步',
    vi: 'Bước cuối cùng', th: 'ขั้นตอนสุดท้าย', ru: 'Последний шаг', id: 'Langkah terakhir',
  },
  title: {
    ko: '어느 나라에서 오셨나요?', en: 'Where are you from?', ja: 'どちらの国からいらっしゃいましたか？',
    zh: '您来自哪个国家？', vi: 'Bạn đến từ quốc gia nào?', th: 'คุณมาจากประเทศอะไร?',
    ru: 'Из какой вы страны?', id: 'Anda berasal dari negara mana?',
  },
  sub: {
    ko: '국적을 선택하면 사진이 공개됩니다', en: 'Choose your nationality to reveal your photo',
    ja: '国籍を選ぶと写真が表示されます', zh: '选择国籍后即可查看照片',
    vi: 'Chọn quốc tịch để xem ảnh của bạn', th: 'เลือกสัญชาติเพื่อดูรูปภาพของคุณ',
    ru: 'Выберите гражданство, чтобы увидеть фото', id: 'Pilih kebangsaan untuk melihat foto Anda',
  },
  placeholder: {
    ko: '국가 이름 검색', en: 'Search country', ja: '国名で検索', zh: '搜索国家',
    vi: 'Tìm quốc gia', th: 'ค้นหาประเทศ', ru: 'Поиск страны', id: 'Cari negara',
  },
  popular: {
    ko: '자주 찾는 국가', en: 'Popular', ja: 'よく選ばれる国', zh: '常用国家',
    vi: 'Phổ biến', th: 'ยอดนิยม', ru: 'Популярные', id: 'Populer',
  },
  all: {
    ko: '전체 국가', en: 'All countries', ja: 'すべての国', zh: '所有国家',
    vi: 'Tất cả quốc gia', th: 'ทุกประเทศ', ru: 'Все страны', id: 'Semua negara',
  },
  results: {
    ko: '검색 결과', en: 'Results', ja: '検索結果', zh: '搜索结果',
    vi: 'Kết quả', th: 'ผลการค้นหา', ru: 'Результаты', id: 'Hasil',
  },
  none: {
    ko: '일치하는 국가가 없습니다', en: 'No matching country', ja: '該当する国がありません',
    zh: '没有匹配的国家', vi: 'Không tìm thấy quốc gia', th: 'ไม่พบประเทศที่ตรงกัน',
    ru: 'Страна не найдена', id: 'Negara tidak ditemukan',
  },
  confirm: {
    ko: '확인하고 사진 보기', en: 'Confirm & view photo', ja: '確認して写真を見る', zh: '确认并查看照片',
    vi: 'Xác nhận và xem ảnh', th: 'ยืนยันและดูรูปภาพ', ru: 'Подтвердить и смотреть', id: 'Konfirmasi & lihat foto',
  },
  clear: { ko: '지우기', en: 'Clear' },
};

interface Country {
  code: string;
  /** In the visitor's UI language — what the row shows. */
  name: string;
  /** English, as the row's second line (dropped when it would repeat `name`). */
  en: string;
  /** Lower-cased name + en + ko + code: what the search matches against. */
  haystack: string;
}

function regionNames(locale: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    return null;
  }
}

function buildCountries(lang: SupportedLanguage): Country[] {
  const local = regionNames(lang);
  const en = regionNames('en');
  const ko = regionNames('ko');
  const list = CODES.map((code) => {
    const enName = en?.of(code) ?? code;
    const name = local?.of(code) ?? enName;
    const koName = ko?.of(code) ?? '';
    return {
      code,
      name,
      en: enName,
      haystack: `${name}\n${enName}\n${koName}\n${code}`.toLowerCase(),
    };
  });
  const collator = new Intl.Collator(lang);
  return list.sort((a, b) => collator.compare(a.name, b.name));
}

function Flag({ code, className }: { code: string; className?: string }): JSX.Element {
  const Svg = (Flags as Record<string, (p: { className?: string; title?: string }) => JSX.Element>)[code];
  return Svg ? <Svg className={className} /> : <span className={className} />;
}

export function JejuNationalityPicker({ lang, onConfirm }: Props): JSX.Element {
  const all = useMemo(() => buildCountries(lang), [lang]);
  const byCode = useMemo(() => new Map(all.map((c) => [c.code, c])), [all]);

  const composer = useRef(new HangulComposer());
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return all;
    // Names that START with the query first, then ones that merely contain it —
    // "kor" should put Korea above "North Korea"'s neighbours, "중" 중국 first.
    const starts: Country[] = [];
    const contains: Country[] = [];
    for (const c of all) {
      const i = c.haystack.indexOf(needle);
      if (i < 0) continue;
      (i === 0 || c.haystack.includes(`\n${needle}`) ? starts : contains).push(c);
    }
    return [...starts, ...contains];
  }, [all, needle]);

  const setText = (): void => {
    setQuery(composer.current.value);
    listRef.current?.scrollTo({ top: 0 });
  };

  const choose = (code: string): void => {
    setSelected(code);
    setTyping(false);
  };

  const applyKey = (action: KeyAction): void => {
    const c = composer.current;
    switch (action.type) {
      case 'jamo':      c.inputJamo(action.value);    break;
      case 'literal':   c.inputLiteral(action.value); break;
      case 'space':     c.inputLiteral(' ');          break;
      case 'backspace': c.backspace();                break;
      case 'enter':
        // Enter on a search that has narrowed to one country is that country.
        if (results.length === 1 && results[0]) choose(results[0].code);
        else setTyping(false);
        return;
    }
    setText();
  };

  const clear = (): void => {
    composer.current.reset('');
    setText();
  };

  const picked = selected ? byCode.get(selected) : undefined;
  const showPopular = !needle;

  return (
    <>
      <section
        className={`${styles.panel} ${typing ? styles.panelTyping : ''}`}
        style={typing ? { bottom: 3840 - KEYBOARD_TOP + 40 } : undefined}
        aria-labelledby="nationality-title"
      >
        <div className={styles.head}>
          <span className={styles.eyebrow}>{pick(T.eyebrow, lang)}</span>
          <h2 id="nationality-title" className={styles.title}>{pick(T.title, lang)}</h2>
          {!typing && <p className={styles.sub}>{pick(T.sub, lang)}</p>}
        </div>

        <div
          className={`${styles.search} ${typing ? styles.searchActive : ''}`}
          role="searchbox"
          aria-label={pick(T.placeholder, lang)}
          onClick={() => setTyping(true)}
        >
          <Search className={styles.searchIcon} strokeWidth={2.6} />
          <span className={`${styles.searchText} ${query ? styles.searchValue : ''}`}>
            {query || pick(T.placeholder, lang)}
            {typing && <span className={styles.caret} />}
          </span>
          {query && (
            <button
              type="button"
              className={styles.clear}
              aria-label={pick(T.clear, lang)}
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
            >
              <X strokeWidth={3} />
            </button>
          )}
        </div>

        <div className={styles.scroll} ref={listRef}>
          {showPopular && (
            <>
              <p className={styles.section}>{pick(T.popular, lang)}</p>
              <div className={styles.tiles}>
                {POPULAR.map((code) => {
                  const c = byCode.get(code);
                  if (!c) return null;
                  const on = selected === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      className={`${styles.tile} ${on ? styles.tileOn : ''}`}
                      aria-pressed={on}
                      onClick={() => choose(code)}
                    >
                      <Flag code={code} className={styles.tileFlag} />
                      <span className={styles.tileName}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <p className={styles.section}>
            {needle ? `${pick(T.results, lang)} · ${results.length}` : pick(T.all, lang)}
          </p>

          {results.length === 0 ? (
            <p className={styles.empty}>{pick(T.none, lang)}</p>
          ) : (
            <ul className={styles.list}>
              {results.map((c) => {
                const on = selected === c.code;
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      className={`${styles.row} ${on ? styles.rowOn : ''}`}
                      aria-pressed={on}
                      onClick={() => choose(c.code)}
                    >
                      <Flag code={c.code} className={styles.rowFlag} />
                      <span className={styles.rowText}>
                        <span className={styles.rowName}>{c.name}</span>
                        {c.en !== c.name && <span className={styles.rowEn}>{c.en}</span>}
                      </span>
                      <span className={`${styles.radio} ${on ? styles.radioOn : ''}`}>
                        {on && <Check strokeWidth={3.4} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!typing && (
          <div className={styles.footer}>
            <div className={styles.picked}>
              {picked ? (
                <>
                  <Flag code={picked.code} className={styles.pickedFlag} />
                  <span className={styles.pickedName}>{picked.name}</span>
                </>
              ) : (
                <span className={styles.pickedNone}>—</span>
              )}
            </div>
            <button
              type="button"
              className={styles.confirm}
              disabled={!picked}
              onClick={() => picked && onConfirm(picked.code)}
            >
              {pick(T.confirm, lang)}
            </button>
          </div>
        )}
      </section>

      {typing && (
        <div
          className={keyboardStyles.panel}
          style={{ top: KEYBOARD_TOP, zIndex: 20 }}
          // Keeps the tap from stealing focus/selection, as FloatingKeyboard does.
          onMouseDown={(e) => e.preventDefault()}
        >
          <VirtualKeyboard onKey={applyKey} lang={lang} />
        </div>
      )}
    </>
  );
}
