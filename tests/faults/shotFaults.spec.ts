// 촬영 기록 장애 훈련 (npm run test:faults) — not part of CI.
//
// The real app takes shots while a fake server breaks the shot endpoints (and the
// AR composite) on purpose, one way per shot. Then, as on a kiosk:
//   1단계 장애 중      — what the first send leaves in the ledger
//   2단계 복구 후 재시작 — the server is back, the app restarts; its first re-send
//                       runs a minute after launch (then hourly)
//   3단계 하루 뒤       — rejected shots are tried once a day; the test moves their
//                       clock back a day with the app closed, then restarts it
// Each shot must end up `sent`, under its one eventId, with the right 성공/실패.
// The report lands in test-results/fault-drill/ (Markdown, Korean).
import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { startFakeApi, type FakeApi } from '../e2e/support/fake-api';
import {
  killHard,
  launchKiosk,
  removeDir,
  REPO_ROOT,
  type LaunchedKiosk,
} from '../e2e/support/launch';
import { startFaultServer, type FaultServer, type ScenarioAnswers } from './support/faultServer';
import { ageLedger, ledgerText, readLedger, type LedgerRow } from './support/ledgerFile';

type State = LedgerRow['state'];

interface Case {
  code: string;
  title: string;
  answers: ScenarioAnswers;
  /** Ledger state after phases 1, 2, 3. */
  expect: [State, State, State];
  /** What the server must finally store as isSuccess. */
  success: boolean;
  /** Runs with the app closed after phase 1. */
  afterPhase1?: (row: LedgerRow) => void;
  /** Endpoint the shot must finally reach. */
  lands: 'shots' | 'measurement';
}

const MIN = 60_000;
const HOUR = 60 * MIN;

const V1_CASES: Case[] = [
  {
    code: 'S1',
    title: '정상',
    answers: {},
    expect: ['sent', 'sent', 'sent'],
    success: true,
    lands: 'shots',
  },
  {
    code: 'S2',
    title: '인터넷 끊김(연결 끊어짐)',
    answers: { shots: { fault: { kind: 'drop' } } },
    expect: ['pending', 'sent', 'sent'],
    success: true,
    lands: 'shots',
  },
  {
    code: 'S3',
    title: '서버 재시작 중(503)',
    answers: { shots: { fault: { kind: 'status', status: 503 } } },
    expect: ['pending', 'sent', 'sent'],
    success: true,
    lands: 'shots',
  },
  {
    code: 'S4',
    title: '서버 무응답(20초, 앱 제한 15초)',
    answers: { shots: { fault: { kind: 'hang', ms: 20_000 } } },
    expect: ['pending', 'sent', 'sent'],
    success: true,
    lands: 'shots',
  },
  {
    code: 'S5',
    title: '요청 거부(400)',
    answers: {
      shots: { fault: { kind: 'status', status: 400, body: '{"message":"bad request"}' } },
    },
    expect: ['rejected', 'rejected', 'sent'],
    success: true,
    lands: 'shots',
  },
  {
    code: 'S6',
    title: '서버 내부 오류(500)',
    answers: { shots: { fault: { kind: 'status', status: 500 } } },
    expect: ['rejected', 'rejected', 'sent'],
    success: true,
    lands: 'shots',
  },
  {
    code: 'S7',
    title: '이미 저장된 기록(409)',
    answers: { shots: { fault: { kind: 'status', status: 409 } } },
    expect: ['sent', 'sent', 'sent'],
    success: true,
    lands: 'shots',
  },
  {
    code: 'S8',
    title: 'AI 합성 실패(합성 서버 500)',
    answers: { ar: { kind: 'status', status: 500, body: 'composite failed' } },
    expect: ['sent', 'sent', 'sent'],
    success: false,
    lands: 'shots',
  },
  {
    code: 'S9',
    title: '합성 중 앱 강제 종료',
    answers: { ar: { kind: 'hang', ms: 30 * MIN } },
    expect: ['open', 'sent', 'sent'],
    success: false,
    lands: 'shots',
  },
];

const JEJU_CASES: Case[] = [
  {
    code: 'J1',
    title: '제주 정상',
    answers: {},
    expect: ['sent', 'sent', 'sent'],
    success: true,
    lands: 'measurement',
  },
  {
    code: 'J2',
    title: '측정 업로드 서버 재시작 중(503)',
    answers: { measurement: { fault: { kind: 'status', status: 503 } } },
    expect: ['pending', 'sent', 'sent'],
    success: true,
    lands: 'measurement',
  },
  {
    code: 'J3',
    title: '측정 업로드 거부(400) — 촬영 기록만 먼저',
    answers: { measurement: { fault: { kind: 'status', status: 400 } } },
    expect: ['rejected', 'rejected', 'sent'],
    success: true,
    lands: 'measurement',
  },
  {
    code: 'J4',
    title: '측정 업로드 거부(400) + 촬영 기록도 503',
    answers: {
      measurement: { fault: { kind: 'status', status: 400 } },
      shots: { fault: { kind: 'status', status: 503 } },
    },
    expect: ['pending', 'sent', 'sent'],
    success: true,
    lands: 'measurement',
  },
  {
    code: 'J5',
    title: '전송 전에 원본 사진이 지워짐',
    answers: { measurement: { fault: { kind: 'status', status: 503 } } },
    expect: ['pending', 'sent', 'sent'],
    success: true,
    lands: 'shots',
    afterPhase1: (row) => {
      if (row.photoPath) unlinkSync(row.photoPath);
    },
  },
];

/** Any bytes do as the "composite": the app only stores them. */
const IMAGE = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9,
]);

interface KioskApi {
  photo: {
    startWorkflow(): Promise<unknown>;
    selectClothing(key: string): Promise<unknown>;
    selectStyle(key: string): Promise<unknown>;
    captureAndGenerate(req: object): Promise<unknown>;
  };
}

/** One capture through the real flow; the outfit code is the scenario. Does not wait for the composite. */
async function shoot(main: Page, code: string): Promise<void> {
  await main.evaluate(async (scenario) => {
    const api = (window as unknown as { api: KioskApi }).api;
    const unwrap = (r: unknown): { sessionId: string } =>
      (r && typeof r === 'object' && 'ok' in r
        ? (r as unknown as { value: unknown }).value
        : r) as {
        sessionId: string;
      };
    const { sessionId } = unwrap(await api.photo.startWorkflow());
    const clothingKey = `female|${scenario}`;
    await api.photo.selectClothing(clothingKey);
    await api.photo.selectStyle('solo');
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#c33';
      ctx.fillRect(0, 0, 64, 48);
    }
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    // The handler holds its answer ~60 s for the customer display; the shot is
    // recorded long before that.
    void api.photo.captureAndGenerate({ sessionId, dataUrl, clothingKey, styleKey: 'solo' });
  }, code);
}

function rowOf(userData: string, code: string): LedgerRow | undefined {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return readLedger(userData).find((r) => r.outfitCode === code);
    } catch (error) {
      // A lock held longer than the timeout: read again rather than fail the drill.
      if (attempt >= 3) throw error;
    }
  }
}

async function waitForStates(
  userData: string,
  cases: Case[],
  phase: 0 | 1 | 2,
  timeoutMs: number,
): Promise<void> {
  await expect
    .poll(
      () =>
        cases
          .filter((c) => {
            const row = rowOf(userData, c.code);
            // A send still in flight (S4 waits out the app's 15 s timeout) has not settled.
            return row?.state !== c.expect[phase] || (row.state !== 'open' && row.attempts === 0);
          })
          .map((c) => `${c.code}:${rowOf(userData, c.code)?.state ?? '없음'}`),
      { timeout: timeoutMs, intervals: [1_000] },
    )
    .toEqual([]);
}

const STATE_KO: Record<State, string> = {
  open: '합성 중(미완료)',
  pending: '미전송(매시간 재시도)',
  rejected: '거부(하루 1회 재시도)',
  sent: '전송 완료',
};

function describeRow(row: LedgerRow | undefined): string {
  if (!row) return '기록 없음';
  const parts = [STATE_KO[row.state], `시도 ${row.attempts}회`];
  if (row.v1Sent && row.state !== 'sent') parts.push('촬영 기록은 반영됨');
  if (row.lastError) parts.push(row.lastError.slice(0, 60));
  return parts.join(' · ');
}

interface Outcome {
  case: Case;
  phases: (LedgerRow | undefined)[];
  pass: boolean;
  problems: string[];
}

function judge(c: Case, phases: (LedgerRow | undefined)[], fault: FaultServer): Outcome {
  const problems: string[] = [];
  phases.forEach((row, i) => {
    if (row?.state !== c.expect[i])
      problems.push(`${i + 1}단계 ${row?.state ?? '없음'} (기대 ${c.expect[i]})`);
  });
  const hits = fault.log.filter((r) => r.scenario === c.code && r.endpoint !== 'ar');
  const ids = new Set(hits.map((r) => r.eventId));
  if (ids.size !== 1) problems.push(`eventId ${ids.size}개 — 재전송은 같은 eventId 여야 함`);
  const stored = hits.filter((r) => r.endpoint === c.lands && /HTTP (200|409)/.test(r.answer));
  if (stored.length === 0) problems.push(`${c.lands} 에 저장된 요청 없음`);
  if (stored.some((r) => r.isSuccess !== c.success))
    problems.push(`isSuccess 가 ${c.success} 가 아님`);
  return { case: c, phases, pass: problems.length === 0, problems };
}

function writeReport(
  site: string,
  outcomes: Outcome[],
  fault: FaultServer,
  userData: string,
): string {
  const lines: string[] = [];
  lines.push(`# 촬영 기록 장애 훈련 — ${site}`, '');
  lines.push(
    `실행: ${new Date().toLocaleString('ko-KR')} · 결과: ${outcomes.filter((o) => o.pass).length}/${outcomes.length} 통과`,
    '',
  );
  for (const o of outcomes) {
    lines.push(`## ${o.pass ? '✅' : '❌'} ${o.case.code} ${o.case.title}`);
    lines.push(`- 1단계 장애 중: ${describeRow(o.phases[0])}`);
    lines.push(`- 2단계 복구 후 재시작: ${describeRow(o.phases[1])}`);
    lines.push(`- 3단계 하루 뒤: ${describeRow(o.phases[2])}`);
    const hits = fault.log.filter((r) => r.scenario === o.case.code);
    lines.push(
      `- 서버가 받은 요청: ${hits
        .map(
          (r) =>
            `${r.endpoint}${r.isSuccess === null ? '' : r.isSuccess ? '(성공)' : '(실패)'}→${r.answer}`,
        )
        .join(', ')}`,
    );
    if (o.problems.length) lines.push(`- 문제: ${o.problems.join(' / ')}`);
    lines.push('');
  }
  lines.push('## 촬영 장부(shot-ledger.txt)', '', '```');
  lines.push(...ledgerText(userData));
  lines.push('```', '');
  const dir = join(REPO_ROOT, 'test-results', 'fault-drill');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${site}.md`);
  writeFileSync(path, lines.join('\n'));
  return path;
}

async function drill(site: 'W004' | 'W009', cases: Case[], crashAtEnd: boolean): Promise<void> {
  const scenarios = Object.fromEntries(cases.map((c) => [c.code, c.answers]));
  const fault = await startFaultServer(scenarios, IMAGE);
  const api: FakeApi = await startFakeApi({ mode: 'replay' });
  const userData = mkdtempSync(join(tmpdir(), `kiosk-faults-${site}-`));
  const launch = (): Promise<LaunchedKiosk> =>
    launchKiosk({
      site,
      apiBase: api.url,
      userData,
      keepUserData: true,
      env: {
        STATS_SHOTS_URL: `${fault.url}/api/stats/shots`,
        STATS_SHOTS_V2_URL: `${fault.url}/api/stats/shots/measurement`,
        STATS_PHOTO_SHOTS_SYNC_URL: `${fault.url}/api/stats/photo-shots/sync`,
        VITE_AR_PROCESS_IMAGE_API_URL: `${fault.url}/ar/process_image`,
        VITE_AR_PROCESS_API_URL: `${fault.url}/ar/process_and_combine`,
        PHOTO_SAVE_DIR: join(userData, 'photos'),
      },
    });
  const phases = new Map<string, (LedgerRow | undefined)[]>(cases.map((c) => [c.code, []]));
  const snapshot = (): void => {
    for (const c of cases) phases.get(c.code)?.push(rowOf(userData, c.code));
  };

  try {
    // 1단계 — every shot meets its fault.
    let kiosk = await launch();
    await expect(kiosk.main.locator('#root > *').first()).toBeVisible({ timeout: 30_000 });
    for (const c of cases) {
      await shoot(kiosk.main, c.code);
      await expect
        .poll(() => rowOf(userData, c.code)?.state ?? null, { timeout: 15_000 })
        .not.toBeNull();
    }
    await waitForStates(userData, cases, 0, 60_000);
    snapshot();
    if (crashAtEnd) killHard(kiosk.app);
    else await kiosk.app.close();
    for (const c of cases) {
      const row = rowOf(userData, c.code);
      if (c.afterPhase1 && row) c.afterPhase1(row);
    }

    // 2단계 — the server is back; the app restarts after a while off. An unfinished
    // composite counts as a failed shot once it is 10 minutes old.
    fault.heal();
    ageLedger(userData, 11 * MIN, 'open');
    kiosk = await launch();
    await waitForStates(userData, cases, 1, 3 * MIN);
    snapshot();
    await kiosk.app.close();

    // 3단계 — a day later.
    ageLedger(userData, 25 * HOUR, 'rejected');
    kiosk = await launch();
    await waitForStates(userData, cases, 2, 3 * MIN);
    snapshot();
    await kiosk.app.close();
  } finally {
    const outcomes = cases.map((c) => judge(c, phases.get(c.code) ?? [], fault));
    const path = writeReport(site, outcomes, fault, userData);
    test.info().annotations.push({ type: 'report', description: path });
    await fault.close();
    await api.close();
    removeDir(userData);
    for (const o of outcomes) expect.soft(o.problems, `${o.case.code} ${o.case.title}`).toEqual([]);
  }
}

test('촬영 기록 장애 — 인사동·오색·화성(v1)', async () => {
  await drill('W004', V1_CASES, true);
});

test('촬영 기록 장애 — 제주(측정 업로드)', async () => {
  await drill('W009', JEJU_CASES, false);
});
