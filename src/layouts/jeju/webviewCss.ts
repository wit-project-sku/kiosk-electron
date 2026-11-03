/**
 * Undo a `<webview>.insertCSS()` without ever throwing.
 *
 * Electron's `removeInsertedCSS` resolves the guest first, and when the
 * `<webview>` is being torn down (detached from the DOM, or never reached
 * dom-ready) it throws SYNCHRONOUSLY — "The WebView must be attached to the DOM
 * and the dom-ready event emitted before this method can be called" — before any
 * promise exists, so a `.catch()` on the result never sees it. Thrown from an
 * effect cleanup, that error reaches the React error boundary and the visitor
 * gets "Something went wrong". 제주공항's 점검 notice hit exactly this: it replaces
 * the whole tree, unmounting the pre-warmed 탐나오/제주큐랑 webviews.
 *
 * A detached webview takes its injected CSS with it, so there is nothing left
 * to undo in that case.
 */
export function removeInsertedCssSafely(
  webview: { removeInsertedCSS?: (key: string) => Promise<void> },
  key: string | undefined,
): void {
  if (!key || !webview.removeInsertedCSS) return;
  try {
    void webview.removeInsertedCSS(key).catch(() => {});
  } catch {
    // Detached / not dom-ready — see above.
  }
}
