import { useState, type JSX } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatDate, type AnalysisResult, type Ingredient } from './api';
import { DISCLAIMER } from './copy';
import { ingredientIconSources } from './ingredients';
import type { ShareState } from './share';
import { Icon } from './Icon';
import ui from './fillmeUi.module.css';
import styles from './FillmeResult.module.css';

const PLATES = ['#FFE7D3', '#FFF3C4', '#E2F3D6', '#DCEEFB', '#FBE1EA'];

interface Props {
  result: AnalysisResult;
  /** 결과 QR — 결과 이미지를 서버에 올리는 중 / 주소 받음 / 실패. off 면 QR 칸 없이 본문을 끝까지 쓴다. */
  share: ShareState;
  onRetryShare: () => void;
  onHome: () => void;
  onRetake: () => void;
}

/** 성분 아이콘: 번들 복사본 우선 → 서버 주소 → 알약 아이콘. */
function IngredientIcon({ ingredient }: { ingredient: Ingredient }): JSX.Element {
  const { local, server } = ingredientIconSources(ingredient);
  const [src, setSrc] = useState<string | null>(local ?? server);
  if (!src) return <Icon name="pill" size={170} strokeWidth={1.6} className={styles.pill} />;
  return (
    <img
      src={src}
      alt=""
      className={styles.suppIcon}
      onError={() => setSrc(src === local && server ? server : null)}
    />
  );
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 버튼 바로 위에 고정 — 결과를 스크롤하지 않아도 QR 이 보이게 한다. */
function ShareStrip({ share, onRetry }: { share: Exclude<ShareState, { status: 'off' }>; onRetry: () => void }): JSX.Element {
  return (
    <section className={styles.qr} aria-live="polite">
      <div className={`${styles.qrBox} ${share.status === 'error' ? styles.qrBoxError : ''}`}>
        {share.status === 'ready' && <QRCodeSVG value={share.link.shareUrl} size={250} marginSize={1} fgColor="#232323" />}
        {share.status === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
        {share.status === 'error' && <Icon name="alert" size={110} strokeWidth={2} />}
      </div>
      <div className={styles.qrText}>
        {share.status === 'error' ? (
          <>
            <p className={styles.qrTitle}>QR을 만들지 못했어요</p>
            <p className={styles.qrDesc}>인터넷 연결을 확인한 뒤 다시 시도해 주세요</p>
          </>
        ) : (
          <>
            <p className={styles.qrTitle}>
              <Icon name="qr" size={64} strokeWidth={2.2} />
              휴대폰으로 결과 받기
            </p>
            <p className={styles.qrDesc}>
              {share.status === 'ready' ? '휴대폰 카메라로 QR을 찍으면 결과 이미지를 저장할 수 있어요' : 'QR을 만들고 있어요'}
            </p>
            {share.status === 'ready' && (
              <p className={styles.qrExpiry}>
                <Icon name="clock" size={44} strokeWidth={2.2} />
                {hhmm(share.link.expiresAt)}까지 열 수 있고, 그 뒤 서버에서 자동으로 지워져요
              </p>
            )}
          </>
        )}
      </div>
      {share.status === 'error' && (
        <button type="button" className={styles.qrRetry} onClick={onRetry}>
          <Icon name="retry" size={52} strokeWidth={2.2} />
          다시 시도
        </button>
      )}
    </section>
  );
}

export function FillmeResult({ result, share, onRetryShare, onHome, onRetake }: Props): JSX.Element {
  const rs = result.recommendedSupplement ?? {};
  const title = rs.title;
  const description = rs.description || result.content;
  const ingredients = (rs.ingredients ?? []).filter((x) => x?.name);

  return (
    <div className={styles.root}>
      <div className={`${styles.scroll} ${share.status !== 'off' ? styles.scrollShort : ''}`}>
        {(title || description) && (
          <section className={`${ui.card} ${styles.summary}`}>
            <div className={styles.summaryHead}>
              <span className={styles.badge}>
                <Icon name="sparkle" size={52} strokeWidth={2.2} />
                건강분석
              </span>
              <span className={styles.date}>{formatDate(result.checkDate)}</span>
            </div>
            {title && <p className={styles.title}>“{title}”</p>}
            {description && <p className={styles.desc}>{description}</p>}
          </section>
        )}

        {ingredients.length > 0 && (
          <>
            <p className={`${ui.sectionLabel} ${styles.suppLabel}`}>
              추천 영양제<span className={ui.sectionHint}>{ingredients.length}가지</span>
            </p>
            <ul className={styles.supps}>
              {ingredients.map((ing, i) => (
                <li key={`${ing.name}-${i}`} className={styles.supp}>
                  <span className={styles.plate} style={{ background: PLATES[i % PLATES.length] }}>
                    <IngredientIcon ingredient={ing} />
                  </span>
                  <span className={styles.suppName}>{ing.name}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {!title && !description && ingredients.length === 0 && (
          <p className={styles.empty}>분석 결과를 표시할 수 없어요.</p>
        )}

        <p className={styles.disclaimer}>
          <Icon name="info" size={56} strokeWidth={2.2} />
          {DISCLAIMER}
        </p>
      </div>

      {share.status !== 'off' && <ShareStrip share={share} onRetry={onRetryShare} />}

      <div className={styles.actions}>
        <button type="button" className={`${ui.ghost} ${styles.action}`} onClick={onHome}>
          처음으로
        </button>
        <button type="button" className={`${ui.cta} ${styles.action}`} onClick={onRetake}>
          <Icon name="camera" size={70} strokeWidth={2.2} />
          다시 촬영하기
        </button>
      </div>
    </div>
  );
}
