/**
 * 오산 검색 results — Figma 7812:107004 (오산>검색-02).
 *
 * Shared header, then 검색결과 at y700: the 1350-wide search field (182) and,
 * 100 below, the result list (982 … 3622) of 390-tall shop cards — name ·
 * category, address, one-line description, two photos. The list scrolls on its
 * own with the ▲▼ pair on the right edge. No bottom banner in this frame.
 * The navy twin of InsadongSearch's renewal, which shares the card spec.
 */
import { useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { SearchIcon } from '@layouts/components/SearchIcon';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { pick } from '@renderer/lib/i18n';
import type { Shop } from '@shared/types/shop';
import {
  searchShops,
  shopAddress,
  shopDescription,
  shopImages,
  shopName,
  shopSecondCategory,
  padImages,
} from '@renderer/lib/shops';
import { highlightMatch } from '@renderer/lib/highlightMatch';
import { OsanHeader } from './OsanHeader';
import { OsanLeftNav } from './OsanLeftNav';
import { OsanPageBg } from './OsanPageBg';
import { osanShopDetail } from './osanShopDetail';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import styles from './OsanSearch.module.css';

const T = {
  placeholder: {
    ko: '오색시장에 대해 검색해보세요!',
    en: 'Search about Osaek Market!',
    ja: 'オセク市場について検索！',
    zh: '搜索关于五色市场的内容！',
    vi: 'Tìm kiếm về chợ Osaek!',
    th: 'ค้นหาเกี่ยวกับตลาดโอแซก!',
    ru: 'Поиск о рынке Осэк!',
    id: 'Cari tentang Pasar Osaek!',
  },
  prompt:   { ko: '검색어를 입력해보세요', en: 'Enter a search term', ja: '検索語を入力してください', zh: '请输入搜索词', vi: 'Nhập từ khóa tìm kiếm', th: 'กรุณาป้อนคำค้นหา', ru: 'Введите запрос', id: 'Masukkan kata pencarian' },
  noResult: {
    ko: (q: string) => `'${q}' 검색 결과가 없습니다`,
    en: (q: string) => `No results for '${q}'`,
    ja: (q: string) => `「${q}」の検索結果がありません`,
    zh: (q: string) => `没有'${q}'的搜索结果`,
    vi: (q: string) => `Không có kết quả cho '${q}'`,
    th: (q: string) => `ไม่พบผลลัพธ์สำหรับ '${q}'`,
    ru: (q: string) => `Нет результатов по '${q}'`,
    id: (q: string) => `Tidak ada hasil untuk '${q}'`,
  },
};

/** One card (390) + its 60px gap — a tap lands the next card flush at the top. */
const SCROLL_STEP = 450;

/** 검색결과 top (700) + the field (182): the keyboard tray opens flush under it. */
const FIELD_BOTTOM = 700 + 182;

interface OsanSearchProps {
  controller: KioskController;
}

export function OsanSearch({ controller }: OsanSearchProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  const initialQuery = useSearchStore((s) => s.query);
  const setStoreQuery = useSearchStore((s) => s.setQuery);
  const setDetail = useDetailStore((s) => s.setItem);

  const composer = useRef(new HangulComposer());
  const seeded = useRef(false);
  if (!seeded.current) {
    composer.current.reset(initialQuery);
    seeded.current = true;
  }

  const listRef = useRef<HTMLDivElement>(null);
  const scrollBy = (dy: number): void => listRef.current?.scrollBy({ top: dy, behavior: 'smooth' });

  const shops = useShopStore((s) => s.shops);
  const noImg = osanIconUrl('noimage');
  const arrow = osanIconUrl('scroll-arrow');
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const results = searchShops(shops, query, lang);

  const applyKey = (action: KeyAction): void => {
    const c = composer.current;
    switch (action.type) {
      case 'jamo':     c.inputJamo(action.value);    break;
      case 'literal':  c.inputLiteral(action.value); break;
      case 'space':    c.inputLiteral(' ');           break;
      case 'backspace': c.backspace();                break;
      case 'enter':
        setStoreQuery(c.value.trim());
        setFocused(false);
        setQuery(c.value);
        listRef.current?.scrollTo({ top: 0 });
        return;
    }
    setQuery(c.value);
  };

  const openDetail = (shop: Shop): void => {
    setDetail(osanShopDetail(shop, lang, 'search', '검색', noImg));
    controller.navigate('detail', '검색 상세');
  };

  return (
    <>
      <OsanPageBg />

      <OsanHeader title="검색" onHome={goHome} />

      <div className={`${styles.results} ${lang !== 'ko' ? styles.long : ''}`}>
        <div className={styles.searchRow}>
          <button type="button" className={styles.searchInput} onClick={() => setFocused(true)}>
            <span className={styles.inputTextWrap}>
              <span className={styles.inputText}>{query || pick(T.placeholder, lang)}</span>
              {focused && <span className={styles.caret} />}
            </span>
            <span className={styles.searchIcon}>
              <SearchIcon className={styles.searchIconSvg} />
            </span>
          </button>
        </div>

        {results.length > 0 ? (
          <div ref={listRef} className={styles.list}>
            {results.map((shop) => (
              <button type="button" key={shop.id} className={styles.card} onClick={() => openDetail(shop)}>
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>{highlightMatch(shopName(shop, lang), query, styles.hl)}</span>
                    <span className={styles.cat}>
                      <span className={styles.dot} />
                      {shopSecondCategory(shop, lang)}
                    </span>
                  </div>
                  <p className={styles.address}>{highlightMatch(shopAddress(shop, lang), query, styles.hl)}</p>
                  <p className={styles.desc}>{highlightMatch(shopDescription(shop, lang), query, styles.hl)}</p>
                </div>
                <div className={styles.photos}>
                  {padImages(shopImages(shop), noImg, 2).map((src, j) => (
                    <div key={j} className={styles.thumb}>
                      <img src={src} alt="" draggable={false} loading="lazy" />
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            {query ? pick(T.noResult, lang)(query) : pick(T.prompt, lang)}
          </p>
        )}
      </div>

      {results.length > 0 && (
        <>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollUp}`}
            onClick={() => scrollBy(-SCROLL_STEP)}
            aria-label="위로"
          >
            {arrow && <img src={arrow} alt="" className={styles.scrollBtnImg} draggable={false} />}
          </button>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollDown}`}
            onClick={() => scrollBy(SCROLL_STEP)}
            aria-label="아래로"
          >
            {arrow && <img src={arrow} alt="" className={styles.scrollBtnImg} draggable={false} />}
          </button>
        </>
      )}

      <OsanLeftNav onHome={goHome} />

      <FloatingKeyboard
        open={focused}
        onKey={applyKey}
        onClose={() => setFocused(false)}
        lang={lang}
        top={FIELD_BOTTOM}
      />
    </>
  );
}
