/**
 * ON HOLD (2026-11-18): 롯데 미션 is not decided yet, so this screen is NOT routed (LotteKiosk) and
 * has no screen id. Re-add `'mission'` to KioskScreenId and a route when it is.
 *
 * 롯데 미션 — Figma page '#W011~13=롯데(키오스크)-롯데 미션 (2026-11-16)':
 *   M-01 목록 (8804:1279) · M-02 상세 한 곳 (8804:1599) · M-03 상세 여러 곳 (8804:1919) ·
 *   M-04 종료 · 일시 중지 (8804:2239).
 *
 * The kiosk is where a visitor FINDS a mission. The QR here (발견 QR) only opens the mission in the
 * WITS app — points come from the store's own QR, which is a different code (기획서). So nothing
 * on these screens is personal: the stamp route is an illustration, not progress.
 */
import { useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { LottePageFrame } from './LottePageFrame';
import { LotteQr } from './LotteQr';
import { LotteSteps } from './LotteSteps';
import { LOTTE_LINKS, withQuery } from './lotteLinks';
import {
  isMulti,
  lotteMissions,
  missionIntro,
  typeLabel,
  type Mission,
} from './lotteMissions';
import ui from './lotteUi.module.css';
import s from './LotteMission.module.css';

type Filter = 'all' | 'single' | 'multi';
const FLOW = ['미션 찾기', '매장 QR 찍기', '포인트 적립', '혜택 교환'] as const;

export function LotteMission({ controller }: { controller: KioskController }): JSX.Element {
  const missions = useMemo(() => lotteMissions(controller.kioskId), [controller.kioskId]);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const open = missions.find((m) => m.id === openId);

  if (open) {
    const back = (): void => setOpenId(null);
    if (open.status !== 'open') {
      return (
        <Closed
          controller={controller}
          mission={open}
          others={missions.filter((m) => m.status === 'open').slice(0, 2)}
          onOpen={setOpenId}
          onBack={back}
        />
      );
    }
    return <Detail controller={controller} mission={open} onBack={back} />;
  }

  const counts = {
    all: missions.length,
    single: missions.filter((m) => !isMulti(m)).length,
    multi: missions.filter(isMulti).length,
  };
  const shown = missions.filter(
    (m) => filter === 'all' || (filter === 'multi') === isMulti(m),
  );
  const FILTERS: readonly { id: Filter; label: string }[] = [
    { id: 'all', label: `전체 ${counts.all}` },
    { id: 'single', label: `한 곳 방문 ${counts.single}` },
    { id: 'multi', label: `여러 곳 방문 ${counts.multi}` },
  ];

  return (
    <LottePageFrame
      controller={controller}
      title="롯데 미션"
      subtitle="미션을 고르면 자세한 내용과 QR 이 나와요"
      showBanner={false}
    >
      <div className={ui.column}>
        <div className={s.hero}>
          <span className={s.heroTitle}>롯데 미션</span>
          <span className={s.heroBody}>
            {missionIntro(controller.kioskId)}
            <br />
            포인트를 모아 제휴 혜택으로 바꿔요.
          </span>
          <div className={s.flow}>
            {FLOW.map((f, i) => (
              <span key={f} className={s.flowItem}>
                {i > 0 && <span className={s.flowArrow}>›</span>}
                <span className={s.flowPill}>
                  <b>{i + 1}</b>
                  {f}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className={s.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`${s.filter} ${f.id === filter ? s.filterOn : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={s.list}>
          {shown.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`${s.row} ${m.status !== 'open' ? s.rowOff : ''}`}
              onClick={() => setOpenId(m.id)}
            >
              <span className={s.thumb}>미션 이미지</span>
              <span className={s.rowText}>
                <TypePill mission={m} />
                <span className={s.rowTitle}>{m.title}</span>
                <span className={s.rowLine}>{m.listLine}</span>
              </span>
              <span className={s.rowSide}>
                <span className={s.points}>+{m.points}P</span>
                <span className={m.status === 'open' ? s.stateOpen : s.stateOff}>
                  {m.status === 'open' ? '진행 가능' : m.status === 'ended' ? '종료' : '일시 중지'}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className={ui.qrCard}>
          <LotteQr value={LOTTE_LINKS.missions} />
          <div className={ui.qrText}>
            <span className={ui.qrTitle}>포인트 · 혜택은 휴대폰에서 확인해요</span>
            <span className={ui.qrSub}>
              QR 을 찍으면 WITS 앱의 &apos;내 포인트&apos;가 열려요. 앱이 없으면 설치 안내로 이어져요.
            </span>
          </div>
        </div>

        <p className={s.footNote}>포인트는 매장에 붙은 QR 을 앱으로 찍을 때만 쌓여요</p>
      </div>
    </LottePageFrame>
  );
}

/**
 * The stamp route: one stamp per place, then the 완료 stamp. Four or more places wrap onto two
 * rows (M-03 spec) so the 220 stamps keep their size.
 */
function routeRows(
  mission: Mission,
): { key: string; mark: string; name: string; sub: string; done: boolean }[][] {
  const stops = [
    ...mission.places!.map((p) => ({ key: p.letter, mark: p.letter, name: p.short, sub: p.floor, done: false })),
    { key: 'done', mark: `${mission.points}P`, name: '완료', sub: '한 번에 지급', done: true },
  ];
  if (stops.length <= 4) return [stops];
  const half = Math.ceil(stops.length / 2);
  return [stops.slice(0, half), stops.slice(half)];
}

function TypePill({ mission }: { mission: Mission }): JSX.Element {
  return <span className={isMulti(mission) ? s.typeMulti : s.typeSingle}>{typeLabel(mission)}</span>;
}

function Detail({
  controller,
  mission,
  onBack,
}: {
  controller: KioskController;
  mission: Mission;
  onBack: () => void;
}): JSX.Element {
  const multi = isMulti(mission);
  const qr = withQuery(LOTTE_LINKS.missionDetail, 'mission', mission.id);
  return (
    <LottePageFrame
      controller={controller}
      title="미션 상세"
      subtitle={
        multi
          ? `${mission.places!.length}곳을 모두 찍으면 포인트를 한 번에 받아요`
          : '휴대폰으로 QR 을 찍으면 앱에서 이어서 해요'
      }
      showBanner={false}
      onBack={onBack}
    >
      <div className={ui.column}>
        <div className={`${s.hero} ${s.heroDetail}`}>
          <span className={s.heroTag}>{typeLabel(mission, true)}</span>
          <span className={s.heroTitle}>{mission.title}</span>
          <span className={s.heroBody}>{mission.summary}</span>
          <span className={s.heroPoints}>
            <b>+{mission.points}P</b>
            {mission.pointsNote}
          </span>
        </div>

        {multi ? (
          <>
            <div className={`${ui.card} ${s.routeCard}`}>
              {routeRows(mission).map((row, ri) => (
                <div key={ri} className={s.route}>
                  {row.map((st, i) => (
                    <span key={st.key} className={s.stopWrap}>
                      {i > 0 && <span className={s.connector} />}
                      <span className={s.stop}>
                        <span className={`${s.stamp} ${st.done ? s.stampDone : ''}`}>{st.mark}</span>
                        <span className={s.stopName}>{st.name}</span>
                        <span className={s.stopFloor}>{st.sub}</span>
                      </span>
                    </span>
                  ))}
                </div>
              ))}
              <span className={s.caption}>
                매장 1곳 = 스탬프 1개 (그림은 예시 · 개인 진행 상태가 아님)
              </span>
            </div>

            <div className={s.table}>
              {mission.places!.map((p) => (
                <div key={p.letter} className={s.place}>
                  <span className={s.letter}>{p.letter}</span>
                  <span className={s.placeText}>
                    <span className={s.placeName}>{p.name}</span>
                    <span className={s.placeWhere}>{p.where}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className={s.rules}>
              <span>·  첫 매장 QR 을 찍으면 미션이 저절로 시작돼요</span>
              <span>·  순서는 상관없어요 · 같은 곳은 한 번만 찍혀요</span>
              <span>
                ·  곳마다 나눠 주지 않고, {mission.places!.length}곳을 다 찍으면 {mission.points}P 를
                한 번에 드려요
              </span>
            </div>
          </>
        ) : (
          <>
            {mission.imageUrl ? (
              <img src={mission.imageUrl} alt="" className={s.cover} draggable={false} />
            ) : (
              <div className={s.cover}>미션 대표 이미지 (관리자 등록)</div>
            )}
            {mission.info && (
              <div className={s.table}>
                {(
                  [
                    ['장소', mission.info.place],
                    ['기간', mission.info.period],
                    ['참여 조건', mission.info.condition],
                    ['매장 QR 위치', mission.info.qrSpot],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className={s.info}>
                    <span className={s.infoKey}>{k}</span>
                    <span className={s.infoValue}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            <LotteSteps
              compact
              steps={[
                { title: '이 QR 로 앱에서 미션 열기', sub: "따로 '참여' 버튼은 없어요" },
                { title: '매장에 가서 매장 QR 찍기', sub: '찍는 순간 참여 + 인증이 한 번에' },
                { title: `바로 +${mission.points}P 적립`, sub: '서버가 확인하면 즉시 들어와요' },
              ]}
            />
          </>
        )}

        <div className={ui.qrCard}>
          <LotteQr value={qr} />
          <div className={ui.qrText}>
            <span className={ui.qrTitle}>휴대폰으로 QR 을 찍어 미션을 열어요</span>
            <span className={ui.qrSub}>
              {multi
                ? '내 스탬프 · 진행률은 앱에서 볼 수 있어요. 이 QR 로는 포인트가 쌓이지 않아요.'
                : '이 QR 은 미션을 여는 용도예요. 포인트는 매장 QR 을 찍어야 쌓여요.'}
            </span>
          </div>
        </div>
      </div>
    </LottePageFrame>
  );
}

function Closed({
  controller,
  mission,
  others,
  onOpen,
  onBack,
}: {
  controller: KioskController;
  mission: Mission;
  others: readonly Mission[];
  onOpen: (id: string) => void;
  onBack: () => void;
}): JSX.Element {
  const ended = mission.status === 'ended';
  return (
    <LottePageFrame
      controller={controller}
      title="미션 상세"
      subtitle="이 미션은 지금 참여할 수 없어요"
      showBanner={false}
      onBack={onBack}
    >
      <div className={ui.column}>
        <div className={`${s.hero} ${s.heroClosed}`}>
          <span className={s.heroTag}>{ended ? '종료' : '일시 중지'}</span>
          <span className={s.heroTitle}>{mission.title}</span>
          <span className={s.heroBody}>{mission.closedLine ?? mission.listLine}</span>
        </div>

        <div className={s.status}>
          <span className={s.bang}>!</span>
          <span className={s.statusTitle}>{ended ? '이 미션은 끝났어요' : '잠시 쉬어 가요'}</span>
          <span className={s.statusBody}>
            {ended ? (
              <>
                이제 매장 QR 을 찍어도 포인트가 쌓이지 않아요.
                <br />
                이미 받은 포인트는 사라지지 않아요.
              </>
            ) : (
              <>
                다시 열리면 이어서 참여할 수 있어요.
                {isMulti(mission) && (
                  <>
                    <br />
                    이미 모은 스탬프가 그대로 남아요.
                  </>
                )}
              </>
            )}
          </span>
        </div>

        {others.length > 0 && (
          <div className={s.others}>
            <span className={s.othersTitle}>지금 할 수 있는 미션</span>
            {others.map((m) => (
              <button key={m.id} type="button" className={`${s.row} ${s.rowSmall}`} onClick={() => onOpen(m.id)}>
                <span className={s.thumb}>미션 이미지</span>
                <span className={s.rowText}>
                  <TypePill mission={m} />
                  <span className={s.rowTitle}>{m.title}</span>
                  <span className={s.rowLine}>{m.until}</span>
                </span>
                <span className={s.points}>+{m.points}P</span>
              </button>
            ))}
          </div>
        )}

        <button type="button" className={s.toList} onClick={onBack}>
          미션 목록으로
        </button>
      </div>
    </LottePageFrame>
  );
}
