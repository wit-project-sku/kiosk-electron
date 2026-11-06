import { useEffect, useState } from 'react';
import { SETUP_SITES, siteNumberOf, type SetupSite } from '@shared/config/kioskSetup';
import { isOk } from '@shared/types/result';
import { siteVideoCount } from '@renderer/lib/videoMap';
import styles from './KioskSetup.module.css';

interface SetupContext {
  /** A fresh PC: the kiosk is not shown until a site is chosen. */
  required: boolean;
  /** This PC's own kiosk code. */
  current: string;
}

/**
 * 지점 설정 — the ordinary window that says which site this PC is (kioskSetup.ts).
 *
 * Opens by itself on a fresh machine, or from the installer's desktop shortcut.
 * A site is chosen from the list, by location rather than region because 인사동
 * and 제주 have several kiosks each; its number comes with it. Saving asks once in
 * a system dialog, then the app restarts as that site.
 */
export function KioskSetup(): JSX.Element {
  const [context, setContext] = useState<SetupContext | null>(null);
  const [selected, setSelected] = useState<SetupSite | null>(null);
  const [videoCounts, setVideoCounts] = useState<Record<string, number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void window.api.app.bootstrap().then((result) => {
      if (!alive || !isOk(result)) return;
      const config = result.value.kioskConfig;
      setContext({
        required: config.setup === 'required',
        current: config.identityKioskId ?? config.kioskId,
      });
    });
    void window.api.videos.list().then((result) => {
      if (!alive || !isOk(result)) return;
      const counts: Record<string, number> = {};
      for (const site of SETUP_SITES) {
        if (!site.testRig) counts[site.code] = siteVideoCount(result.value, site.code);
      }
      setVideoCounts(counts);
    });
    return () => {
      alive = false;
    };
  }, []);

  const save = (): void => {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    // Once confirmed a packaged build restarts, so this never settles.
    void window.api.kiosk.applySetup(selected.code).then(
      (result) => {
        setSaving(false);
        if (!isOk(result)) setError(result.error.message);
      },
      (e: unknown) => {
        setSaving(false);
        setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
      },
    );
  };

  const required = context?.required === true;
  const currentSite = required ? undefined : SETUP_SITES.find((s) => s.code === context?.current);

  return (
    <main className={styles.root}>
      <p className={styles.intro}>
        {required
          ? '이 PC가 설치된 지점을 고르세요. 고르기 전에는 키오스크 화면이 열리지 않습니다.'
          : currentSite
            ? `현재 이 PC는 ${currentSite.name}(${siteNumberOf(currentSite.code)}번)입니다.`
            : '이 PC의 지점을 고르세요.'}
      </p>

      <div className={styles.list} role="radiogroup" aria-label="지점">
        {SETUP_SITES.map((site) => {
          const current = site === currentSite;
          const videos = videoCounts?.[site.code];
          return (
            <label
              key={site.code}
              className={`${styles.row} ${current ? styles.rowCurrent : ''} ${
                site === selected ? styles.rowSelected : ''
              }`}
            >
              <input
                type="radio"
                name="site"
                checked={site === selected}
                disabled={current}
                onChange={() => setSelected(site)}
              />
              <span className={styles.number}>{siteNumberOf(site.code)}</span>
              <span className={styles.meta}>
                <span className={styles.name}>{site.name}</span>
                <span className={styles.detail}>{siteDetail(site)}</span>
              </span>
              <span className={styles.state}>
                {current ? (
                  '현재'
                ) : site.testRig || videos == null ? null : videos > 0 ? (
                  `영상 ${videos}개`
                ) : (
                  <span className={styles.warn}>영상 없음</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {selected && !selected.testRig && videoCounts?.[selected.code] === 0 && (
        <p className={styles.warn}>
          이 지점 영상이 이 PC에 없습니다. 두 번째 화면에 AI 모델 영상이 나오지 않습니다.
        </p>
      )}
      {error && <p className={styles.warn}>{error}</p>}

      <footer className={styles.actions}>
        <button type="button" onClick={() => window.close()} disabled={saving}>
          {required ? '나중에 하기' : '닫기'}
        </button>
        <button type="button" onClick={save} disabled={!selected || saving}>
          저장
        </button>
      </footer>
    </main>
  );
}

function siteDetail(site: SetupSite): string {
  if (site.testRig) return '번호는 200 그대로, 화면만 지점별로 미리보기';
  const parts = [site.hasCardTerminal ? '카드단말기' : null, site.hasDonation ? '기부' : null];
  return parts.filter(Boolean).join(' · ') || '카드단말기·기부 없음';
}
