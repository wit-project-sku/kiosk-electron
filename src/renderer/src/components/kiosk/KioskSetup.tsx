import { useEffect, useState } from 'react';
import {
  SETUP_SITES,
  setupActions,
  siteNumberOf,
  type KioskSetupState,
  type SetupSite,
} from '@shared/config/kioskSetup';
import { isOk } from '@shared/types/result';
import { siteVideoCount } from '@renderer/lib/videoMap';
import styles from './KioskSetup.module.css';

interface SetupContext {
  /** How this window was opened — `null` = over a running kiosk (kioskSetup.ts). */
  state: KioskSetupState | null;
  /** This PC's own kiosk code. */
  current: string;
}

/**
 * 지점 설정 — the ordinary window that says which site this PC is (kioskSetup.ts).
 *
 * Opens by itself on a fresh machine, or from the installer's one desktop shortcut.
 * A site is chosen from the table, by location rather than region because 인사동
 * and 제주 have several kiosks each; its number comes with it. Saving asks once in
 * a system dialog, then the app restarts as that site. Opened with the app off and
 * no new site chosen, the main button is 앱 실행: the kiosk starts as it is.
 * This PC's own site starts checked and can be picked again, so a tester who
 * clicked another site can go back to 앱 실행 without reopening the window.
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
        state: config.setup ?? null,
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

  const required = context?.state === 'required';
  const currentSite = required ? undefined : SETUP_SITES.find((s) => s.code === context?.current);
  // What the table shows as chosen: the pick, or else this PC's own site.
  const chosen = selected ?? currentSite ?? null;
  // Choosing this PC's own site again is not a change.
  const newSite = chosen !== null && chosen !== currentSite ? chosen : null;
  const actions = setupActions(context?.state ?? null, newSite !== null);

  const save = (): void => {
    if (!newSite || saving) return;
    setSaving(true);
    setError(null);
    // Once confirmed a packaged build restarts, so this never settles.
    void window.api.kiosk.applySetup(newSite.code).then(
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

  const launch = (): void => {
    if (saving) return;
    setSaving(true);
    setError(null);
    // A packaged build restarts as the kiosk, so this never settles.
    void window.api.kiosk.launchFromSetup().then(
      (result) => {
        setSaving(false);
        if (!isOk(result)) setError(result.error.message);
      },
      (e: unknown) => {
        setSaving(false);
        setError(e instanceof Error ? e.message : '앱을 실행하지 못했습니다.');
      },
    );
  };
  return (
    <main className={styles.root}>
      <p className={styles.intro}>
        {required
          ? '이 PC가 설치된 지점을 고르세요. 고르기 전에는 키오스크 화면이 열리지 않습니다.'
          : currentSite
            ? `현재 이 PC는 ${currentSite.name}(${siteNumberOf(currentSite.code)}번)입니다.`
            : '이 PC의 지점을 고르세요.'}
      </p>

      <div className={styles.list}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.pick} aria-label="선택" />
              <th className={styles.number}>ID</th>
              <th>키오스크 이름</th>
              <th className={styles.state}>상태</th>
            </tr>
          </thead>
          <tbody>
            {SETUP_SITES.map((site) => {
              const current = site === currentSite;
              return (
                <tr
                  key={site.code}
                  className={site === chosen ? styles.rowSelected : ''}
                  onClick={() => setSelected(site)}
                >
                  <td className={styles.pick}>
                    <input
                      type="radio"
                      name="site"
                      aria-label={site.name}
                      checked={site === chosen}
                      onChange={() => setSelected(site)}
                    />
                  </td>
                  <td className={styles.number}>{siteNumberOf(site.code)}</td>
                  <td>{site.name}</td>
                  <td className={styles.state}>
                    {current ? (
                      '현재'
                    ) : !site.testRig && videoCounts?.[site.code] === 0 ? (
                      <span className={styles.warn}>영상 없음</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className={styles.warn}>{error}</p>}

      <footer className={styles.actions}>
        <button type="button" onClick={() => window.close()} disabled={saving}>
          {actions.closeLabel}
        </button>
        <button
          type="button"
          onClick={actions.primary === 'launch' ? launch : save}
          disabled={!context || !actions.primaryEnabled || saving}
        >
          {actions.primaryLabel}
        </button>
      </footer>
    </main>
  );
}
