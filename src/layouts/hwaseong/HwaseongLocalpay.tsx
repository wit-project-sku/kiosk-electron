import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import onnuriPaper from '@renderer/assets/photos/osan/localpay/onnuri-paper.png';
import onnuriDigital from '@renderer/assets/photos/osan/localpay/onnuri-digital.png';
import onnuriBi from '@renderer/assets/photos/osan/localpay/onnuri-bi.png';
import appQr from '@renderer/assets/photos/osan/localpay/app-qr.png';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongLocalpay.module.css';

// Tab + title labels localize via the sheet (short, fit the fixed layout). The
// dense body prose stays Korean: the Figma card boxes are fixed-height with
// overflow:hidden, so longer translations would clip — full i18n of the body
// needs a responsive layout pass (tracked separately).
const TAB_KEYS = ['MarketPaper_Onnuri', 'MarketPaper_Osaekjeon'] as const;

interface Props {
  controller: KioskController;
}

export function HwaseongLocalpay({ controller }: Props): JSX.Element {
  const banner = useRotatingBanner(hwaseongIconUrl('fg-banner'));
  const lang = useLang();
  const [tab, setTab] = useState(0);

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      <HwaseongHeader controller={controller} title="지역화폐" />

      {/* Tab bar — Figma top=664 left=427 */}
      <div className={styles.tabs}>
        {TAB_KEYS.map((key, i) => (
          <button
            key={key}
            type="button"
            className={`${styles.tab} ${tab === i ? (i === 0 ? styles.tabSelected0 : styles.tabSelected1) : ''}`}
            onClick={() => setTab(i)}
          >
            {t(key, lang)}
          </button>
        ))}
      </div>

      {/* ── Tab 0: 온누리상품권 — full card, left=163 top=917 h=2344 ── */}
      {tab === 0 && (
        <div className={styles.card0}>
          <p className={styles.bigTitle}>{t('MarketPaper_Onnuri', lang)}</p>

          {/* 온누리상품권이란? */}
          <div className={styles.block}>
            <p className={styles.h}>온누리상품권이란?</p>
            <p className={styles.body}>
              전국 16개 금융기관에서 5천원, 1만원, 3만원권 단위로 구매하여 사용하는 온누리상품권
            </p>
          </div>

          {/* 지류상품권 */}
          <div className={styles.blockWithGap}>
            <p className={styles.h}>지류상품권 권종</p>
            <div className={styles.imgPaper}>
              <img src={onnuriPaper} alt="" draggable={false} />
            </div>
          </div>

          {/* 디지털 온누리상품권 */}
          <div className={styles.blockWithGap}>
            <div className={styles.block}>
              <p className={styles.h}>디지털 온누리상품권이란?</p>
              <p className={styles.body}>
                <span className={styles.bodySemi}>디지털 온누리상품권 앱</span> 설치 후 기존 갖고 있는 카드를 등록하고 금액 충전 후,
              </p>
              <p className={styles.body}>
                실물카드 또는 QR코드 결제 방식으로 이용 가능한 온누리상품권
              </p>
            </div>
            <div className={styles.imgDigital}>
              <img src={onnuriDigital} alt="" draggable={false} />
            </div>
            <div className={styles.block}>
              <p className={styles.body}>
                상품권 금액의 <span className={styles.bodySemi}>10% 할인가</span>로 충전 가능!{' '}
                <span className={styles.bodySemi}>최대 보유한도금액</span>은{' '}
                <span className={styles.bodySemi}>200만원</span>입니다.
              </p>
              <p className={styles.note}>
                ※ 단, 예산소진 상황에 따라 특별판매 내용 및 기간이 변경될 수 있습니다.
              </p>
            </div>
          </div>

          {/* 사용처 */}
          <div className={styles.usageRow}>
            <div className={styles.usageText}>
              <p className={styles.h}>온누리상품권 사용처</p>
              <p className={styles.body}>
                <span className={styles.bodySemi}>온누리상품권 가맹점 스티커</span>가 있는 곳에서 사용이 가능합니다.
              </p>
            </div>
            <div className={styles.usageMedia}>
              <img className={styles.biLogo} src={onnuriBi} alt="" draggable={false} />
              <div className={styles.usageQr}>
                <img src={appQr} alt="" draggable={false} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 1: 행복화성지역화폐 — title-only white card + separate content ── */}
      {tab === 1 && (
        <>
          {/* White card: left=203 top=924 h=2314, title only */}
          <div className={styles.card1}>
            <p className={styles.card1Title}>{t('MarketPaper_Osaekjeon', lang)}</p>
          </div>

          {/* Content: left=243 top=1189 w=1740 gap=27 */}
          <div className={styles.content1}>
            {/* Block 1: 행복화성지역화폐란? h=298 */}
            <div className={styles.block1}>
              <p className={styles.block1Heading}>행복화성지역화폐란?</p>
              <div className={styles.block1Body}>
                <p><span className={styles.bodySemi}>화성시 내에서만 사용할 수 있는 카드형 지역화폐 입니다.</span></p>
                <p>전통시장 및 매출액 10억 이하의 소상공인 점포에서 사용 가능합니다.</p>
                <p>경기지역화폐APP을 통해 간편하게 충전하고 잔액을 관리할 수 있습니다.</p>
              </div>
            </div>

            {/* Image 162: h=903 w=1643 */}
            {hwaseongIconUrl('localpay-image162') && (
              <div className={styles.imgLocalpay}>
                <img src={hwaseongIconUrl('localpay-image162')} alt="행복화성지역화폐 카드" draggable={false} />
              </div>
            )}

            {/* 누구나 신청 */}
            <div className={styles.block1Inner}>
              <p className={styles.h}>누구나 신청 가능 하나요?</p>
              <p className={styles.body}>
                본인 명의의 은행계좌를 가지고 있는 만14세 이상이면 신청 가능합니다.
              </p>
              <p className={styles.body}>
                거주지역에 상관없이{' '}
                <span className={styles.bodySemi}>화성시 내 소비를 통해 인센티브 혜택을 받고 싶은 분들은</span>
                {' '}모<span className={styles.bodySemi}>바일 APP 또는 관내 농협</span>에서 신청해주세요.
              </p>
              <p className={styles.body}>
                신청방법은{' '}
                <span className={styles.bodySemi}>모바일앱(경기지역화폐APP)</span>또는{' '}
                <span className={styles.bodySemi}>관내 NH농협은행, 화성농협</span>에서 신청해주세요.
              </p>
            </div>

            {/* 지역화폐사용처 */}
            <div className={styles.block1Inner}>
              <p className={styles.h}>지역화폐사용처</p>
              <p className={styles.body}>
                <span className={styles.bodySemi}>연 매출 10억 이하인 소상공인 점포에서만 사용 가능</span>합니다.
              </p>
              <div className={styles.note}>
                <p>주유소 · 전통시장 · 골목상권 · 레저업소 (헬스클럽, 필라테스, 수영장, 골프연습장, 볼링장)</p>
                <p>병·의원 (치과, 한의원 등) · 편의점 · 학원 (기능학원, 보습학원 등) · 보건위생 (안경, 미용원 등) · 기타의료기관 (동물병원 등)</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Left nav */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={() => controller.navigate('home')} aria-label="뒤로" />
      </div>

      {/* Bottom banner */}
      <div className={styles.banner}>
        {banner && (
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>
    </div>
  );
}
