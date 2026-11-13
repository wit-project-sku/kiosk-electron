import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * electron-vite configuration.
 *
 * Three independent build pipelines (main / preload / renderer) keep the
 * Electron processes cleanly separated. Path aliases are mirrored in the
 * tsconfig files so the editor and the bundler agree on module resolution.
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@layouts': resolve('src/layouts'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          // Three HTML entry points: the operator dashboard, the fullscreen
          // customer display window and the ordinary 지점 설정 window.
          index: resolve('src/renderer/index.html'),
          display: resolve('src/renderer/display.html'),
          setup: resolve('src/renderer/setup.html'),
        },
      },
    },
  },
});
