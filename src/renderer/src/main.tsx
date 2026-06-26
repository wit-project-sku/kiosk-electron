import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Bundle Noto Sans KR (the Figma design font) so all kiosk text matches exactly
// — weights used: Regular/Medium/SemiBold/Bold.
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/600.css';
import '@fontsource/noto-sans-kr/700.css';
import '@fontsource/noto-sans-kr/800.css';
import '@fontsource/noto-sans-kr/900.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import { App } from './App';
import { ErrorBoundary } from './components/shared/ErrorBoundary/ErrorBoundary';
import { hydrateInitialState } from './bootstrap';
import './styles/global.css';

hydrateInitialState();

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
