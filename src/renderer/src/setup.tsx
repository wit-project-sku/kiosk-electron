import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KioskSetup } from './components/kiosk/KioskSetup';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <KioskSetup />
  </StrictMode>,
);
