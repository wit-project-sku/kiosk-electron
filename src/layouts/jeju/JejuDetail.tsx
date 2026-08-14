/**
 * 제주 상세 — the one screen behind both detail entry points.
 *
 * Figma draws them as separate frames, but only the chrome differs:
 *   · from 검색        → "검색 > 상세"                   node 6050:140706
 *   · from AI 코스     → "'제주' 뭐하지 (AI 검색)"        node 6167:98729
 *                        with the course/day as the subtitle
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
import { useDetailStore } from '@renderer/store/detailStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { pick, screenTitle, type Lang } from '@renderer/lib/i18n';
import { hasLoc, t } from '@renderer/lib/loc';
import { JejuPageFrame } from './JejuPageFrame';
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
): { title: string; subtitle?: string; cardTop?: number; gallery?: 'grid' | 'single' } {
  // The AI course keeps the flow's own title and puts "A코스 - 1일차" beneath it,
  // so a visitor can see which course/day the spot belongs to.
  if (from === 'ai_detail') return { title: "'제주' 뭐하지 (AI 검색)", subtitle: title };

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

  // The 뭐먹지/뭐사지/숙박안내/렌트카 frames drop the card 164px (6212:55208 /
  // 6212:55257 / 6212:55305 / 6217:95707); 검색 and the AI course butt it
  // against the header. Same card, different y — see JejuSpotDetailCard's `top`.
  if (from === 'eat' || from === 'shop' || from === 'lodging' || from === 'rentcar') {
    return { title: detail, cardTop: 864 };
  }
  return { title: detail };
}

export function JejuDetail({ controller }: Props): JSX.Element {
  const item = useDetailStore((s) => s.item);
  const lang = useLanguageStore((s) => s.currentLanguage);

  // Back returns to the screen the item came from, not home.
  const goBack = (): void => controller.navigate(item?.from ?? 'search', '뒤로');

  if (!item) {
    return (
      <JejuPageFrame controller={controller} title="상세" showBanner={false} onBack={goBack}>
        <p className={styles.empty}>{pick(T.missing, lang)}</p>
      </JejuPageFrame>
    );
  }

  const chrome = chromeFor(item.from, item.title, lang);

  return (
    <JejuPageFrame
      controller={controller}
      title={chrome.title}
      subtitle={chrome.subtitle ?? detailSubtitle(lang)}
      showBanner
      bannerFallback="banner-detail"
      onBack={goBack}
    >
      <JejuSpotDetailCard item={item} top={chrome.cardTop} gallery={chrome.gallery} />
    </JejuPageFrame>
  );
}
