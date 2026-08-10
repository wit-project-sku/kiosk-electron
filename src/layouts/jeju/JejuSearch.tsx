/**
 * 제주 검색 결과 — Figma node 6050:140667 (제주>유산=검색-01).
 *
 * Reached from the home search bar: JejuHome writes the typed query to
 * searchStore on Enter and navigates here, which reads it back and shows the
 * matching shops. The field stays editable so a visitor can re-search in place.
 *
 * Data + behaviour are the shared shop path (searchShops / shopName / … /
 * detailStore) that OsanSearch uses; only the presentation is Jeju's.
 */
import { useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Shop } from '@shared/types/shop';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { pick } from '@renderer/lib/i18n';
import {
  searchShops,
  shopAddress,
  shopBaseCategory,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
} from '@renderer/lib/shops';
import { highlightMatch } from '@renderer/lib/highlightMatch';
import { JejuPageFrame } from './JejuPageFrame';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import styles from './JejuSearch.module.css';

interface Props {
  controller: KioskController;
}

const T = {
  placeholder: {
    ko: '제주에 대해 검색해보세요!',
    en: 'Search about Jeju!',
    ja: '済州について検索してみてください！',
    zh: '搜索关于济州的信息！',
    vi: 'Tìm kiếm về Jeju!',
    th: 'ค้นหาเกี่ยวกับเชจู!',
    ru: 'Поиск о Чеджу!',
    id: 'Cari tentang Jeju!',
  },
  prompt: {
    ko: '검색어를 입력해보세요', en: 'Enter a search term', ja: '検索語を入力してください',
    zh: '请输入搜索词', vi: 'Nhập từ khóa tìm kiếm', th: 'กรุณาป้อนคำค้นหา',
    ru: 'Введите запрос', id: 'Masukkan kata pencarian',
  },
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

/** Thumbnails per card — the Figma draws a fixed 2×2 grid. */
const THUMBS = 4;

/** One scroll-button press moves by a card + its gap. */
const SCROLL_STEP = 590;

export function JejuSearch({ controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const initialQuery = useSearchStore((s) => s.query);
  const setStoreQuery = useSearchStore((s) => s.setQuery);
  const setDetail = useDetailStore((s) => s.setItem);
  const shops = useShopStore((s) => s.shops);

  const composer = useRef(new HangulComposer());
  const seeded = useRef(false);
  if (!seeded.current) {
    composer.current.reset(initialQuery);
    seeded.current = true;
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const results = searchShops(shops, query, lang);

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
        return;
    }
    setQuery(c.value);
  };

  const scrollBy = (delta: number): void =>
    scrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });

  const openDetail = (shop: Shop): void => {
    setDetail({
      from: 'search',
      title: shopBaseCategory(shop, lang) || '검색',
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang),
      photos: shopImages(shop),
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

  return (
    <JejuPageFrame controller={controller} title="검색" showBanner={false}>
      <div className={styles.scroll} ref={scrollRef}>
        <div className={styles.searchRow}>
          <div className={styles.searchField} role="button" onClick={() => setFocused(true)}>
            <span className={`${styles.searchText} ${query ? styles.searchValue : ''}`}>
              {query || pick(T.placeholder, lang)}
              {focused && <span className={styles.caret} />}
            </span>
            {jejuIconUrl('ico-search') && (
              <img src={jejuIconUrl('ico-search')} alt="" className={styles.searchIcon} draggable={false} />
            )}
          </div>
        </div>

        {results.length > 0 ? (
          <div className={styles.list}>
            {results.map((shop) => {
              const images = shopImages(shop);
              return (
                <button
                  key={shop.id}
                  type="button"
                  className={styles.card}
                  onClick={() => openDetail(shop)}
                >
                  <span className={styles.info}>
                    <span className={styles.nameRow}>
                      <span className={styles.name}>
                        {highlightMatch(shopName(shop, lang), query, styles.hl)}
                      </span>
                      <span className={styles.cat}>
                        <span className={styles.dot} />
                        {shopSecondCategory(shop, lang)}
                      </span>
                    </span>
                    <p className={styles.address}>
                      {highlightMatch(shopAddress(shop, lang), query, styles.hl)}
                    </p>
                    <p className={styles.desc}>
                      {highlightMatch(shopDescription(shop, lang), query, styles.hl)}
                    </p>
                    <p className={styles.tags}>
                      {highlightMatch(shopHashtag(shop, lang), query, styles.hl)}
                    </p>
                  </span>

                  {/* Always four slots so the 2×2 grid holds its shape; a shop
                      with fewer photos shows empty tinted tiles rather than a
                      ragged grid. There is no Jeju `noimage` asset to pad with. */}
                  <span className={styles.photos}>
                    {Array.from({ length: THUMBS }, (_, j) => (
                      <span key={j} className={styles.thumb}>
                        {images[j] && <img src={images[j]} alt="" draggable={false} loading="lazy" />}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>
            {query ? pick(T.noResult, lang)(query) : pick(T.prompt, lang)}
          </p>
        )}
      </div>

      <button
        type="button"
        className={`${styles.scrollBtn} ${styles.scrollUp}`}
        onClick={() => scrollBy(-SCROLL_STEP)}
        aria-label="위로"
      >
        {jejuIconUrl('scroll-arrow') && (
          <img src={jejuIconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
        )}
      </button>
      <button
        type="button"
        className={`${styles.scrollBtn} ${styles.scrollDown}`}
        onClick={() => scrollBy(SCROLL_STEP)}
        aria-label="아래로"
      >
        {jejuIconUrl('scroll-arrow') && (
          <img src={jejuIconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
        )}
      </button>

      <FloatingKeyboard
        open={focused}
        onKey={applyKey}
        onClose={() => setFocused(false)}
        lang={lang}
        top={882}
      />
    </JejuPageFrame>
  );
}
