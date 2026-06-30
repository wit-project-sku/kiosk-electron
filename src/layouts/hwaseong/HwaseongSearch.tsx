import { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { KioskController } from '@renderer/hooks/useKioskController';
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
import styles from './HwaseongSearch.module.css';

const T = {
  placeholder: {
    ko: '화성휴게소에 대해 검색해보세요!',
    en: 'Search about Hwaseong Rest Area!',
    ja: '華城休憩所について検索！',
    zh: '搜索关于华城休息站的内容！',
  },
  prompt: { ko: '검색어를 입력해보세요', en: 'Enter a search term', ja: '検索語を入力してください', zh: '请输入搜索词' },
  noResult: {
    ko: (q: string) => `'${q}' 검색 결과가 없습니다`,
    en: (q: string) => `No results for '${q}'`,
    ja: (q: string) => `「${q}」の検索結果がありません`,
    zh: (q: string) => `没有'${q}'的搜索结果`,
  },
};

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

  const openDetail = (shop: Shop): void => {
    setDetail({
      from: 'search',
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

  return (
    <div className={styles.root}>
      {hwaseongIconUrl('bg') && (
        <img className={styles.bg} src={hwaseongIconUrl('bg')} alt="" draggable={false} />
      )}

      {/* ── Header (검색) ─────────────────────────────── */}
      <HwaseongHeader controller={controller} title="검색" />

      {/* ── Results ──────────────────────────────────── */}
      <div className={styles.results}>
        <div className={styles.searchRow}>
          <button type="button" className={styles.searchInput} onClick={() => setFocused(true)}>
            <span className={styles.inputTextWrap}>
              {query ? (
                <span className={styles.inputText}>{query}</span>
              ) : (
                <span className={styles.inputPlaceholder}>{pick(T.placeholder, lang)}</span>
              )}
              {focused && <span className={styles.caret} />}
            </span>
            <Search className={styles.searchIcon} strokeWidth={2.4} />
          </button>
        </div>

        {results.length > 0 ? (
          <div className={styles.list}>
            {results.map((shop) => {
              const thumbs = padImages(shopImages(shop), noImg ?? '', 4);
              return (
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
                    <p className={styles.tags}>{highlightMatch(shopHashtag(shop, lang), query, styles.hl)}</p>
                  </div>
                  <div className={styles.photos}>
                    {thumbs.map((src, j) => (
                      <div key={j} className={styles.thumb}>
                        {src ? <img src={src} alt="" draggable={false} loading="lazy" /> : <div className={styles.thumbEmpty} />}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>{query ? pick(T.noResult, lang)(query) : pick(T.prompt, lang)}</p>
        )}
      </div>

      {/* ── Left nav ─────────────────────────────────── */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={goHome} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={goHome} aria-label="뒤로" />
      </div>

      {/* ── Bottom banner ────────────────────────────── */}
      <div className={styles.banner}>
        {hwaseongIconUrl('fg-banner') && (
          <img src={hwaseongIconUrl('fg-banner')} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>

      <FloatingKeyboard open={focused} onKey={applyKey} onClose={() => setFocused(false)} lang={lang} />
    </div>
  );
}
