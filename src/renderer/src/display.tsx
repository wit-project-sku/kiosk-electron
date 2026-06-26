import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Poppins for the camera/countdown screen headings (Figma).
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
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
