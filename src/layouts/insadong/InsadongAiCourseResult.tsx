import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { JejuCourse, JejuPickerPlan } from '@shared/types/jejuCourse';
import type { Shop } from '@shared/types/shop';
import { iconUrl } from '@renderer/assets/icons/insadong';
import iconMarker from '@renderer/assets/photos/insadong/ai/icon-marker.png';
import iconAlarm from '@renderer/assets/photos/insadong/ai/icon-alarm.png';
import { useAiStore } from '@renderer/store/aiStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { pick as pickLang, useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { isOk } from '@shared/types/result';
import { buildAiCourseSaveUrlForQr } from '@renderer/lib/aiCourseSave';
import {
  aboutMinutesLabel,
  courseLetter,
  interestCodes,
  minutesLabel,
  nightCount,
  partySize,
  todayIso,
  transportCode,
} from '@renderer/lib/jejuCourse';
import {
  shopAddress,
  shopDescription,
  shopImages,
  shopName,
  shopSecondCategory,
  stripPrefix,
} from '@renderer/lib/shops';
import { useFitText } from '@layouts/components/fitText';
import { insaDayTabLabel, localizeInsaAiPick } from './InsadongAiCourse';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongAiCourseResult.module.css';

/**
 * AI 맞춤 추천 코스 — Figma 7519:75267 (7519:76503 is a straight duplicate of
 * the same frame, so one component draws both).
 *
 * Two sources feed it, normalised into {@link Stop} so the page never branches
 * on which one it got:
 *   · 커스텀 코스 — the {@link JejuPickerPlan} the builder already has in the
 *     store, so the visitor sees exactly the places they watched fill the day
 *     rather than a second, differently-scheduled answer.
 *   · 추천코스    — `/recommend` for the tapped course letter.
 *
 * Both are 제주's endpoints, reused unchanged; the server keys the catalogue off
 * kioskId, which now accepts the 인사동 kiosks.
 *
 * ── Copy ──────────────────────────────────────────────────────────────────
 * Every string here resolves sheet-row-for-this-language → authored copy for
 * the same language → Korean (`line`, over `sheetText`). The chip answers the
 * visitor gave arrive from the store in KOREAN — that is what the API matches
 * on — so they are translated back through the builder's own chip tables
 * (`localizeInsaAiPick`), which guarantees the summary repeats the exact words
 * the chips showed.
 *
 * Only `TotalStayTime` exists on the 인사 tab for the summary bar today; the
 * other three labels are authored in all eight languages and step aside the
 * moment their rows land.
 */

type L8 = Partial<Record<Lang, string>>;

/** The page's own copy — keys are the renewal vocabulary Localization_Jeju uses
 *  for the identical frame, so the 인사 tab can be filled the same way. */
const TEXT = {
  /** The header description, followed by " - 1일차". */
  result: {
    ko: 'AI 맞춤 추천 코스', en: 'Your AI course', ja: 'AIおすすめコース', zh: 'AI定制推荐路线',
    vi: 'Lộ trình AI dành cho bạn', th: 'เส้นทางแนะนำโดย AI', ru: 'Маршрут от ИИ', id: 'Rute rekomendasi AI',
  } as L8,
  /** 7519:75284's hashtag line. No sheet row anywhere; authored. */
  tags: {
    ko: '#취향 #맞춤 #내맘대로', en: '#taste #tailored #myway', ja: '#好み #カスタム #自分流',
    zh: '#喜好 #定制 #随我心', vi: '#sởthích #riêngbạn #theoýbạn', th: '#สไตล์คุณ #จัดให้ #ตามใจ',
    ru: '#вкус #подбор #посвоему', id: '#selera #custom #sesukaku',
  } as L8,
  totalTime: {
    ko: '총 소요시간', en: 'Total time', ja: '総所要時間', zh: '总耗时',
    vi: 'Tổng thời gian', th: 'เวลารวม', ru: 'Общее время', id: 'Total waktu',
  } as L8,
  distance: {
    ko: '이동거리', en: 'Distance', ja: '移動距離', zh: '移动距离',
    vi: 'Quãng đường', th: 'ระยะทาง', ru: 'Расстояние', id: 'Jarak',
  } as L8,
  partyStay: {
    ko: '방문 인원/ 일정', en: 'Group / Stay', ja: '人数 / 日程', zh: '人数 / 行程',
    vi: 'Số người / Lịch', th: 'จำนวนคน / กำหนดการ', ru: 'Гости / Срок', id: 'Orang / Jadwal',
  } as L8,
  transport: {
    ko: '이동수단', en: 'Getting around', ja: '移動手段', zh: '交通方式',
    vi: 'Phương tiện di chuyển', th: 'การเดินทาง', ru: 'Транспорт', id: 'Transportasi',
  } as L8,
  /** Prefixes the rounded distance — "약 4.2Km". */
  about: {
    ko: '약', en: 'approx.', ja: '約', zh: '约',
    vi: 'khoảng', th: 'ประมาณ', ru: 'ок.', id: 'sekitar',
  } as L8,
  dwell: {
    ko: '머무는 시간', en: 'Time here', ja: '滞在時間', zh: '停留时间',
    vi: 'Thời gian ở lại', th: 'เวลาที่แวะ', ru: 'Время на месте', id: 'Waktu di sini',
  } as L8,
  empty: {
    ko: '추천된 코스가 없습니다.', en: 'No course to show.', ja: 'おすすめコースがありません。',
    zh: '暂无推荐路线。', vi: 'Chưa có lộ trình nào.', th: 'ยังไม่มีเส้นทางแนะนำ',
    ru: 'Маршрутов нет.', id: 'Belum ada rute.',
  } as L8,
  scrollUp: {
    ko: '위로', en: 'Scroll up', ja: '上へ', zh: '向上',
    vi: 'Lên trên', th: 'เลื่อนขึ้น', ru: 'Вверх', id: 'Ke atas',
  } as L8,
  scrollDown: {
    ko: '아래로', en: 'Scroll down', ja: '下へ', zh: '向下',
    vi: 'Xuống dưới', th: 'เลื่อนลง', ru: 'Вниз', id: 'Ke bawah',
  } as L8,
};

/** One scheduled stop, from either source. */
interface Stop {
  shopId: number;
  order: number;
  /** Travel INTO this stop from the previous one. */
  travelMinutes: number;
  travelKm: number;
  dwellMinutes: number;
  /** The 즐길 거리 this stop was picked for, prefix stripped. */
  category: string;
}

interface Day {
  day: number;
  stops: Stop[];
}

const fromPlan = (plan: JejuPickerPlan): Day[] =>
  plan.days.map((d) => ({
    day: d.day,
    /* `repeat` is the server's filler for days the visitor never tapped; it is
       explicitly not in the day's minutes, so it is shown only when the day has
       nothing of its own. */
    stops: (d.stops.length > 0 ? d.stops : (d.repeat?.stops ?? [])).map((s) => ({
      shopId: s.shopId,
      order: s.order,
      travelMinutes: s.travelMinutes,
      travelKm: s.travelKm,
      dwellMinutes: s.dwellMinutes,
      category: stripPrefix(s.aiCategory),
    })),
  }));

const fromCourse = (course: JejuCourse): Day[] =>
  course.schedule.map((d) => ({
    day: d.day,
    stops: d.spots.map((s) => ({
      shopId: s.shopId,
      order: s.order,
      travelMinutes: s.travelMinutes,
      travelKm: s.travelKm,
      /* /recommend carries no per-stop dwell; the day's own total minus its
         travel, spread over the stops, is the only honest figure available. */
      dwellMinutes: Math.max(
        0,
        Math.round(
          (d.minutes - d.spots.reduce((t, x) => t + x.travelMinutes, 0)) / Math.max(1, d.spots.length),
        ),
      ),
      category: '',
    })),
  }));

interface Props {
  controller: KioskController;
  debug?: boolean;
}

export function InsadongAiCourseResult({ controller }: Props): JSX.Element {
  const { navigate, kioskId } = controller;
  const lang = useLang();
  const long = lang !== 'ko';
  const goHome = (): void => navigate('home', 'Back');
  const setResumeQuestions = useAiStore((s) => s.setResumeQuestions);
  /* Back to the questionnaire this visitor just filled in, not to the course
     picker in front of it — this page is only reached through it. */
  const goBack = (): void => {
    setResumeQuestions(true);
    navigate('ai_search', 'Back');
  };

  const entry = useAiStore((s) => s.entry);
  const courseKey = useAiStore((s) => s.course);
  const pickerPlan = useAiStore((s) => s.pickerPlan);
  const interests = useAiStore((s) => s.interests);
  const visitors = useAiStore((s) => s.visitors);
  const stay = useAiStore((s) => s.stay);
  const transport = useAiStore((s) => s.transport);

  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);

  const [course, setCourse] = useState<JejuCourse | null>(null);
  const [day, setDay] = useState(1);
  const panelRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const catsRef = useRef<HTMLDivElement>(null);

  /* The picks as the `aiCategoryKr` the API matches, prefix included. Memoised
     so it is a stable dependency for both the request and the QR — the prefix
     is recovered from the shop catalogue, so it legitimately changes when that
     catalogue does, and re-asking then is correct. */
  const interestCats = useMemo(() => interestCodes(interests, shops), [interests, shops]);

  /* A themed card carries no picks, so it asks /recommend for its letter. The
     custom route never does — its plan is already in the store. */
  useEffect(() => {
    if (entry !== 'theme' || !courseKey) return;
    let live = true;
    void window.api.jejuCourse
      .recommend({
        course: courseLetter(courseKey),
        transport: transportCode(transport),
        party: partySize(visitors),
        nights: nightCount(stay),
        visitDate: todayIso(),
        /* 쇼핑·로컬 rides on course B and carries the picks the landing preset;
           the other themes send none and let the course's own rules choose. */
        interests: interestCats,
      })
      .then((res) => {
        if (live) setCourse(isOk(res) ? res.value : null);
      });
    return () => {
      live = false;
    };
  }, [entry, courseKey, transport, visitors, stay, interestCats]);

  const days: Day[] = useMemo(() => {
    if (pickerPlan) return fromPlan(pickerPlan);
    if (course) return fromCourse(course);
    return [];
  }, [pickerPlan, course]);

  const byId = useMemo(() => new Map(shops.map((s) => [s.id, s])), [shops]);
  const current = days.find((d) => d.day === day) ?? days[0];
  /* Memoised because `?? []` would hand out a fresh array every render, which
     re-ran the chip-label memo below on every single one. */
  const stops = useMemo(() => current?.stops ?? [], [current]);
  /* 커스텀 코스 chips are the tiles the visitor tapped. A 추천코스 has none, so
     the row is the categories of the stops on the day being shown (7519:76503). */
  const chipLabels = useMemo(() => {
    /* The store keeps these KOREAN (that is what the catalogue matches on), so
       they are translated here rather than shown as stored. */
    if (interests.length > 0) return interests.map((i) => localizeInsaAiPick(i, lang));
    const labels: string[] = [];
    for (const stop of stops) {
      const shop = byId.get(stop.shopId);
      const label = shop
        ? shopSecondCategory(shop, lang) || stripPrefix(shop.aiCategoryKr ?? '')
        : stop.category;
      if (label && !labels.includes(label)) labels.push(label);
    }
    return labels;
  }, [interests, stops, byId, lang]);

  /* The bar reports the day on screen, not the whole trip — it sits directly
     above the DAY tabs and changes with them. */
  const dayTravel = stops.reduce((t, s) => t + s.travelMinutes, 0);
  const dayDwell = stops.reduce((t, s) => t + s.dwellMinutes, 0);
  const dayKm = stops.reduce((t, s) => t + s.travelKm, 0);

  const openStop = (stop: Stop, shop: Shop): void => {
    setDetail({
      from: 'ai_result',
      shopId: shop.id,
      title: 'AI 추천',
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang) || stop.category,
      photos: shopImages(shop),
      address: shopAddress(shop, lang),
      hours: shop.openTime ?? '',
      phone: shop.tel ?? '',
      description: shopDescription(shop, lang),
      tags: '',
      rating: shop.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
      route: shop.route ?? null,
    });
    navigate('ai_detail', 'AI 상세');
  };

  /** Sheet row for THIS language → the authored copy for it → Korean. */
  const line = (key: string, authored: L8): string => sheetText(key, lang, authored);

  useFitText(summaryRef, styles.summaryValueLong, long, 0.62, `${lang}|summary`);
  useFitText(catsRef, styles.catLong, long, 0.6, `${lang}|${chipLabels.join('|')}`);
  useFitText(panelRef, styles.nameLong, long, 0.7, `${lang}|${day}|${stops.length}`);

  const scrollBy = (dy: number): void => panelRef.current?.scrollBy({ top: dy, behavior: 'smooth' });
  const dayCount = Math.max(1, days.length);
  const arrow = iconUrl('scroll-arrow');
  const dwellIcon = iconUrl('course-dwell');

  /*
   * The real direction-fe `/ai` payload, built by the shared helper rather than
   * a hand-rolled string — a scanned QR has to open the phone page, and that
   * page parses this exact contract. Built from `days`, not the day on screen,
   * so switching DAY does not change what the phone receives; the kiosk's
   * 1일차/2일차 tabs are a kiosk-side view of one trip.
   *
   * `course` is the code the PHONE titles the trip with, which is not always the
   * letter the API was asked for: 커스텀 is X, and 쇼핑·로컬 is D even though it
   * requests B — sending B made 제주's phone page call it 맛집·감성.
   */
  const qrValue = useMemo(
    () =>
      buildAiCourseSaveUrlForQr({
        lang,
        kioskNum: Number(kioskId.match(/\d+/)?.[0] ?? 1),
        course: entry === 'custom' ? 'X' : courseKey === 'shop' ? 'D' : courseLetter(courseKey),
        transport: transportCode(transport),
        party: partySize(visitors),
        nights: nightCount(stay),
        interests: interestCats,
        visitDate: todayIso(),
        days: days.map((d) => ({
          day: d.day,
          stops: d.stops.map((stop) => ({
            shopId: stop.shopId,
            dwellMinutes: stop.dwellMinutes,
            travelMinutes: stop.travelMinutes,
            travelKm: stop.travelKm,
          })),
        })),
        totalMinutes: course?.totalMinutes ?? null,
        travelMinutes: course
          ? course.schedule.reduce(
              (sum, d) => sum + d.spots.reduce((n, sp) => n + (sp.travelMinutes ?? 0), 0),
              0,
            )
          : null,
        difficulty: course?.difficulty ?? null,
      }),
    [lang, kioskId, entry, courseKey, transport, visitors, stay, interestCats, days, course],
  );

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader
        /* The id, not a pre-localized string: screenTitle maps it to
           MainButton_AI, which the 인사 tab carries in all eight languages. */
        title="‘인사’ 뭐하지 (AI 검색)"
        subtitle={`${line('AI_Course_Result', TEXT.result)} - ${insaDayTabLabel(day, lang)}`}
        onHome={goHome}
        onBack={goBack}
      />

      <p className={styles.tags}>{line('Tags', TEXT.tags)}</p>

      {qrValue && (
        <div className={styles.qr}>
          <QRCodeSVG value={qrValue} level="M" style={{ width: '100%', height: '100%' }} />
        </div>
      )}

      <div ref={summaryRef} className={styles.summary}>
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>{line('TotalStayTime', TEXT.totalTime)}</span>
          <span className={`${styles.summaryValue} ${long ? styles.summaryValueLong : ''}`}>
            {aboutMinutesLabel(dayTravel + dayDwell, lang)}
          </span>
        </div>
        <span className={styles.summaryRule} />
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>{line('Course_Distance', TEXT.distance)}</span>
          <span className={`${styles.summaryValue} ${long ? styles.summaryValueLong : ''}`}>
            {line('Course_About', TEXT.about)} {dayKm.toFixed(dayKm < 10 ? 1 : 0)}Km
          </span>
        </div>
        <span className={styles.summaryRule} />
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>{line('Course_PartyStay', TEXT.partyStay)}</span>
          <span className={`${styles.summaryValue} ${long ? styles.summaryValueLong : ''}`}>
            {visitors ? localizeInsaAiPick(visitors, lang) : '-'} / {stay ? localizeInsaAiPick(stay, lang) : '-'}
          </span>
        </div>
        <span className={styles.summaryRule} />
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>{line('Transportation_Title', TEXT.transport)}</span>
          <span className={`${styles.summaryValue} ${long ? styles.summaryValueLong : ''}`}>
            {transport ? localizeInsaAiPick(transport, lang) : '-'}
          </span>
        </div>
      </div>

      {chipLabels.length > 0 && (
        <div ref={catsRef} className={styles.cats}>
          {chipLabels.map((c) => (
            <span key={c} className={`${styles.cat} ${long ? styles.catLong : ''}`}>
              {c}
            </span>
          ))}
        </div>
      )}

      <div className={styles.days}>
        {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
          <button
            key={d}
            type="button"
            className={`${styles.day} ${day === d ? styles.dayOn : ''}`}
            onClick={() => setDay(d)}
          >
            DAY {d}
          </button>
        ))}
      </div>

      <div ref={panelRef} className={styles.panel}>
        <div className={styles.inner}>
          {/* 7519:76488 — the course starts at this kiosk. */}
          <div className={styles.origin}>{getKioskLocation(kioskId).name}</div>

          {stops.length === 0 ? (
            <p className={styles.empty}>{line('Course_Empty', TEXT.empty)}</p>
          ) : (
            <div className={styles.timeline}>
              <span className={styles.rail} />
              {stops.map((stop, i) => {
                const shop = byId.get(stop.shopId);
                const photo = shop ? shopImages(shop)[0] : undefined;
                const next = stops[i + 1];
                return (
                  <div key={`${stop.shopId}-${i}`} className={styles.row}>
                    <span className={styles.marker}>{i + 1}</span>
                    <button
                      type="button"
                      className={styles.card}
                      onClick={shop ? () => openStop(stop, shop) : undefined}
                      aria-disabled={shop ? undefined : true}
                    >
                      <span className={styles.cardRow}>
                        <img
                          className={styles.photo}
                          src={photo ?? iconUrl('noimage')}
                          alt=""
                          draggable={false}
                          loading="lazy"
                        />
                        <span className={styles.cardBody}>
                          <span className={styles.titleRow}>
                            <span className={`${styles.name} ${long ? styles.nameLong : ''}`}>
                              {shop ? shopName(shop, lang) : stop.category}
                            </span>
                            <span className={styles.catTag}>
                              #{shop ? shopSecondCategory(shop, lang) || stop.category : stop.category}
                            </span>
                          </span>
                          <span className={styles.desc}>{shop ? shopDescription(shop, lang) : ''}</span>
                          <span className={styles.metaRow}>
                            <img className={styles.metaIcon} src={iconMarker} alt="" draggable={false} />
                            <span className={styles.metaText}>{shop ? shopAddress(shop, lang) : ''}</span>
                          </span>
                          <span className={styles.hoursRow}>
                            <span className={styles.hoursCell}>
                              <img className={styles.hoursIcon} src={iconAlarm} alt="" draggable={false} />
                              <span className={styles.metaText}>{shop?.openTime ?? '-'}</span>
                            </span>
                            <span className={styles.dwellCell}>
                              {dwellIcon && <img className={styles.hoursIcon} src={dwellIcon} alt="" draggable={false} />}
                              <span className={styles.dwellText}>
                                {line('Course_Dwell', TEXT.dwell)} : {minutesLabel(stop.dwellMinutes, lang)}
                              </span>
                            </span>
                          </span>
                        </span>
                      </span>
                    </button>
                    {next && (
                      <span className={styles.travel}>
                        <span>{minutesLabel(next.travelMinutes, lang)}</span>
                        <span>
                          {next.travelKm < 10 ? next.travelKm.toFixed(1) : String(Math.round(next.travelKm))}km
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {stops.length > 0 && (
        <>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollUp}`}
            onClick={() => scrollBy(-466)}
            aria-label={pickLang(TEXT.scrollUp, lang)}
          >
            {arrow && <img className={styles.scrollBtnImg} src={arrow} alt="" draggable={false} />}
          </button>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollDown}`}
            onClick={() => scrollBy(466)}
            aria-label={pickLang(TEXT.scrollDown, lang)}
          >
            {arrow && <img className={styles.scrollBtnImg} src={arrow} alt="" draggable={false} />}
          </button>
        </>
      )}

      <InsadongLeftNav onHome={goHome} onBack={goBack} />
    </>
  );
}
