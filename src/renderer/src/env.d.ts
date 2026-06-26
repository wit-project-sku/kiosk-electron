/// <reference types="vite/client" />
/* eslint-disable @typescript-eslint/no-empty-object-type */

import type * as React from 'react';

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

/**
 * React 19's `@types/react` no longer ships a global `JSX` namespace (it now
 * lives under `React.JSX`). Re-expose it globally so component return types can
 * stay written as `JSX.Element` without importing React in every file.
 */
declare global {
  namespace JSX {
    type Element = React.JSX.Element;
    type ElementType = React.JSX.ElementType;
    type ElementClass = React.JSX.ElementClass;
    interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
    interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends React.JSX.IntrinsicElements {
      // Electron <webview> tag (enabled via webviewTag) for embedding sites.
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          partition?: string;
          allowpopups?: string;
          useragent?: string;
        },
        HTMLElement
      >;
    }
  }
}
