import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { InsaCourse, InsaDuration } from '@shared/types/insaCourse';
import { isOk } from '@shared/types/result';
import type { Shop } from '@shared/types/shop';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useAiStore } from '@renderer/store/aiStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { pick as pickLang, useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { buildAiCourseSaveUrlForQr } from '@renderer/lib/aiCourseSave';
import {
  aboutMinutesLabel,
  courseLetter,
  minutesLabel,
  partySize,
  todayIso,
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
import { localizeOsanAiPick, osanAiTitle } from './OsanAiCourse';
import { OsanHeader } from './OsanHeader';
import { OsanLeftNav } from './OsanLeftNav';
import { OsanPageBg } from './OsanPageBg';
import { osanShopDetail } from './osanShopDetail';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import styles from './OsanAiCourseResult.module.css';

/**
 * AI 맞춤 추천 코스 (오산) — Figma 오산>코스 결과-01 7812:110989.
 *
 * The 인사동 result page (InsadongAiCourseResult) in 오색시장 navy: summary bar of
 * 총 소요시간 · 이동거리 · 방문 인원 · 일정, the picked 즐길 거리, then 실시간 / 일반
 * 코스 tabs over a numbered walking timeline that starts at this kiosk, and the
 * QR that sends the course to a phone.
 *
 * The routes are `POST /api/insa/courses/recommend/v2`'s answer, made by the
 * builder (OsanAiCourse) and left in the store as `insaCourse`. Nothing is made
 * up here: a refused or failed call leaves the store empty and this page draws
 * its empty state.
 *
 * Copy resolves sheet-row-for-this-language → authored copy → Korean (`line`,
 * over `sheetText`). The keys are the renewal vocabulary the other kiosks use;
 * Localization_Osaek has none of them yet, so the authored text shows until it
 * does. The visitor's chip answers are translated back through the builder's
 * own chip tables (`localizeOsanAiPick`).
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
  /** 7519:75284's hashtag line — sheet row `Insa_Todo_result_tags` since 2026-09-30, authored until it is filled. */
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
  visitors: {
    ko: '방문 인원', en: 'Number of Visitors', ja: '訪問人数', zh: '访问人数',
    vi: 'Số người', th: 'จำนวนผู้เยี่ยมชม', ru: 'Число гостей', id: 'Jumlah pengunjung',
  } as L8,
  schedule: {
    ko: '일정', en: 'Schedule', ja: '日程', zh: '行程',
    vi: 'Lịch trình', th: 'กำหนดการ', ru: 'Время', id: 'Jadwal',
  } as L8,
  /** 7764:9879 / 7764:9878 — the two course tabs over the list. */
  realtime: {
    ko: '실시간 코스', en: 'Real-time course', ja: 'リアルタイムコース', zh: '实时路线',
    vi: 'Lộ trình theo giờ thực', th: 'เส้นทางเรียลไทม์', ru: 'Маршрут сейчас', id: 'Rute real-time',
  } as L8,
  general: {
    ko: '일반 코스', en: 'Standard course', ja: '一般コース', zh: '普通路线',
    vi: 'Lộ trình thường', th: 'เส้นทางทั่วไป', ru: 'Обычный маршрут', id: 'Rute umum',
  } as L8,
  /** The body when the picked categories and tab leave nothing to show (night, a
   *  tab with no route, a failed call). Localization_Insa `NotAvailableTime` —
   *  authored here only as the fallback for a kiosk that has not synced the row. */
  notAvailable: {
    ko: '지금은 너무 이르거나 늦은 시간입니다! 잠시 후 다시 이용해 주세요.',
    en: 'It is currently too early or too late! Please try again in a moment.',
    ja: '現在は時間が早すぎるか遅すぎます！しばらくしてからもう一度ご利用ください。',
    zh: '现在时间太早或太晚！请稍后再试。',
    vi: 'Hiện tại quá sớm hoặc quá muộn! Vui lòng thử lại sau giây lát.',
    th: 'ตอนนี้ยังเช้าเกินไปหรือดึกเกินไป! กรุณาลองใหม่อีกครั้งในอีกสักครู่ค่ะ',
    ru: 'Сейчас слишком рано или слишком поздно! Пожалуйста, попробуйте еще раз позже.',
    id: 'Saat ini terlalu awal atau terlalu larut! Silakan coba lagi beberapa saat lagi.',
  } as L8,
  /** 7681:59356 — the origin plate reads "출발 지점 > {kiosk}". */
  start: {
    ko: '출발 지점', en: 'Start', ja: '出発地点', zh: '出发地点',
    vi: 'Điểm xuất phát', th: 'จุดเริ่มต้น', ru: 'Старт', id: 'Titik awal',
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
  /** Names the 추천코스 refresh button (it draws only a glyph). */
  refresh: {
    ko: '코스 다시 추천받기', en: 'Recommend again', ja: 'もう一度おすすめ', zh: '重新推荐',
    vi: 'Gợi ý lại', th: 'แนะนำใหม่', ru: 'Подобрать заново', id: 'Rekomendasikan lagi',
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

/** One scheduled stop. */
interface Stop {
  shopId: number;
  order: number;
  /** Walking INTO this stop from the previous one. */
  travelMinutes: number;
  travelKm: number;
  dwellMinutes: number;
  /** The 즐길 거리 this stop was picked for, prefix stripped. */
  category: string;
  /** `default` = a category-typical guess at the opening hours: never shown as a time. */
  hoursMethod: string;
  /** The API's own name for the stop — only for a shop the catalogue no longer holds. */
  name: string;
}

interface Day {
  day: number;
  stops: Stop[];
}

const fromInsa = (course: InsaCourse): Day[] =>
  course.spots.length === 0
    ? []
    : [
        {
          day: 1,
          stops: course.spots.map((sp) => ({
            shopId: sp.shopId,
            order: sp.order,
            travelMinutes: sp.walkMinutes,
            travelKm: sp.walkMeters / 1000,
            dwellMinutes: sp.stayMinutes,
            category: stripPrefix(sp.secondCategory),
            hoursMethod: sp.hoursMethod,
            name: sp.name,
          })),
        },
      ];

interface Props {
  controller: KioskController;
}

export function OsanAiCourseResult({ controller }: Props): JSX.Element {
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
  const low = useAccessibilityStore((s) => s.lowReach);
  const courseKey = useAiStore((s) => s.course);
  const insaCourse = useAiStore((s) => s.insaCourse);
  const interests = useAiStore((s) => s.interests);
  const visitors = useAiStore((s) => s.visitors);
  const stay = useAiStore((s) => s.stay);

  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const setInsaCourse = useAiStore((s) => s.setInsaCourse);

  /*
   * 오산>코스 결과-02 (7812:110718) — a 추천코스 result carries a refresh button
   * under the home button. It asks the course API again with the same answers
   * and the clock as it is NOW, so the 실시간 코스 follows what is open at this
   * moment. Nothing is reshuffled on the kiosk: whatever the API answers is shown.
   */
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async (): Promise<void> => {
    if (refreshing) return;
    setRefreshing(true);
    const d = new Date();
    const p = (n: number): string => String(n).padStart(2, '0');
    const res = await window.api.insaCourse.recommend({
      interests,
      duration: (stay as InsaDuration) || '2-4',
      numberOfPeople: partySize(visitors),
      startAt: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
    });
    setInsaCourse(isOk(res) ? res.value : null);
    setRefreshing(false);
  };

  /* 7764:9879 / 7764:9878 — 실시간 코스 is the route scheduled from now (the
     API's answer, below). 일반 코스 has its own API on the way; until then its
     tab switches to a 준비 중 note. */
  const realtimeRoute = insaCourse?.realtime;
  const generalRoute = insaCourse?.general;
  /* Nothing open now (night): open on the 일반 코스 instead of an empty list. */
  const realtimeOpen = !!realtimeRoute && realtimeRoute.available && realtimeRoute.spots.length > 0;
  const [tab, setTab] = useState<'realtime' | 'general'>(realtimeOpen || !generalRoute ? 'realtime' : 'general');
  /* Both tabs are always drawn (the frame has both). When the API reports
     `sameAsRealtime` — common for the short slots in the daytime — the 일반 코스
     simply lists the same places. */
  const tabIds: ('realtime' | 'general')[] = ['realtime', 'general'];
  const route = tab === 'general' ? generalRoute : realtimeRoute;
  const panelRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const catsRef = useRef<HTMLDivElement>(null);

  const days: Day[] = useMemo(() => (route ? fromInsa(route) : []), [route]);

  const byId = useMemo(() => new Map(shops.map((s) => [s.id, s])), [shops]);
  /* The API schedules ONE walking day, so there is no day pager. */
  const current = days[0];
  /* Memoised because `?? []` would hand out a fresh array every render, which
     re-ran the chip-label memo below on every single one. */
  const stops = useMemo(() => current?.stops ?? [], [current]);
  /* 커스텀 코스 chips are the tiles the visitor tapped. A 추천코스 has none, so
     the row is the categories of the stops on the day being shown (7519:76503). */
  const chipLabels = useMemo(() => {
    /* `interests` are the API's `N-name` codes; the label is the catalogue's own
       (localized) name for that category, taken from any shop that carries it. */
    if (interests.length > 0) {
      return interests.map((code) => {
        const shop = shops.find((sh) => sh.secondCategoryKr?.trim() === code);
        return shop ? shopSecondCategory(shop, lang) || stripPrefix(code) : stripPrefix(code);
      });
    }
    const labels: string[] = [];
    for (const stop of stops) {
      const shop = byId.get(stop.shopId);
      const label = shop
        ? shopSecondCategory(shop, lang) || stripPrefix(shop.aiCategoryKr ?? '')
        : stop.category;
      if (label && !labels.includes(label)) labels.push(label);
    }
    return labels;
  }, [interests, shops, stops, byId, lang]);

  /* The bar reports the day on screen, not the whole trip — it sits directly
     above the DAY tabs and changes with them. */
  const dayTravel = stops.reduce((t, s) => t + s.travelMinutes, 0);
  const dayDwell = stops.reduce((t, s) => t + s.dwellMinutes, 0);
  /* The API's own totals win over a re-sum of the legs. */
  const totalMinutes = route?.totalMinutes || dayTravel + dayDwell;
  const dayKm = route ? route.totalWalkMeters / 1000 : stops.reduce((t, s) => t + s.travelKm, 0);

  const openStop = (stop: Stop, shop: Shop): void => {
    /* The shared payload, so the stop's 상세 carries its tags and photos (or the
       no-image plate) exactly as from the lists. */
    const base = osanShopDetail(shop, lang, 'ai_result', 'AI 추천', osanIconUrl('noimage'));
    setDetail({
      ...base,
      shopId: shop.id,
      category: base.category || stop.category,
      route: shop.route ?? null,
    });
    navigate('ai_detail', 'AI 상세');
  };

  /** Sheet row for THIS language → the authored copy for it → Korean. */
  const line = (key: string, authored: L8): string => sheetText(key, lang, authored);

  useFitText(summaryRef, styles.summaryValueLong, long, 0.62, `${lang}|summary`);
  useFitText(catsRef, styles.catLong, long, 0.6, `${lang}|${chipLabels.join('|')}`);
  useFitText(panelRef, styles.nameLong, long, 0.7, `${lang}|${tab}|${stops.length}`);

  /* 7681:59372 — the scroll position is drawn on the artboard's right edge (a
     34px pill at x2128), not as a bar inside the panel. Track and thumb are
     fractions of the panel's own scroll range; null when nothing scrolls. */
  const [thumb, setThumb] = useState<{ top: number; size: number } | null>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return undefined;
    const sync = (): void => {
      const range = el.scrollHeight - el.clientHeight;
      if (range <= 1) return setThumb(null);
      const size = Math.min(1, el.clientHeight / el.scrollHeight);
      setThumb({ size, top: (el.scrollTop / range) * (1 - size) });
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [tab, stops.length]);

  const scrollBy = (dy: number): void => panelRef.current?.scrollBy({ top: dy, behavior: 'smooth' });
  const arrow = osanIconUrl('scroll-arrow');
  const dwellIcon = osanIconUrl('course-dwell');
  const markerIcon = osanIconUrl('marker');
  const alarmIcon = osanIconUrl('alarm');

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
        transport: 'WALK',
        party: partySize(visitors),
        nights: 0,
        interests,
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
        totalMinutes: route?.totalMinutes ?? null,
        distanceKm: route ? route.totalWalkMeters / 1000 : null,
        stay,
        travelMinutes: route ? route.spots.reduce((n, sp) => n + sp.walkMinutes, 0) : null,
        difficulty: null,
      }),
    [lang, kioskId, entry, courseKey, visitors, interests, days, route, stay],
  );

  return (
    <>
      <OsanPageBg />

      <OsanHeader
        title={osanAiTitle(lang)}
        subtitle={line('Insa_Todo_result_Subtitle', TEXT.result)}
        strongSubtitle
        onHome={goHome}
        onBack={goBack}
      />

      {entry === 'theme' && (
        <button
          type="button"
          className={low ? `${styles.refreshBtn} ${styles.refreshBtnLow}` : styles.refreshBtn}
          onClick={() => void refresh()}
          disabled={refreshing}
          aria-label={line('Course_Refresh', TEXT.refresh)}
        >
          {osanIconUrl('course-refresh') && <img src={osanIconUrl('course-refresh')} alt="" draggable={false} />}
        </button>
      )}

      <p className={styles.tags}>{line('Insa_Todo_result_tags', TEXT.tags)}</p>

      {qrValue && (
        <div className={styles.qr}>
          <QRCodeSVG value={qrValue} level="M" style={{ width: '100%', height: '100%' }} />
        </div>
      )}

      <div ref={summaryRef} className={styles.summary}>
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>{line('TotalStayTime', TEXT.totalTime)}</span>
          <span className={`${styles.summaryValue} ${long ? styles.summaryValueLong : ''}`}>
            {aboutMinutesLabel(totalMinutes, lang)}
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
          <span className={`${styles.summaryLabel} ${styles.summaryLabelLarge}`}>{line('Visitor_Title', TEXT.visitors)}</span>
          <span className={`${styles.summaryValue} ${long ? styles.summaryValueLong : ''}`}>
            {visitors ? localizeOsanAiPick(visitors, lang) : '-'}
          </span>
        </div>
        <span className={styles.summaryRule} />
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>{line('Insa_Todo_result_Schedule', TEXT.schedule)}</span>
          <span className={`${styles.summaryValue} ${long ? styles.summaryValueLong : ''}`}>
            {stay ? localizeOsanAiPick(stay, lang) : '-'}
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

      <div className={styles.panel}>
        <div className={styles.tabs} role="tablist">
          {tabIds.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`${styles.tab} ${tab === id ? styles.tabOn : ''}`}
              onClick={() => setTab(id)}
            >
              {line(id === 'realtime' ? 'Insa_Todo_result_Realtime' : 'Insa_Todo_result_General', TEXT[id])}
            </button>
          ))}
        </div>

        <div ref={panelRef} className={styles.scroll}>
        <div className={styles.inner}>
          {/* 7681:59356 — "출발 지점 > …": the course starts at this kiosk. */}
          <div className={styles.origin}>
            {line('Insa_Todo_result_Start', TEXT.start)} &gt; {getKioskLocation(kioskId).name}
          </div>

          {stops.length === 0 ? (
            <p className={styles.empty}>{line('NotAvailableTime', TEXT.notAvailable)}</p>
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
                          src={photo ?? osanIconUrl('noimage')}
                          alt=""
                          draggable={false}
                          loading="lazy"
                        />
                        <span className={styles.cardBody}>
                          <span className={styles.titleRow}>
                            <span className={`${styles.name} ${long ? styles.nameLong : ''}`}>
                              {shop ? shopName(shop, lang) : stop.name || stop.category}
                            </span>
                            <span className={styles.catTag}>
                              #{shop ? shopSecondCategory(shop, lang) || stop.category : stop.category}
                            </span>
                          </span>
                          <span className={styles.desc}>{shop ? shopDescription(shop, lang) : ''}</span>
                          <span className={styles.metaRow}>
                            {markerIcon && <img className={styles.metaIcon} src={markerIcon} alt="" draggable={false} />}
                            <span className={styles.metaText}>{shop ? shopAddress(shop, lang) : ''}</span>
                          </span>
                          <span className={styles.hoursRow}>
                            <span className={styles.hoursCell}>
                              {alarmIcon && <img className={`${styles.hoursIcon} ${styles.alarmIcon}`} src={alarmIcon} alt="" draggable={false} />}
                              <span className={styles.metaText}>
                                {stop.hoursMethod === 'default' ? '-' : (shop?.openTime ?? '-')}
                              </span>
                            </span>
                            <span className={styles.dwellCell}>
                              <span className={styles.dwellFrame}>{dwellIcon && <img src={dwellIcon} alt="" draggable={false} />}</span>
                              <span className={styles.dwellText}>
                                {line('TimeToAdjourn', TEXT.dwell)} : {minutesLabel(stop.dwellMinutes, lang)}
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
      </div>

      {thumb && (
        <div className={styles.track} aria-hidden>
          <span
            className={styles.thumb}
            style={{ top: `${thumb.top * 100}%`, height: `${thumb.size * 100}%` }}
          />
        </div>
      )}

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

      <OsanLeftNav onHome={goHome} onBack={goBack} />
    </>
  );
}
