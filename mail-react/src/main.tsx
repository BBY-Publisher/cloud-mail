import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from '@/components/ui/sonner';
import App from '@/App';
import '@/styles/globals.css';
import { init } from '@/init/init';

(async () => {
  try {
    await init();
  } catch (e) {
    console.error('Init failed:', e);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <Toaster />
    </StrictMode>,
  );
})();