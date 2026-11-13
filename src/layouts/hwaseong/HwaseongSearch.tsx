/**
 * 화성휴게소 검색 결과 — Figma 7909:106538 (오산>검색-02 in the 화성 file).
 *
 * Header (검색) · the 1350 search pill at y700 · result cards 1820×390, 60
 * apart, in a scroll area that runs to y3622 (no banner on this frame) · the
 * frame's scroll thumb on the right edge and its ▲/▼ buttons at (2027, 2103 /
 * 2223) · the shared left nav. Positions in HwaseongSearch.module.css are the
 * frame's values (1 CSS px = 1 Figma px).
 */
import { useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { SearchIcon } from '@layouts/components/SearchIcon';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { pick } from '@renderer/lib/i18n';
import type { Shop } from '@shared/types/shop';
import {
  searchShops,
  shopAddress,
  shopBaseCategory,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
  padImages,
} from '@renderer/lib/shops';
import { highlightMatch } from '@renderer/lib/highlightMatch';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import styles from './HwaseongSearch.module.css';

const T = {
  placeholder: {
    ko: '화성휴게소에 대해 검색해보세요!',
    en: 'Search about Hwaseong Rest Area!',
    ja: '華城休憩所について検索！',
    zh: '搜索关于华城休息站的内容！',
    vi: 'Tìm kiếm về trạm dừng Hwaseong!',
    th: 'ค้นหาเกี่ยวกับจุดพักรถฮวาซอง!',
    ru: 'Поиск о зоне отдыха Хвасон!',
    id: 'Cari tentang Rest Area Hwaseong!',
  },
  prompt: { ko: '검색어를 입력해보세요', en: 'Enter a search term', ja: '検索語を入力してください', zh: '请输入搜索词', vi: 'Nhập từ khóa tìm kiếm', th: 'กรุณาป้อนคำค้นหา', ru: 'Введите запрос', id: 'Masukkan kata pencarian' },
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

/** One ▲/▼ press scrolls the list by three cards (390 + 60 each). */
const SCROLL_STEP = 3 * 450;

/** Search pill geometry (mirrors .searchRow) — the keyboard opens just under it. */
const KEYBOARD_TOP = 700 + 182 + 18;

interface Props {
  controller: KioskController;
}

export function HwaseongSearch({ controller }: Props): JSX.Element {
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

  const shops = useShopStore((s) => s.shops);
  const noImg = hwaseongIconUrl('noimage');
  const [query, setQuery] = useState(initialQuery);
  // Arrive here after Enter on the home keyboard → show results (keyboard closed).
  // Tapping the field re-opens the keyboard to refine the search.
  const [focused, setFocused] = useState(false);
  const results = searchShops(shops, query, lang);
  const listRef = useRef<HTMLDivElement>(null);

  const applyKey = (action: KeyAction): void => {
    const c = composer.current;
    switch (action.type) {
      case 'jamo':      c.inputJamo(action.value);    break;
      case 'literal':   c.inputLiteral(action.value); break;
      case 'space':     c.inputLiteral(' ');          break;
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
    setDetail({
      from: 'search',
      shopId: shop.id,
      title: shopBaseCategory(shop, lang) || '검색',
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang),
      photos: shopImages(shop).length ? shopImages(shop) : noImg ? [noImg] : [],
      address: shopAddress(shop, lang),
      hours: shop.openTime ?? '',
      phone: shop.tel ?? '',
      description: shopDescription(shop, lang),
      tags: shopHashtag(shop, lang),
      rating: shop.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
    });
    controller.navigate('detail', '검색 상세');
  };

  const scrollBy = (dir: 1 | -1): void => {
    listRef.current?.scrollBy({ top: dir * SCROLL_STEP, behavior: 'smooth' });
  };
  const arrow = hwaseongIconUrl('search-scroll-arrow');

  return (
    <div className={styles.root}>
      <HwaseongPageBg />

      <HwaseongHeader controller={controller} title="검색" />

      {/* ── Search pill (검색장 7909:106542) ── */}
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

      {/* ── Results ── */}
      <div ref={listRef} className={styles.results}>
        {results.length > 0 ? (
          results.map((shop) => (
            <button type="button" key={shop.id} className={styles.card} onClick={() => openDetail(shop)}>
              <span className={styles.info}>
                <span className={styles.nameRow}>
                  <span className={styles.name}>{highlightMatch(shopName(shop, lang), query, styles.hl)}</span>
                  {shopSecondCategory(shop, lang) && (
                    <span className={styles.cat}>
                      <span className={styles.dot} />
                      {shopSecondCategory(shop, lang)}
                    </span>
                  )}
                </span>
                <span className={styles.address}>{highlightMatch(shopAddress(shop, lang), query, styles.hl)}</span>
                <span className={styles.desc}>{highlightMatch(shopDescription(shop, lang), query, styles.hl)}</span>
              </span>
              <span className={styles.photos}>
                {padImages(shopImages(shop), noImg, 2).slice(0, 2).map((src, j) => (
                  <span key={j} className={styles.thumb}>
                    <img src={src} alt="" draggable={false} loading="lazy" />
                  </span>
                ))}
              </span>
            </button>
          ))
        ) : (
          <p className={styles.empty}>{query ? pick(T.noResult, lang)(query) : pick(T.prompt, lang)}</p>
        )}
      </div>

      {/* ▲ / ▼ — the frame's back chevrons turned ±90° at (2027, 2103 / 2223). */}
      {results.length > 0 && (
        <>
          <button type="button" className={`${styles.scrollBtn} ${styles.scrollUp}`} onClick={() => scrollBy(-1)} aria-label="위로">
            {arrow && <img src={arrow} alt="" draggable={false} />}
          </button>
          <button type="button" className={`${styles.scrollBtn} ${styles.scrollDown}`} onClick={() => scrollBy(1)} aria-label="아래로">
            {arrow && <img src={arrow} alt="" draggable={false} />}
          </button>
        </>
      )}

      <HwaseongLeftNav onHome={goHome} />

      <FloatingKeyboard
        open={focused}
        onKey={applyKey}
        onClose={() => setFocused(false)}
        lang={lang}
        lightBackspace
        top={KEYBOARD_TOP}
      />
    </div>
  );
}
