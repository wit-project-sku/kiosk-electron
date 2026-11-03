import { describe, expect, it, vi } from 'vitest';
// Layout module with no DOM/window use — imported relatively (no @layouts alias under tsconfig.node.json).
import { removeInsertedCssSafely } from '../../../src/layouts/jeju/webviewCss';

const DETACHED =
  'The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.';

describe('removeInsertedCssSafely', () => {
  it('swallows the synchronous throw of a detached webview (the 점검 notice crash)', () => {
    const webview = {
      removeInsertedCSS: vi.fn((): Promise<void> => {
        throw new Error(DETACHED);
      }),
    };
    expect(() => removeInsertedCssSafely(webview, 'css-1')).not.toThrow();
    expect(webview.removeInsertedCSS).toHaveBeenCalledWith('css-1');
  });

  it('swallows a rejected removal too', async () => {
    const webview = { removeInsertedCSS: vi.fn(() => Promise.reject(new Error('gone'))) };
    expect(() => removeInsertedCssSafely(webview, 'css-1')).not.toThrow();
    await Promise.resolve();
  });

  it('does nothing without a key or without the method', () => {
    const webview = { removeInsertedCSS: vi.fn(() => Promise.resolve()) };
    removeInsertedCssSafely(webview, undefined);
    removeInsertedCssSafely({}, 'css-1');
    expect(webview.removeInsertedCSS).not.toHaveBeenCalled();
  });
});
