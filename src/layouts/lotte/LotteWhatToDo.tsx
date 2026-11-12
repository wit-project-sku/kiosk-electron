/**
 * 롯데 뭐하지 (Figma #W011~13 뭐하지-입력·결과) — the 인사 뭐하지 screens without a walking route:
 * 방문 인원 · 머무는 시간 · 즐길 거리, then a few places in visiting order.
 */
import { useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { useDetailStore } from '@renderer/store/detailStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useShopStore } from '@renderer/store/shopStore';
import {
  shopAddress,
  shopDescription,
  shopImages,
  shopName,
  shopOpenTime,
} from '@renderer/lib/shops';
import { LottePageFrame } from './LottePageFrame';
import { shopDetail } from './lotteDetailItem';
import { shopFloor } from './lotteSample';
import {
  MAX_PICKS,
  PARTY_OPTIONS,
  STAY_OPTIONS,
  VISIT_INTERESTS,
  interestsFor,
  planVisit,
} from './lotteVisitPlan';
import s from './LotteWhatToDo.module.css';

const TITLE = "'롯데' 뭐하지";

export interface LotteVisitChoice {
  party: number;
  stay: number;
  picks: readonly string[];
}

interface Props {
  controller: KioskController;
  plan: LotteVisitChoice | null;
  onPlan: (plan: LotteVisitChoice | null) => void;
}

export function LotteWhatToDo({ controller, plan, onPlan }: Props): JSX.Element {
  const shops = useShopStore((st) => st.shops);
  return plan ? (
    <Result controller={controller} plan={plan} onAgain={() => onPlan(null)} shops={shops} />
  ) : (
    <Builder controller={controller} onDone={onPlan} shops={shops} />
  );
}

type Shops = ReturnType<typeof useShopStore.getState>['shops'];

function Builder({
  controller,
  onDone,
  shops,
}: {
  controller: KioskController;
  onDone: (p: LotteVisitChoice) => void;
  shops: Shops;
}): JSX.Element {
  const [party, setParty] = useState(1);
  const [stay, setStay] = useState(1);
  const [picks, setPicks] = useState<readonly string[]>([]);
  const interests = useMemo(() => interestsFor(shops), [shops]);
  const toggle = (id: string): void =>
    setPicks((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_PICKS ? [...cur, id] : cur,
    );
  return (
    <LottePageFrame
      controller={controller}
      title={TITLE}
      subtitle="인원과 시간을 알려 주시면 갈 곳을 골라 드립니다"
    >
      <p className={s.note}>*머무는 시간에 맞춰 2~5곳을 추천해 드립니다.</p>
      <div className={s.builder}>
        <section>
          <h3 className={s.head}>방문 인원</h3>
          <div className={s.choices}>
            {PARTY_OPTIONS.map((label, i) => (
              <button
                key={label}
                type="button"
                aria-pressed={party === i}
                className={`${s.choice} ${party === i ? s.choiceOn : ''}`}
                onClick={() => setParty(i)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3 className={s.head}>머무는 시간</h3>
          <div className={s.choices}>
            {STAY_OPTIONS.map((o, i) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={stay === i}
                className={`${s.choice} ${stay === i ? s.choiceOn : ''}`}
                onClick={() => setStay(i)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3 className={s.head}>즐길 거리</h3>
          <div className={s.tiles}>
            {interests.map((i) => {
              const order = picks.indexOf(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={order >= 0}
                  className={`${s.tile} ${order >= 0 ? s.tileOn : ''}`}
                  onClick={() => toggle(i.id)}
                >
                  {i.label}
                  {order >= 0 && <span className={s.badge}>{order + 1}</span>}
                </button>
              );
            })}
          </div>
        </section>
        <button
          type="button"
          className={s.cta}
          disabled={picks.length === 0}
          onClick={() => onDone({ party, stay, picks })}
        >
          장소 추천받기
        </button>
      </div>
    </LottePageFrame>
  );
}

function Result({
  controller,
  plan,
  onAgain,
  shops,
}: {
  controller: KioskController;
  plan: LotteVisitChoice;
  onAgain: () => void;
  shops: Shops;
}): JSX.Element {
  const lang = useLanguageStore((st) => st.currentLanguage);
  const setDetail = useDetailStore((st) => st.setItem);
  const stops = useMemo(() => planVisit(shops, plan.picks, plan.stay, plan.party), [shops, plan]);
  const floors = new Set(stops.map((x) => shopFloor(x.shop))).size;
  const stats: ReadonlyArray<[string, string]> = [
    ['머무는 시간', STAY_OPTIONS[plan.stay]!.label],
    ['방문 인원', PARTY_OPTIONS[plan.party]!],
    ['추천 장소', `${stops.length}곳`],
    ['둘러볼 층', `${floors}개 층`],
  ];
  const noImage = lotteIconUrl('noimage');
  return (
    <LottePageFrame
      controller={controller}
      title={TITLE}
      subtitle="고른 조건에 맞는 곳을 모았습니다"
      onBack={onAgain}
      showBanner={false}
    >
      <button type="button" className={s.again} onClick={onAgain} aria-label="다시 고르기">
        {lotteIconUrl('ico-refresh') && (
          <img src={lotteIconUrl('ico-refresh')} alt="" draggable={false} />
        )}
      </button>
      <div className={s.stats}>
        {stats.map(([k, v]) => (
          <div key={k} className={s.stat}>
            <small>{k}</small>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <div className={s.picked}>
        {plan.picks.map((id) => (
          <span key={id} className={s.pickedChip}>
            {VISIT_INTERESTS.find((i) => i.id === id)?.label}
          </span>
        ))}
      </div>
      <div className={s.panel}>
        <div className={s.start}>출발 지점 &gt; 키오스크 앞</div>
        {stops.length === 0 && (
          <div className={s.none}>조건에 맞는 곳을 찾지 못했습니다. 다시 골라 주세요.</div>
        )}
        {stops.map(({ shop, interest, minutes, walkMinutes }, i) => (
          <div key={shop.id}>
            <div className={s.stop}>
              <span className={s.num}>{i + 1}</span>
              <button
                type="button"
                className={s.card}
                onClick={() => {
                  setDetail(shopDetail(shop, 'ai_search', TITLE, lang));
                  controller.navigate('detail', '롯데 뭐하지');
                }}
              >
                <img
                  className={s.photo}
                  src={shopImages(shop)[0] ?? noImage}
                  alt=""
                  draggable={false}
                />
                <span className={s.cardText}>
                  <span className={s.cardTop}>
                    <b>{shopName(shop, lang)}</b>
                    <em>#{interest.label}</em>
                  </span>
                  <span className={s.desc}>{shopDescription(shop, lang)}</span>
                  <span className={s.fact}>{shopAddress(shop, lang)}</span>
                  <span className={s.facts}>
                    <span className={s.fact}>{shopOpenTime(shop.openTime)}</span>
                    <span className={s.fact}>머무는 시간 : 약 {minutes}분</span>
                  </span>
                </span>
              </button>
            </div>
            {walkMinutes !== null && <div className={s.walk}>{walkMinutes}분</div>}
          </div>
        ))}
      </div>
    </LottePageFrame>
  );
}
