import { describe, expect, it } from 'vitest';
import {
  ArGenerationError,
  arFailureOf,
  fetchFailure,
  httpFailure,
  invalidResponseFailure,
} from '@main/services/ai/arFailure';

/** Node's fetch failure: TypeError('fetch failed') with the real reason on cause.code. */
const fetchFailed = (code: string): TypeError =>
  Object.assign(new TypeError('fetch failed'), { cause: { code } });

describe('why an AR compose call failed — sent with the failed shot', () => {
  it('an error answer reports the status and the Digicon message', () => {
    const body = JSON.stringify({
      success: false,
      message: 'Background change not available for outfit: 15.1',
      request_id: 'abc',
    });
    expect(httpFailure(400, body)).toEqual({
      kind: 'HTTP',
      status: 400,
      message: 'Background change not available for outfit: 15.1',
    });
  });

  it('a body that is not Digicon JSON is reported as is; an empty one as null', () => {
    expect(httpFailure(502, '<html>Bad Gateway</html>')).toEqual({
      kind: 'HTTP',
      status: 502,
      message: '<html>Bad Gateway</html>',
    });
    expect(httpFailure(500, '')).toEqual({ kind: 'HTTP', status: 500, message: null });
  });

  it('a 422 validation answer reports its detail', () => {
    const body = JSON.stringify({ detail: [{ loc: ['body', 'change_background'], msg: 'bad' }] });
    expect(httpFailure(422, body).message).toContain('change_background');
  });

  it('the message is cut at 1000 characters (the server column)', () => {
    expect(httpFailure(500, 'x'.repeat(1500)).message).toHaveLength(1000);
  });

  it('never reaching the server is NETWORK, with the reason code', () => {
    expect(fetchFailure(fetchFailed('ENOTFOUND'))).toEqual({
      kind: 'NETWORK',
      status: null,
      message: 'fetch failed (ENOTFOUND)',
    });
  });

  it('no answer in time is TIMEOUT', () => {
    expect(fetchFailure(fetchFailed('UND_ERR_HEADERS_TIMEOUT')).kind).toBe('TIMEOUT');
    expect(fetchFailure(Object.assign(new Error('aborted'), { name: 'TimeoutError' })).kind).toBe(
      'TIMEOUT',
    );
  });

  it('a 200 without a photo is INVALID_RESPONSE; a body cut off mid-read is NETWORK', () => {
    expect(invalidResponseFailure(200, new Error('AI response JSON missing image data.'))).toEqual({
      kind: 'INVALID_RESPONSE',
      status: 200,
      message: 'AI response JSON missing image data.',
    });
    expect(invalidResponseFailure(200, fetchFailed('ECONNRESET')).kind).toBe('NETWORK');
  });

  it('only the AR call carries a failure — any other pipeline error reports none', () => {
    const failure = { kind: 'HTTP' as const, status: 503, message: 'Server is busy' };
    expect(arFailureOf(new ArGenerationError('AR generation failed (503): …', failure))).toBe(
      failure,
    );
    expect(arFailureOf(new Error('ENOSPC: no space left on device'))).toBeNull();
  });
});
