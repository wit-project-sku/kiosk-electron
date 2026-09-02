/**
 * 제주 상세 — the one screen behind both detail entry points.
 *
 * Figma draws them as separate frames, but only the chrome differs:
 *   · from 검색        → "검색 > 상세"                   node 6212:51220
 *   · from AI 코스     → "'제주' 뭐하지 (AI 검색)"        node 6289:58438
 *                        with the course/day as the subtitle, in #616161
 *   · from 뭐먹지/뭐사지 → "'제주' 뭐먹지? > 상세"          node 6212:55208
 *     /숙박안내            "'제주' 뭐사지? > 상세"          node 6212:55257
 *                        "숙박안내 > 상세"                node 6212:55305
 *                        with the card 164px lower
 *   · from 도와줘 하영   → "여기는 제주도"                  node 6219:99127
 *                        one photo, card at y863
 * The card itself is the same component in all of them, so it lives in
 * JejuSpotDetailCard and this file only resolves chrome + navigation.
 *
 * NOTE on the data: `DetailItem.blogReviews` is not a review count — it carries
 * the shop's Naver link, which is what the card turns into a QR.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { pick, screenTitle, type Lang } from '@renderer/lib/i18n';
import { hasLoc, t } from '@renderer/lib/loc';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuCourseSpotCard } from './JejuCourseSpotCard';
import { JejuSpotDetailCard } from './JejuSpotDetailCard';
import styles from './JejuDetail.module.css';

interface Props {
  controller: KioskController;
}

const T = {
  missing: {
    ko: '표시할 정보가 없습니다', en: 'Nothing to show', ja: '表示する情報がありません',
    zh: '没有可显示的信息', vi: 'Không có thông tin để hiển thị', th: 'ไม่มีข้อมูลที่จะแสดง',
    ru: 'Нет данных для отображения', id: 'Tidak ada informasi untuk ditampilkan',
  },
};

/** Artboard height — scroll viewports are sized to its foot. */
const ARTBOARD = 3840;
/** Mode-bar revision: header drops by the bar height; content follows (JejuListScreen). */
const MODE_BAR = 113;

/**
 * The 상세 page description, straight from Localization_Jeju.
 *
 * It has to be passed explicitly rather than resolved by JejuHeader: the header
 * title here is COMPOSED ("숙박안내 > 상세", see chromeFor), and a composed
 * string matches no localization key, so `screenSubtitle` can never find the
 * row. The sheet has carried `SubHeader_Detail` in all eight languages
 * ("* QR을 핸드폰으로 찍으시면 길을 안내해드려요") the whole time — the copy was
 * simply never reaching a screen.
 *
 * Guarded by hasLoc so a removed row hides the line instead of printing the raw
 * key, which is what `t()` alone would do.
 */
function detailSubtitle(lang: Lang): string | undefined {
  return hasLoc('SubHeader_Detail') ? t('SubHeader_Detail', lang) : undefined;
}

/** Chrome for the screen this item came from. */
function chromeFor(
  from: string,
  title: string,
  lang: Lang,
): {
  title: string;
  subtitle?: string;
  subtitleColor?: string;
  cardTop?: number;
  gallery?: 'grid' | 'single';
} {
  // The AI course keeps the flow's own title and puts "A코스 - 1일차" beneath it,
  // so a visitor can see which course/day the spot belongs to. #616161 rather
  // than the default #909090 — 6289:58438 draws it the darker grey, matching the
  // course screen this spot was opened from (JejuAiDetail passes the same).
  if (from === 'ai_detail') {
    return {
      title: "'제주' 뭐하지 (AI 검색)",
      subtitle: title,
      subtitleColor: '#616161',
      cardTop: 720,
    };
  }

  // 도와줘 '하영' > 상세 (6219:99127) is the one frame that does NOT compose
  // "<page> > 상세": it carries the bare title "여기는 제주도", drawn that way in
  // the frame even though the frame is named 제주>도와줘 하영=상세 and sits beside
  // the 공항 map. Implemented as drawn. It is also the only detail using the
  // 사진1개 variant from this screen, with the card at y863.
  if (from === 'help') return { title: '여기는 제주도', cardTop: 863, gallery: 'single' };

  // "<page> > 상세" is composed HERE, from two already-localized halves, rather
  // than handed to JejuHeader as one id: a composed string matches no
  // localization key, so the header rendered it Korean to all 8 languages even
  // though its own list page localized fine (숙박안내 → Accommodation, then
  // "숙박안내 > 상세"). Both halves are keyed, and screenTitle passes the
  // finished string through untouched.
  const detail = `${screenTitle(title, lang)} > ${screenTitle('상세', lang)}`;

  // The 뭐먹지/뭐사지/숙박안내 frames drop the card 164px (6212:55208 /
  // 6212:55257 / 6212:55305); 검색 and the AI course butt it against the
  // 렌트카·뭐먹지·뭐사지·숙박안내 상세 — 카드를 y760에 둔다.
  if (from === 'rentcar' || from === 'eat' || from === 'shop' || from === 'lodging' || from === 'search') {
    return { title: detail, cardTop: 720 };
  }
  return { title: detail };
}

export function JejuDetail({ controller }: Props): JSX.Element {
  const item = useDetailStore((s) => s.item);
  const setItem = useDetailStore((s) => s.setItem);
  const lang = useLanguageStore((s) => s.currentLanguage);
  const lowReach = useAccessibilityStore((s) => s.lowReach);

  // Back returns to the screen the item came from, not home.
  const goBack = (): void => controller.navigate(item?.from ?? 'search', '뒤로');

  if (!item) {
    return (
      <JejuPageFrame
        controller={controller}
        title="상세"
        /* Same description the loaded page carries. Without it this state fell
           through to JejuHeader's generic line — 상세 is not in TITLE_KEYS (it is
           Insadong's and 오산's header id too, so a shared mapping would light up
           their detail pages as well), and resolving it here keeps the key on
           the one page it was written for. */
        subtitle={detailSubtitle(lang)}
        showBanner={false}
        onBack={goBack}
        lowReachModeBar
        lowReachShift={MODE_BAR}
      >
        <p className={styles.empty}>{pick(T.missing, lang)}</p>
      </JejuPageFrame>
    );
  }

  const chrome = chromeFor(item.from, item.title, lang);

  /*
   * The 다음 장소 card under the 상세 plate (6289:58438 → 6516:72906). Only the
   * AI course ever sets `courseNext`, and only when the day has a stop left.
   * When present, the 상세 card · chevron · 다음 장소 card stack in one scroll
   * column — normal and ♿ alike — so a tall detail card never hides the follow-on.
   */
  const next = item.courseNext;
  const cardTop = chrome.cardTop ?? 700;
  /* ♿ moves only the header via lowReachShift; content top and scroll height
     are re-laid here (same split as JejuListScreen — no body shift). */
  const contentTop = lowReach ? cardTop + MODE_BAR : cardTop;
  const scrollHeight = ARTBOARD - contentTop;

  return (
    /* This page's ♿ frame (6336:100864, 검색-03) uses the mode-bar revision:
       bar at y0, header at y113 — no promo banner in ♿. Content drops +113
       under the header (y720 → y833) and the scroll viewport fills to y3840. */
    <JejuPageFrame
      controller={controller}
      title={chrome.title}
      subtitle={chrome.subtitle ?? detailSubtitle(lang)}
      subtitleColor={chrome.subtitleColor}
      /* The 다음 장소 stack can run past y3267, so the page gives the banner up
         whenever it draws one — the same trade the AI search page makes. */
      showBanner={!next}
      bannerFallback="banner-detail"
      onBack={goBack}
      lowReachModeBar
      lowReachShift={MODE_BAR}
    >
      {next ? (
        <div className={styles.courseScroll} style={{ top: contentTop, height: scrollHeight }}>
          <div className={styles.courseColumn}>
            <JejuSpotDetailCard item={item} flow gallery={chrome.gallery} lang={lang} />
            {jejuIconUrl('ico-chevron') && (
              <img src={jejuIconUrl('ico-chevron')} alt="" className={styles.nextChevron} draggable={false} />
            )}
            {/* Tapping it swaps the store item rather than navigating: this IS the
                detail screen, so the next stop is the same page with new content —
                and `from` travels with the item, so 뒤로 still returns to the
                course list however far down the day a visitor has walked. */}
            <JejuCourseSpotCard
              width={1793}
              photo={next.item.photos[0] ?? jejuIconUrl('noimage') ?? ''}
              name={next.item.name}
              category={next.item.category}
              address={next.item.address}
              description={next.item.description}
              dwell={next.dwell}
              difficulty={next.difficulty}
              onClick={() => setItem(next.item)}
            />
          </div>
        </div>
      ) : (
        <JejuSpotDetailCard
          item={item}
          top={contentTop}
          maxScrollHeight={lowReach ? scrollHeight : undefined}
          gallery={chrome.gallery}
          lang={lang}
        />
      )}
    </JejuPageFrame>
  );
}
