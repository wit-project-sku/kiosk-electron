import type { ReactNode } from 'react';

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Wraps every occurrence of the search query (case-insensitive) inside `text`
 * with a `<mark>` carrying `className`, leaving the rest as plain text. Each
 * whitespace-separated term is matched independently, so a multi-word query
 * highlights each word it finds.
 *
 * Returns the original string untouched when there's nothing to highlight, so
 * callers can drop it straight into JSX.
 */
export function highlightMatch(
  text: string | undefined,
  query: string,
  className: string | undefined,
): ReactNode {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (terms.length === 0 || !text) return text;

  const re = new RegExp(`(${terms.join('|')})`, 'gi');
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <mark key={start} className={className}>
        {m[0]}
      </mark>,
    );
    last = start + m[0].length;
  }
  if (out.length === 0) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}
