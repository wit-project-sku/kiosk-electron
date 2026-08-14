/**
 * 제주공항 (W006) AR 한복체험 — 정보 입력. Figma 6258:49690.
 *
 * Sits between the outfit page's capture buttons and the camera: the visitor
 * gives 국적 and 키, ticks the consent line, then 등록하기 starts the countdown.
 * `onSubmit` carries the capture mode chosen upstream, so the whole step is a
 * gate rather than a fork.
 *
 * ★ 국적 and 키 are COLLECTED BUT NOT SENT. Nothing downstream carries them:
 * `ARImageTransport` posts image / outfit / together_with / gender /
 * request_ids and the Digicon endpoints take no nationality or height field —
 * the same situation as 배경 테마 on the outfit page. They stay local so nothing
 * is silently dropped on the wire; lift them into `photoStore` and the IPC
 * payload the moment there is somewhere for them to land.
 *
 * The consent line is the reason this screen exists at all, so 등록하기 stays
 * inert until it is ticked, and [개인보호정책] opens the same 개인정보 처리방침
 * modal the outfit page uses.
 */
import { useState } from 'react';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { pick, useLang } from '@renderer/lib/i18n';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import korFlag from '@renderer/assets/photos/insadong/exchange/kor.png';
import jpnFlag from '@renderer/assets/photos/insadong/exchange/jpn.svg';
import usaFlag from '@renderer/assets/photos/insadong/exchange/usa.svg';
import chyFlag from '@renderer/assets/photos/insadong/exchange/chy.svg';
import eurFlag from '@renderer/assets/photos/insadong/exchange/eur.svg';
import gbpFlag from '@renderer/assets/photos/insadong/exchange/gbp.svg';
import thbFlag from '@renderer/assets/photos/insadong/exchange/thb.svg';
import hkgFlag from '@renderer/assets/photos/insadong/exchange/hkg.svg';
import styles from './JejuPhotoRegister.module.css';

interface Props {
  /** 등록하기 — proceed to the countdown/capture. */
  onSubmit: () => void;
  /** Opens the shared 개인정보 처리방침 modal, owned by the outfit page. */
  onOpenPolicy: () => void;
}

/** Reuses the exchange screen's flags — the only flag set in the repo. */
const NATIONS: ReadonlyArray<{ code: string; flag: string }> = [
  { code: 'KR', flag: korFlag },
  { code: 'JP', flag: jpnFlag },
  { code: 'US', flag: usaFlag },
  { code: 'CN', flag: chyFlag },
  { code: 'EU', flag: eurFlag },
  { code: 'GB', flag: gbpFlag },
  { code: 'TH', flag: thbFlag },
  { code: 'HK', flag: hkgFlag },
];

const TITLE = {
  ko: '더 나은 체험을 위해 정보를 입력해주세요',
  en: 'Tell us a little about you for a better result',
  ja: 'より良い体験のため情報を入力してください',
  zh: '为了更好的体验，请输入您的信息',
  vi: 'Nhập thông tin để có trải nghiệm tốt hơn',
  th: 'กรอกข้อมูลเพื่อประสบการณ์ที่ดีขึ้น',
  ru: 'Заполните данные для лучшего результата',
  id: 'Isi data untuk pengalaman yang lebih baik',
};

const NATION = {
  ko: '국적:',
  en: 'Country:',
  ja: '国籍:',
  zh: '国籍:',
  vi: 'Quốc tịch:',
  th: 'สัญชาติ:',
  ru: 'Страна:',
  id: 'Negara:',
};

const HEIGHT = {
  ko: '키:',
  en: 'Height:',
  ja: '身長:',
  zh: '身高:',
  vi: 'Chiều cao:',
  th: 'ส่วนสูง:',
  ru: 'Рост:',
  id: 'Tinggi:',
};

const CONSENT = {
  ko: '서비스 제공을 위해 이용자의 정보 수집을 동의합니다.',
  en: 'I agree to the collection of my information to provide this service.',
  ja: 'サービス提供のため利用者情報の収集に同意します。',
  zh: '同意为提供服务收集用户信息。',
  vi: 'Tôi đồng ý cho thu thập thông tin để cung cấp dịch vụ.',
  th: 'ยินยอมให้เก็บข้อมูลเพื่อให้บริการ',
  ru: 'Согласен на сбор данных для оказания услуги.',
  id: 'Saya setuju data saya dikumpulkan untuk layanan ini.',
};

const POLICY = {
  ko: '[개인보호정책]',
  en: '[Privacy Policy]',
  ja: '[個人情報保護方針]',
  zh: '[隐私政策]',
  vi: '[Chính sách bảo mật]',
  th: '[นโยบายความเป็นส่วนตัว]',
  ru: '[Политика]',
  id: '[Kebijakan Privasi]',
};

const SUBMIT = {
  ko: '등록하기',
  en: 'Register',
  ja: '登録する',
  zh: '注册',
  vi: 'Đăng ký',
  th: 'ลงทะเบียน',
  ru: 'Зарегистрировать',
  id: 'Daftar',
};

const HEIGHT_PLACEHOLDER = {
  ko: 'cm',
  en: 'cm',
  ja: 'cm',
  zh: 'cm',
  vi: 'cm',
  th: 'cm',
  ru: 'см',
  id: 'cm',
};

/**
 * Keyboard tray top — Figma 6258:49693 places the 키보드 node at y1838, right
 * under the 등록하기 button (which ends at 1760).
 */
const KEYBOARD_TOP = 1838;

export function JejuPhotoRegister({ onSubmit, onOpenPolicy }: Props): JSX.Element {
  const lang = useLang();
  const [nation, setNation] = useState(NATIONS[0] as { code: string; flag: string });
  const [height, setHeight] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [picker, setPicker] = useState(false);
  const [keypad, setKeypad] = useState(false);

  /**
   * 키 takes DIGITS ONLY, capped at three (a height in cm).
   *
   * The frame drops in the shared 키보드 component, so the visitor gets the full
   * Korean/English layout — its number row is what this field is for, and its
   * letters are inert here rather than writing 'ㅂ' into a height. Enter closes
   * the tray, the same as the search bars.
   */
  const applyKey = (action: KeyAction): void => {
    if (action.type === 'backspace') setHeight((h) => h.slice(0, -1));
    else if (action.type === 'enter') setKeypad(false);
    else if (action.type === 'literal' && /^\d$/.test(action.value)) {
      setHeight((h) => (h + action.value).slice(0, 3));
    }
  };

  const submit = (): void => {
    if (!agreed) return;
    onSubmit();
  };

  return (
    <>
      <div className={`${styles.card} ${picker ? styles.cardPicking : ''}`}>
        <p className={styles.cardTitle}>{pick(TITLE, lang)}</p>

        <p className={`${styles.fieldLabel} ${styles.labelNation}`}>{pick(NATION, lang)}</p>
        <p className={`${styles.fieldLabel} ${styles.labelHeight}`}>{pick(HEIGHT, lang)}</p>

        <button
          type="button"
          className={`${styles.field} ${styles.fieldNation}`}
          onClick={() => {
            setKeypad(false);
            setPicker((v) => !v);
          }}
        >
          <img src={nation.flag} alt="" className={styles.flag} draggable={false} />
          <span className={styles.code}>{nation.code}</span>
        </button>
        <p className={styles.caret}>▼</p>

        <button
          type="button"
          className={`${styles.field} ${styles.fieldHeight}`}
          onClick={() => {
            setPicker(false);
            setKeypad(true);
          }}
        >
          <span className={height ? undefined : styles.placeholder}>
            {height || pick(HEIGHT_PLACEHOLDER, lang)}
          </span>
        </button>

        {picker && (
          <div className={styles.dropdown}>
            {NATIONS.map((n) => (
              <button
                key={n.code}
                type="button"
                className={styles.option}
                onClick={() => {
                  setNation(n);
                  setPicker(false);
                }}
              >
                <img src={n.flag} alt="" className={styles.flag} draggable={false} />
                <span className={styles.code}>{n.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={`${styles.consent} ${agreed ? styles.consentOn : ''}`}>
        {/* The Figma's `Vector` on this row is the shared 체크 icon — the same
            orange disc with the knocked-out tick that JejuLanguage draws, and
            it already ships as a pair (check-on #FF7F0F / check-off #FFE0C4).
            Drawn from the asset rather than a CSS disc with a "✓" glyph, whose
            tick came from the font and never matched the artwork. */}
        <button
          type="button"
          className={styles.check}
          aria-pressed={agreed}
          aria-label={pick(CONSENT, lang)}
          onClick={() => setAgreed((v) => !v)}
        >
          {jejuIconUrl(agreed ? 'check-on' : 'check-off') && (
            <img
              src={jejuIconUrl(agreed ? 'check-on' : 'check-off')}
              alt=""
              className={styles.checkIcon}
              draggable={false}
            />
          )}
        </button>
        <button type="button" className={styles.policyLink} onClick={onOpenPolicy}>
          {pick(POLICY, lang)}
        </button>
        <p className={styles.consentText}>{pick(CONSENT, lang)}</p>
      </div>

      <button
        type="button"
        className={`${styles.submit} ${agreed ? '' : styles.submitDisabled}`}
        disabled={!agreed}
        onClick={submit}
      >
        {pick(SUBMIT, lang)}
      </button>

      <FloatingKeyboard
        open={keypad}
        onKey={applyKey}
        onClose={() => setKeypad(false)}
        lang={lang}
        lightBackspace
        top={KEYBOARD_TOP}
      />
    </>
  );
}

export type { Props as JejuPhotoRegisterProps };
