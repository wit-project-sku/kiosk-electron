// Fake WIT backend for the end-to-end tests.
//
// replay (default): answers from tests/e2e/fixtures/api/*.json. Any request with no
//   recorded answer is logged in `unmatched` and gets 404 — a test that sees unmatched
//   requests fails, which is how a changed API contract shows up.
// record: forwards GETs (and read-only course POSTs) to a real server — stage — and
//   saves trimmed answers as fixtures. Writes such as stats are NEVER forwarded; they
//   are answered locally so a recording run cannot add rows to stage.
//
// Image URLs inside recorded JSON are rewritten to {{BASE}}/img/<hash>.<ext>, and this
// server answers /img/* with a small generated PNG, so a test never needs the internet.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

import { fileURLToPath } from 'node:url';

export const FIXTURE_DIR = fileURLToPath(new URL('../fixtures/api/', import.meta.url));

interface Fixture {
  key: string;
  status: number;
  body: unknown;
}

export interface RecordedRequest {
  method: string;
  url: string;
  key: string;
  body: unknown;
}

export interface FakeApi {
  url: string;
  requests: RecordedRequest[];
  unmatched: string[];
  close: () => Promise<void>;
}

type Row = Record<string, unknown>;

const OK = { success: true, code: 200, message: 'OK', data: null };
/** POST paths that only read (safe to forward to stage while recording). */
const READ_ONLY_POST = /\/courses\//;
/**
 * Writes the app is known to make. Answered with OK and no fixture; any OTHER write is
 * reported as unmatched, so a new write endpoint cannot slip past the contract check.
 */
const KNOWN_WRITES = [
  /^\/api\/stats\/(menu-touch|shots|menu-touches\/sync|photo-shots\/sync)$/,
  /^\/api\/kiosks\/\d+\/crash-reports$/,
  /^\/api\/images$/,
  /^\/api\/fillme\/shares$/,
];
const isKnownWrite = (url: string): boolean =>
  KNOWN_WRITES.some((re) => re.test(url.split('?')[0] ?? ''));
/** Phone fields are masked in fixtures — public business numbers, but the repo is public and some are mobiles. */
const PHONE_KEYS = /^(tel|phone|telephone|phoneNumber)$/i;
export function maskPhones(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskPhones);
  if (value && typeof value === 'object') {
    const out: Row = {};
    for (const [k, v] of Object.entries(value as Row)) {
      out[k] = PHONE_KEYS.test(k) && typeof v === 'string' && v ? '000-0000-0000' : maskPhones(v);
    }
    return out;
  }
  return value;
}
/** Upper bound on list sizes kept in a fixture — keeps the repo small, keeps variety. */
const MAX_ITEMS = 20;

/** Stable fixture key: method + path + query sorted by name. */
export function requestKey(method: string, url: string): string {
  const u = new URL(url, 'http://x');
  const q = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const qs = q.map(([k, v]) => `${k}=${v}`).join('&');
  return `${method} ${u.pathname}${qs ? `?${qs}` : ''}`;
}

function fileFor(key: string): string {
  return `${createHash('sha1').update(key).digest('hex').slice(0, 16)}.json`;
}

function loadFixtures(): Map<string, Fixture> {
  const map = new Map<string, Fixture>();
  if (!existsSync(FIXTURE_DIR)) return map;
  for (const f of readdirSync(FIXTURE_DIR)) {
    if (!f.endsWith('.json')) continue;
    const fx = JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8')) as Fixture;
    map.set(fx.key, fx);
  }
  return map;
}

/** Keep at most MAX_ITEMS, spread across categories when the rows have one. */
function trimList(list: unknown[]): unknown[] {
  if (!Array.isArray(list) || list.length <= MAX_ITEMS) return list;
  const groupOf = (r: unknown): unknown =>
    r && typeof r === 'object'
      ? ((r as Row)['baseCategoryKr'] ?? (r as Row)['category'] ?? '')
      : '';
  const groups = new Map<unknown, unknown[]>();
  for (const r of list) {
    const g = groupOf(r);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)?.push(r);
  }
  const out: unknown[] = [];
  while (out.length < MAX_ITEMS) {
    let added = false;
    for (const rows of groups.values()) {
      const r = rows.shift();
      if (r !== undefined && out.length < MAX_ITEMS) {
        out.push(r);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

function trimBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const b = body as Row;
  const d = b['data'];
  if (Array.isArray(d)) return { ...b, data: trimList(d) };
  if (d && typeof d === 'object' && Array.isArray((d as Row)['content'])) {
    return { ...b, data: { ...(d as Row), content: trimList((d as Row)['content'] as unknown[]) } };
  }
  return body;
}

/** Point every http(s) image URL at this server — no internet, no stage bucket in tests. */
function rewriteImages(text: string): string {
  return text.replace(
    /https?:\/\/[^"\\\s]+?\.(png|jpe?g|webp|gif)(\?[^"\\\s]*)?/gi,
    (url: string, ext: string) => {
      const h = createHash('sha1').update(url).digest('hex').slice(0, 12);
      return `{{BASE}}/img/${h}.${ext.toLowerCase()}`;
    },
  );
}

// 8x8 grey PNG, built once.
function crc32(buf: Buffer): number {
  let c: number;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ (buf[n] ?? 0)) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const PNG = (() => {
  const w = 8;
  const h = 8;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h, 0xb0);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
})();

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => parts.push(c));
    req.on('end', () => resolve(Buffer.concat(parts)));
  });
}

/**
 * Start the fake backend. Returns { url, requests, unmatched, close }.
 * `requests` lists every call ({ method, url, key, body }) for assertions.
 */
export async function startFakeApi({
  mode = 'replay',
  upstream,
  port = 0,
}: { mode?: 'replay' | 'record'; upstream?: string; port?: number } = {}): Promise<FakeApi> {
  const fixtures = loadFixtures();
  const requests: RecordedRequest[] = [];
  const unmatched: string[] = [];
  let base = '';

  const server = createServer(async (req, res) => {
    const key = requestKey(req.method ?? 'GET', req.url ?? '/');
    const raw = await readBody(req);
    let body: unknown = null;
    try {
      body = raw.length ? JSON.parse(raw.toString('utf8')) : null;
    } catch {
      body = raw.toString('utf8');
    }
    requests.push({ method: req.method ?? 'GET', url: req.url ?? '/', key, body });

    const send = (status: number, payload: string | Buffer, type = 'application/json'): void => {
      res.writeHead(status, { 'content-type': type, 'access-control-allow-origin': '*' });
      res.end(payload);
    };

    if (req.url?.startsWith('/img/')) return send(200, PNG, 'image/png');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,PUT,DELETE',
      });
      return res.end();
    }

    if (mode === 'record') {
      const forward = req.method === 'GET' || READ_ONLY_POST.test(req.url ?? '');
      if (!forward) {
        if (!isKnownWrite(req.url ?? '')) unmatched.push(key);
        return send(200, JSON.stringify(OK));
      }
      try {
        const r = await fetch(new URL(req.url ?? '/', upstream ?? 'http://invalid'), {
          method: req.method,
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: req.method === 'GET' ? undefined : raw.toString('utf8'),
        });
        const text = await r.text();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          return send(r.status, text, r.headers.get('content-type') ?? 'text/plain');
        }
        const saved = rewriteImages(JSON.stringify(maskPhones(trimBody(json))));
        const fx: Fixture = { key, status: r.status, body: JSON.parse(saved) };
        mkdirSync(FIXTURE_DIR, { recursive: true });
        writeFileSync(join(FIXTURE_DIR, fileFor(key)), JSON.stringify(fx) + '\n');
        fixtures.set(key, fx);
        return send(r.status, saved.replaceAll('{{BASE}}', base));
      } catch (e) {
        return send(502, JSON.stringify({ success: false, message: String(e) }));
      }
    }

    const fx = fixtures.get(key);
    if (fx) return send(fx.status, JSON.stringify(fx.body).replaceAll('{{BASE}}', base));
    if (req.method !== 'GET' && isKnownWrite(req.url ?? '')) {
      // Known writes (stats, crash reports …) need no fixture: accept them.
      return send(200, JSON.stringify(OK));
    }
    unmatched.push(key);
    return send(404, JSON.stringify({ success: false, code: 404, message: `no fixture: ${key}` }));
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : port}`;
  return {
    url: base,
    requests,
    unmatched,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
