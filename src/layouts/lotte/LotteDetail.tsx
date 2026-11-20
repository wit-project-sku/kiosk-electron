/**
 * 상세 for every 롯데 list (Figma 뭐먹지-상세): name · category, photos, location / hours / phone,
 * introduction and tags. Facts we do not have yet simply do not draw.
 *
 * Beside the facts, the QR every venue's 상세 has: the shop's Naver link (lotteShopLink — a Naver
 * Map search when the server has none) and, when the shop has one, its homepage.
 */
import { useEffect } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { useDetailStore } from '@renderer/store/detailStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { screenTitle } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { LottePageFrame } from './LottePageFrame';
import { LotteQr } from './LotteQr';
import { useVoiceIntro } from '../jeju/voice/intro';
import c from './lotteContent.module.css';

const PHOTO_SLOTS = 4;

type Text = Partial<Record<Lang, string>>;
const pick = (m: Text, lang: Lang): string => m[lang] ?? m.en ?? m.ko ?? '';
/** Caption under the map QR — the 롯데 voice script's promise: "매장 정보와 가는 길". */
const MAP_QR: Text = {
  ko: '매장 정보 · 가는 길', en: 'Info & directions', ja: '店舗情報・道案内', zh: '店铺信息·路线',
  vi: 'Thông tin & chỉ đường', th: 'ข้อมูลและเส้นทาง', ru: 'Инфо и маршрут', id: 'Info & arah',
};
const HOMEPAGE_QR: Text = {
  ko: '홈페이지', en: 'Website', ja: 'ホームページ', zh: '官网', vi: 'Trang web', th: 'เว็บไซต์', ru: 'Сайт', id: 'Situs web',
};
const isUrl = (v: string | undefined): v is string => !!v && /^https?:\/\//i.test(v);

const VOICE_ABOUT = ['lotte.about.detail'] as const;

export function LotteDetail({ controller }: { controller: KioskController }): JSX.Element {
  const item = useDetailStore((s) => s.item);
  const lang = useLanguageStore((s) => s.currentLanguage);
  const en = lang !== 'ko';
  const goBack = (): void => controller.navigate(item?.from ?? 'home', '뒤로');
  const from = item?.from;
  useEffect(() => {
    if (from) void window.api.kiosk.setScreen(`${from}_detail`);
  }, [from]);
  // 매장 상세 is the route's own intro (lotteVoice); 여기는 롯데's 시설 상세 has its own line.
  useVoiceIntro(from === 'about' ? VOICE_ABOUT : null);

  if (!item) {
    return (
      <LottePageFrame controller={controller} title="상세" showBanner={false} onBack={goBack}>
        <div className={c.body}>
          <div className={c.empty}>{en ? 'Nothing to show.' : '정보를 찾을 수 없습니다'}</div>
        </div>
      </LottePageFrame>
    );
  }

  const noImage = lotteIconUrl('noimage') ?? '';
  const photos = Array.from({ length: PHOTO_SLOTS }, (_, i) => item.photos[i] ?? noImage);
  const rows: ReadonlyArray<readonly [string, string]> = (
    [
      ['ico-location', item.address],
      ['ico-alarm', item.hours],
      ['ico-phone', item.phone],
    ] as const
  ).filter((r) => !!r[1]);

  return (
    <LottePageFrame
      controller={controller}
      title={`${screenTitle(item.title, lang)} > ${screenTitle('상세', lang)}`}
      subtitle={en ? 'Check the location and details.' : '위치와 정보를 확인하세요'}
      bannerFallback="banner-detail"
      onBack={goBack}
    >
      <div className={c.detailCard}>
        <div className={c.detailTop}>
          <h2 className={c.detailTitle}>{item.name}</h2>
          {item.category && <span className={c.detailTag}>{item.category}</span>}
        </div>
        <div className={c.detailPhotos}>
          {photos.map((src, i) => (
            <img key={`${src}${i}`} src={src} alt="" draggable={false} />
          ))}
        </div>
        <div className={c.detailInfo}>
          <div className={c.detailFacts}>
            {rows.map(([icon, v]) => (
              <div key={icon} className={c.detailFact}>
                {lotteIconUrl(icon) && <img src={lotteIconUrl(icon)} alt="" draggable={false} />}
                <span>{v}</span>
              </div>
            ))}
          </div>
          {(isUrl(item.homepageUrl) || isUrl(item.blogReviews)) && (
            <div className={c.detailQrs}>
              {isUrl(item.homepageUrl) && (
                <div className={c.detailQr}>
                  <LotteQr value={item.homepageUrl} />
                  <span>{pick(HOMEPAGE_QR, lang)}</span>
                </div>
              )}
              {isUrl(item.blogReviews) && (
                <div className={c.detailQr}>
                  <LotteQr value={item.blogReviews} />
                  <span>{pick(MAP_QR, lang)}</span>
                </div>
              )}
            </div>
          )}
        </div>
        {item.description && <p className={c.detailText}>{item.description}</p>}
        {item.tags && <p className={c.detailTags}>{item.tags}</p>}
      </div>
    </LottePageFrame>
  );
}
