import { useState, type JSX } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { AnalysisResult, Ingredient } from './api';
import { ingredientIconSources } from './ingredients';
import type { ShareState } from './share';
import { fillmeArtUrl } from '@renderer/assets/fillme';
import { Icon } from './Icon';
import { useLang } from '@renderer/lib/i18n';
import { tx } from './text';
import ui from './fillmeUi.module.css';
import styles from './FillmeResult.module.css';

interface Props {
  result: AnalysisResult;
  /** 결과 QR — 결과 이미지를 서버에 올리는 중 / 주소 받음 / 실패. off 면 QR·저장하기 없이 처음으로만. */
  share: ShareState;
  onRetryShare: () => void;
  onHome: () => void;
}

/** 성분 아이콘: 번들 복사본 우선 → 서버 주소 → 알약 아이콘. */
function IngredientIcon({ ingredient }: { ingredient: Ingredient }): JSX.Element {
  const { local, server } = ingredientIconSources(ingredient);
  const [src, setSrc] = useState<string | null>(local ?? server);
  if (!src) return <Icon name="pill" size={120} strokeWidth={1.6} className={styles.pill} />;
  return (
    <img
      src={src}
      alt=""
      className={styles.ingredientIcon}
      onError={() => setSrc(src === local && server ? server : null)}
    />
  );
}

/**
 * 분석 결과 — Figma 7334:83586. 좌표와 시안과 다른 곳은 스타일시트 머리말 참고.
 *
 * ★ 시안의 '75점 · 전반적으로 양호해요' 줄은 그리지 않는다. FillMe 분석 API 가
 *   돌려주는 것은 제목·설명·성분뿐이고 점수가 없어서, 그리려면 숫자를 지어내야 한다
 *   — 건강 결과에 지어낸 점수를 보여 줄 수는 없다. API 가 점수를 주면 그 자리에 넣는다.
 */
export function FillmeResult({ result, share, onRetryShare, onHome }: Props): JSX.Element {
  const lang = useLang();
  const rs = result.recommendedSupplement ?? {};
  const title = rs.title;
  const description = rs.description || result.content;
  const ingredients = (rs.ingredients ?? []).filter((x) => x?.name);
  /**
   * 저장하기를 누를 때마다 바뀌는 값 — QR 테두리의 깜빡임을 처음부터 다시 틀게 한다.
   * 저장은 QR 을 휴대폰으로 찍어서 하는 것이라(화살표가 QR 을 가리킨다), 버튼은 눈을
   * QR 로 보내고, QR 을 못 만들었으면 다시 만든다.
   */
  const [nudge, setNudge] = useState(0);
  const arrow = fillmeArtUrl('qr-arrow');
  const info = fillmeArtUrl('ico-info');

  const save = (): void => {
    if (share.status === 'error') onRetryShare();
    else setNudge((n) => n + 1);
  };

  return (
    <div className={styles.root}>
      <div className={styles.scroll}>
        {/* ── 분석 요약 카드 (7360:154990) ── */}
        <section className={styles.card}>
          <span className={styles.badge}>◇ {tx('Fillme_text051', lang)}</span>
          {title && <p className={styles.title}>“{title}”</p>}
          {(title || description) && <hr className={styles.rule} />}
          {description && <p className={styles.desc}>{description}</p>}
          {!title && !description && ingredients.length === 0 && (
            <p className={styles.desc}>분석 결과를 표시할 수 없어요.</p>
          )}
        </section>

        {/* ── 필요 영양 성분 (7334:84995) ── */}
        {ingredients.length > 0 && (
          <>
            {/* 시트 문장은 '필요 영양 성분 (5가지)'처럼 개수가 박혀 있다 — 실제
                개수로 바꿔 끼운다. 개수를 따로 감싸던 .sectionCount 는 낱말 순서가
                언어마다 달라 더는 쓰지 않는다(영어는 수가 뒤, 한국어는 괄호 안). */}
            <p className={`${ui.sectionLabel} ${styles.sectionLabel}`}>
              {tx('Fillme_text052', lang).replace(/\d+/, String(ingredients.length))}
            </p>
            <ul className={styles.grid}>
              {ingredients.map((ing, i) => (
                <li key={`${ing.name}-${i}`} className={styles.item}>
                  <span className={styles.disc}>
                    <IngredientIcon ingredient={ing} />
                  </span>
                  <span className={styles.name}>{ing.name}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ── 안내 + QR · 저장하기 · 처음으로 (7334:84996) ── */}
      <div className={styles.bottom}>
        <p className={styles.disclaimer}>
          {info && <img src={info} alt="" className={styles.infoIcon} draggable={false} />}
          {tx('Fillme_text053', lang)}
        </p>

        <div className={share.status === 'off' ? `${styles.actions} ${styles.actionsHomeOnly}` : styles.actions}>
          {share.status !== 'off' && (
            <>
              <div
                key={nudge}
                className={nudge > 0 ? `${styles.qr} ${styles.qrNudge}` : styles.qr}
                aria-live="polite"
                aria-label={
                  share.status === 'ready'
                    ? '휴대폰 카메라로 QR을 찍으면 결과를 저장할 수 있어요'
                    : share.status === 'loading'
                      ? 'QR을 만들고 있어요'
                      : 'QR을 만들지 못했어요'
                }
              >
                {share.status === 'ready' && (
                  <QRCodeSVG value={share.link.shareUrl} size={142} marginSize={0} fgColor="#000000" />
                )}
                {share.status === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
                {share.status === 'error' && <Icon name="alert" size={90} strokeWidth={2} className={styles.qrError} />}
              </div>
              {arrow && <img src={arrow} alt="" className={styles.arrow} draggable={false} />}
              <button type="button" className={styles.save} onClick={save}>
                {tx('Fillme_text054', lang)}
              </button>
            </>
          )}
          <button type="button" className={styles.home} onClick={onHome}>
            {tx('Fillme_text055', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
