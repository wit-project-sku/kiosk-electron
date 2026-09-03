import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useKioskStore } from '@renderer/store/kioskStore';

/**
 * Throwaway diagnostic for the 제주 barrier-free keypad (JNM JD-KP100).
 *
 * The pad enumerates as a plain USB HID keyboard — digits type into Notepad —
 * so every key arrives here as an ordinary `keydown`. What we do NOT know is
 * WHICH code each key sends: the digits may be `Digit1` or `Numpad1`, the arrow
 * cluster may or may not be real `Arrow*`, and `○` `△` `✕` are anyone's guess
 * (Notepad showed two of them producing Space and Backspace).
 *
 * Press every key on the pad once with this open and it prints the answer. The
 * table it draws is the input to the real key map — this component is deleted
 * once that map exists, and is NOT part of the keypad feature.
 *
 * DEV_MODE only, exactly like KioskSwitcher, so it can never appear on a live
 * kiosk. Opens by tapping the target in the top-left corner.
 */

/** One captured press, in the order it arrived. */
interface Press {
  /** `e.key` — the character/name, layout-dependent. */
  key: string;
  /** `e.code` — the PHYSICAL key. This is what the real map should key off. */
  code: string;
  keyCode: number;
  /** 0 standard · 1 left · 2 right · 3 numpad. Tells numpad from top-row. */
  location: number;
  mods: string;
  /** ms since the previous press — reveals a key that emits a burst. */
  gapMs: number | null;
}

/** Render `e.key` visibly: a space or an empty string is otherwise invisible. */
function showKey(key: string): string {
  if (key === ' ') return '[Space]';
  if (key === '') return '(empty)';
  return key;
}

function modsOf(e: KeyboardEvent): string {
  const m = [
    e.ctrlKey ? 'Ctrl' : '',
    e.altKey ? 'Alt' : '',
    e.shiftKey ? 'Shift' : '',
    e.metaKey ? 'Meta' : '',
  ].filter(Boolean);
  return m.length ? m.join('+') : '-';
}

export function KeypadProbe(): JSX.Element | null {
  const devMode = useKioskStore((s) => s.devMode);
  const enabled = devMode || import.meta.env.DEV;

  const [open, setOpen] = useState(false);
  const [presses, setPresses] = useState<Press[]>([]);
  const lastAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent): void => {
      // Swallow everything while probing. `✕` reported as Backspace would
      // otherwise delete real input, and the arrows would scroll the page
      // under the overlay — neither is what we are here to observe.
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return; // holding a key must not flood the table

      const now = Date.now();
      const gapMs = lastAtRef.current === null ? null : now - lastAtRef.current;
      lastAtRef.current = now;

      setPresses((prev) => [
        ...prev,
        {
          key: e.key,
          code: e.code,
          keyCode: e.keyCode,
          location: e.location,
          mods: modsOf(e),
          gapMs,
        },
      ]);
      // Mirrored to the console so the whole run can be copied out of DevTools
      // rather than transcribed off a 3840px screen.
      console.log('[KeypadProbe]', {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        location: e.location,
      });
    };

    // Capture phase, on `window`: nothing downstream gets a chance to swallow
    // a key before we have logged it.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  const clear = useCallback(() => {
    setPresses([]);
    lastAtRef.current = null;
  }, []);

  if (!enabled) return null;

  // Closed: just the corner target. Deliberately faint — it sits over the home
  // screen in dev and should not read as part of the design.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '6vmin',
          height: '6vmin',
          zIndex: 99999,
          background: 'rgba(0,0,0,0.18)',
          border: '1px dashed rgba(255,255,255,0.5)',
          color: '#fff',
          fontSize: '1.6vmin',
          cursor: 'pointer',
        }}
      >
        KEY
      </button>
    );
  }

  const last = presses[presses.length - 1];
  // Distinct physical keys seen so far — the pad has 18, so this is the
  // progress counter while pressing them one by one.
  const distinct = new Set(presses.map((p) => p.code)).size;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(8,10,14,0.94)',
        color: '#e8eaed',
        font: '400 1.6vmin/1.5 ui-monospace, Menlo, Consolas, monospace',
        display: 'flex',
        flexDirection: 'column',
        padding: '3vmin',
        gap: '2vmin',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '2vmin' }}>
        <strong style={{ fontSize: '2.4vmin' }}>Keypad probe - JD-KP100</strong>
        <span style={{ opacity: 0.6 }}>
          press every key once · {distinct} distinct / 18 expected
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '1vmin' }}>
          <button type="button" onClick={clear} style={BTN}>
            Clear
          </button>
          <button type="button" onClick={() => setOpen(false)} style={BTN}>
            Close
          </button>
        </span>
      </div>

      {/* The last press, large — readable across the room while the other hand
          is on the pad, so keys can be identified without leaning in. */}
      <div
        style={{
          border: '1px solid #2b3140',
          borderRadius: '1vmin',
          padding: '2vmin',
          background: '#11141b',
          minHeight: '9vmin',
        }}
      >
        {last ? (
          <div style={{ display: 'flex', gap: '4vmin', alignItems: 'baseline' }}>
            <span style={{ fontSize: '4vmin', color: '#ff9f43' }}>{last.code}</span>
            <span style={{ fontSize: '2.4vmin' }}>key: {showKey(last.key)}</span>
            <span style={{ opacity: 0.7 }}>keyCode {last.keyCode}</span>
            <span style={{ opacity: 0.7 }}>location {last.location}</span>
            <span style={{ opacity: 0.7 }}>mods {last.mods}</span>
          </div>
        ) : (
          <span style={{ opacity: 0.6, fontSize: '2.4vmin' }}>
            Waiting - press a key on the keypad...
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', border: '1px solid #2b3140', borderRadius: '1vmin' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: '#171b24' }}>
              {['#', 'code', 'key', 'keyCode', 'location', 'mods', 'gap'].map((h) => (
                <th key={h} style={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {presses.map((p, i) => (
              <tr key={i} style={{ background: i % 2 ? '#0e1119' : 'transparent' }}>
                <td style={TD}>{i + 1}</td>
                <td style={{ ...TD, color: '#ff9f43' }}>{p.code}</td>
                <td style={TD}>{showKey(p.key)}</td>
                <td style={TD}>{p.keyCode}</td>
                <td style={TD}>{p.location}</td>
                <td style={TD}>{p.mods}</td>
                <td style={{ ...TD, opacity: 0.6 }}>{p.gapMs === null ? '-' : `${p.gapMs}ms`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const BTN: CSSProperties = {
  background: '#232a37',
  color: '#e8eaed',
  border: '1px solid #394152',
  borderRadius: '0.6vmin',
  padding: '0.8vmin 2vmin',
  font: 'inherit',
  cursor: 'pointer',
};

const TH: CSSProperties = {
  textAlign: 'left',
  padding: '1vmin 1.5vmin',
  borderBottom: '1px solid #2b3140',
  fontWeight: 600,
};

const TD: CSSProperties = {
  padding: '0.8vmin 1.5vmin',
  borderBottom: '1px solid #1c212b',
};
