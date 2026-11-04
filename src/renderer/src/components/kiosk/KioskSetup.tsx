import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SETUP_SITES,
  confirmCodeOf,
  confirmMatches,
  type SetupSite,
} from '@shared/config/kioskSetup';
import { kioskNumOf } from '@shared/config/testRig';
import { isOk } from '@shared/types/result';
import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH } from '@layouts/components/KioskScreenImage';
import { siteVideoCount } from '@renderer/lib/videoMap';
import { useKioskStore } from '@renderer/store/kioskStore';
import styles from './KioskSetup.module.css';

/** Longest kiosk number typed to confirm ("200"). */
const MAX_TYPED = 3;
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

/**
 * 지점 설정 — pick the site this PC is, with a finger or a mouse (kioskSetup.ts).
 *
 * Opens by itself on a fresh machine (`required`: the kiosk is not shown until a
 * site is chosen, and there is no way to close it), or from the installer's
 * desktop shortcut (`requested`: launched with --setup, or that shortcut opened
 * while the kiosk runs). Two steps: choose the site, then read what changes and
 * type its number to confirm. Saving restarts the app as that site.
 *
 * The confirm step is the safety, not a password: one tap must never move a
 * live kiosk, and the summary names what moves with it — every server record
 * (stats, photo archive, update commands, crash reports), the card terminal,
 * the power schedule, and whether the site's videos are even on this PC.
 *
 * Drawn on its own 2160×3840 artboard scaled like KioskArtboard (1 CSS px = 1
 * Figma px), above every layout — the same arrangement as KioskSwitcher.
 */
export function KioskSetup(): JSX.Element | null {
  const setup = useKioskStore((s) => s.config.setup);
  const identityId = useKioskStore((s) => s.config.identityKioskId ?? s.config.kioskId);
  const required = setup === 'required';

  const [open, setOpen] = useState(setup != null);
  const [site, setSite] = useState<SetupSite | null>(null);
  const [typed, setTyped] = useState('');
  const [videoCounts, setVideoCounts] = useState<Record<string, number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // The desktop shortcut opened while the kiosk is running.
  useEffect(
    () =>
      window.api.events.onKioskSetupOpen(() => {
        setOpen(true);
        setSite(null);
        setTyped('');
        setError(null);
      }),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const el = stageRef.current;
    if (!el) return;
    const update = (): void => {
      const scale = Math.min(
        window.innerWidth / ARTBOARD_WIDTH,
        window.innerHeight / ARTBOARD_HEIGHT,
      );
      el.style.setProperty('--setup-scale', String(scale));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  // Which sites' videos are on this PC — read fresh each time the screen opens.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void window.api.videos.list().then((result) => {
      if (!alive || !isOk(result)) return;
      const counts: Record<string, number> = {};
      for (const s of SETUP_SITES)
        if (!s.testRig) counts[s.code] = siteVideoCount(result.value, s.code);
      setVideoCounts(counts);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const press = useCallback((key: (typeof KEYPAD)[number]) => {
    if (key === 'clear') setTyped('');
    else if (key === 'back') setTyped((t) => t.slice(0, -1));
    else setTyped((t) => (t.length < MAX_TYPED ? t + key : t));
  }, []);

  const confirmed = site != null && confirmMatches(site.code, typed);

  const save = useCallback(() => {
    if (!site || !confirmed || saving) return;
    setSaving(true);
    setError(null);
    // A packaged build restarts, so this never settles; in dev the app reloads in place.
    void window.api.kiosk.applySetup(site.code).then(
      (result) => {
        setSaving(false);
        if (isOk(result)) setOpen(false);
        else setError(result.error.message);
      },
      (e: unknown) => {
        setSaving(false);
        setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
      },
    );
  }, [site, confirmed, saving]);

  // TeamViewer users type on a keyboard rather than tapping the keypad.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (site && /^\d$/.test(e.key)) press(e.key as (typeof KEYPAD)[number]);
      else if (site && e.key === 'Backspace') press('back');
      else if (site && e.key === 'Enter') save();
      else if (e.key === 'Escape') {
        if (site) setSite(null);
        else if (!required) setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, site, required, press, save]);

  if (!open) return null;

  const pick = (s: SetupSite): void => {
    setSite(s);
    setTyped('');
    setError(null);
  };

  return (
    <div className={styles.root} role="dialog" aria-label="키오스크 지점 설정">
      <div ref={stageRef} className={styles.stage}>
        <header className={styles.head}>
          <div>
            <h1 className={styles.title}>키오스크 지점 설정</h1>
            <p className={styles.sub}>
              {required
                ? '이 PC가 설치된 지점을 골라 주세요. 고르기 전에는 키오스크 화면이 열리지 않습니다.'
                : '이 PC의 지점을 바꿉니다. 저장하면 앱이 다시 시작됩니다.'}
            </p>
          </div>
          {!required && (
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label="닫기"
            >
              ✕
            </button>
          )}
        </header>

        {site == null ? (
          <ul className={styles.list}>
            {SETUP_SITES.map((s) => {
              const current = !required && s.code === identityId;
              const videos = videoCounts?.[s.code];
              return (
                <li key={s.code}>
                  <button
                    type="button"
                    className={`${styles.item} ${current ? styles.itemCurrent : ''}`}
                    onClick={() => pick(s)}
                    disabled={current}
                  >
                    <span className={styles.code}>{s.code}</span>
                    <span className={styles.meta}>
                      <span className={styles.name}>{s.name}</span>
                      <span className={styles.detail}>{siteDetail(s)}</span>
                    </span>
                    <span className={styles.state}>
                      {current ? (
                        '현재'
                      ) : s.testRig || videos == null ? null : videos > 0 ? (
                        `영상 ${videos}개`
                      ) : (
                        <span className={styles.warnText}>영상 없음</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <section className={styles.confirm}>
            <div className={styles.chosen}>
              <span className={styles.code}>{site.code}</span>
              <span className={styles.chosenName}>{site.name}</span>
            </div>

            <dl className={styles.summary}>
              {summaryRows(site, videoCounts?.[site.code]).map(([label, value, warn]) => (
                <div key={label} className={styles.row}>
                  <dt>{label}</dt>
                  <dd className={warn ? styles.warnText : undefined}>{value}</dd>
                </div>
              ))}
            </dl>

            <p className={styles.ask}>
              확인을 위해 키오스크 번호 <b>{confirmCodeOf(site.code)}</b> 을(를) 입력해 주세요.
            </p>
            <div
              className={`${styles.typed} ${confirmed ? styles.typedOk : ''}`}
              aria-live="polite"
            >
              {typed || ' '}
            </div>
            <div className={styles.keypad}>
              {KEYPAD.map((key) => (
                <button key={key} type="button" className={styles.key} onClick={() => press(key)}>
                  {key === 'clear' ? '전체 지움' : key === 'back' ? '⌫' : key}
                </button>
              ))}
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.back}
                onClick={() => setSite(null)}
                disabled={saving}
              >
                뒤로
              </button>
              <button
                type="button"
                className={styles.save}
                onClick={save}
                disabled={!confirmed || saving}
              >
                저장하고 다시 시작
              </button>
            </div>
          </section>
        )}

        {saving && (
          <div className={styles.saving} role="status">
            설정을 저장하고 다시 시작합니다…
          </div>
        )}
      </div>
    </div>
  );
}

function siteDetail(site: SetupSite): string {
  if (site.testRig) return '모든 지점 화면 미리보기';
  const parts = [site.hasCardTerminal ? '카드단말기' : null, site.hasDonation ? '기부' : null];
  return parts.filter(Boolean).join(' · ') || '카드단말기·기부 없음';
}

/** [label, value, warn] rows: what this PC becomes. */
function summaryRows(site: SetupSite, videos: number | undefined): [string, string, boolean][] {
  const rows: [string, string, boolean][] = [
    [
      '키오스크 번호',
      `${kioskNumOf(site.code)}번 — 촬영·메뉴 통계, 사진 보관, 업데이트, 오류 보고가 이 번호로 남습니다`,
      false,
    ],
    [
      '화면',
      site.testRig
        ? '지점 미리보기 — 왼쪽 위 핀으로 보이는 지점을 바꿉니다'
        : `${site.name} 키오스크 화면`,
      false,
    ],
    ['카드단말기', site.hasCardTerminal ? '사용' : '사용 안 함', false],
    ['기부', site.hasDonation ? '사용' : '사용 안 함', false],
    ['전원 일정', '이 지점 기준으로 다시 맞춥니다 (예약 재부팅·종료)', false],
  ];
  if (!site.testRig && videos != null) {
    rows.push(
      videos > 0
        ? ['이 지점 영상', `이 PC에 ${videos}개 있습니다`, false]
        : [
            '이 지점 영상',
            '이 PC에 없습니다 — 두 번째 화면에 AI 모델 영상이 나오지 않습니다',
            true,
          ],
    );
  }
  return rows;
}
