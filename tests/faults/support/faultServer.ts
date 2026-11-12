// A stand-in for the shot endpoints and the AR (Digicon) API that fails on purpose.
//
// Each shot in the drill carries its scenario as the outfit code (S1…S9, J1…J5), so
// the server knows how to answer a request without the test arming it first. Until
// `heal()` a scenario answers with its fault; after it, with its recovery answer.
// Every request is kept in `log` for the report.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** How one request is answered. */
export type Answer =
  | { kind: 'status'; status: number; body?: string }
  /** Close the socket without answering — what a dropped line looks like to the app. */
  | { kind: 'drop' }
  /** Answer only after `ms` — longer than the app's timeout means no answer at all. */
  | { kind: 'hang'; ms: number };

export interface ScenarioAnswers {
  /** `/api/stats/shots` (the plain shot record). */
  shots?: { fault: Answer; healed?: Answer };
  /** `/api/stats/shots/measurement` (제주: sizes + original). */
  measurement?: { fault: Answer; healed?: Answer };
  /** The AR composite. Default: a finished image. */
  ar?: Answer;
}

export interface LoggedRequest {
  at: number;
  endpoint: 'shots' | 'measurement' | 'photo-shots-sync' | 'ar';
  scenario: string;
  eventId: string | null;
  isSuccess: boolean | null;
  healed: boolean;
  answer: string;
}

export interface FaultServer {
  url: string;
  log: LoggedRequest[];
  /** From now on every scenario gives its recovery answer. */
  heal(): void;
  close(): Promise<void>;
}

const OK: Answer = { kind: 'status', status: 200, body: '{"success":true,"code":200,"data":null}' };

const describe = (a: Answer): string =>
  a.kind === 'status'
    ? `HTTP ${a.status}`
    : a.kind === 'drop'
      ? '연결 끊음'
      : `${a.ms / 1000}초 무응답`;

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => resolve(Buffer.concat(chunks)));
  });
}

/** A JSON (or multipart, read as latin1) body's field, without parsing multipart. */
function field(raw: string, name: string): string | null {
  const m = new RegExp(`"${name}"\\s*:\\s*("([^"]*)"|true|false|null)`).exec(raw);
  if (!m) return null;
  return m[2] ?? m[1] ?? null;
}

/** The AR request's `outfit` form field. */
function outfitField(raw: string): string | null {
  const m = /name="outfit"\r\n\r\n([^\r\n]*)/.exec(raw);
  return m?.[1] ?? null;
}

export async function startFaultServer(
  scenarios: Record<string, ScenarioAnswers>,
  /** Bytes returned as the composite. */
  image: Buffer,
): Promise<FaultServer> {
  const log: LoggedRequest[] = [];
  let healed = false;

  const reply = (res: ServerResponse, answer: Answer, ok: () => void): void => {
    if (answer.kind === 'drop') {
      res.socket?.destroy();
      return;
    }
    if (answer.kind === 'hang') {
      const timer = setTimeout(ok, answer.ms);
      res.on('close', () => clearTimeout(timer));
      return;
    }
    res.writeHead(answer.status, { 'content-type': 'application/json' });
    res.end(answer.body ?? '');
  };

  const server = createServer(async (req, res) => {
    const raw = (await readBody(req)).toString('latin1');
    const path = (req.url ?? '/').split('?')[0] ?? '/';

    if (path.startsWith('/ar/')) {
      const scenario = outfitField(raw) ?? '?';
      const answer = scenarios[scenario]?.ar;
      log.push({
        at: Date.now(),
        endpoint: 'ar',
        scenario,
        eventId: null,
        isSuccess: null,
        healed,
        answer: answer ? describe(answer) : '합성 이미지',
      });
      if (!answer) {
        res.writeHead(200, { 'content-type': 'image/jpeg' });
        res.end(image);
        return;
      }
      reply(res, answer, () => {
        res.writeHead(200, { 'content-type': 'image/jpeg' });
        res.end(image);
      });
      return;
    }

    const endpoint =
      path === '/api/stats/shots'
        ? 'shots'
        : path === '/api/stats/shots/measurement'
          ? 'measurement'
          : path === '/api/stats/photo-shots/sync'
            ? 'photo-shots-sync'
            : null;
    if (!endpoint) {
      res.writeHead(404).end();
      return;
    }
    if (endpoint === 'photo-shots-sync') {
      // The old failed-request queue — empty while the ledger works.
      log.push({
        at: Date.now(),
        endpoint,
        scenario: '-',
        eventId: null,
        isSuccess: null,
        healed,
        answer: 'HTTP 200',
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"success":true,"data":{"accepted":[],"duplicated":[],"failed":[]}}');
      return;
    }

    const scenario = field(raw, 'outfitCode') ?? '?';
    const plan = scenarios[scenario]?.[endpoint];
    const answer = plan ? (healed ? (plan.healed ?? OK) : plan.fault) : OK;
    const success = field(raw, 'isSuccess');
    log.push({
      at: Date.now(),
      endpoint,
      scenario,
      eventId: field(raw, 'eventId'),
      isSuccess: success === null ? null : success === 'true',
      healed,
      answer: describe(answer),
    });
    reply(res, answer, () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(OK.kind === 'status' ? OK.body : '');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    log,
    heal: () => {
      healed = true;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
