import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Poppins for the camera/countdown screen headings (Figma).
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
// Noto Sans KR. The touch window has always loaded it (main.tsx); this window
// never did, so every Korean line here — the 제주 camera guide's included — was
// silently falling back to whatever the OS ships. Weights match main.tsx.
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/600.css';
import '@fontsource/noto-sans-kr/700.css';
import { DisplayApp } from './DisplayApp';
import { ErrorBoundary } from './components/shared/ErrorBoundary/ErrorBoundary';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <DisplayApp />
    </ErrorBoundary>
  </StrictMode>,
);
