import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/common/Toast';
import { MotivationalBackdrop } from './components/common/MotivationalBackdrop';
import { PointerGlow } from './components/common/PointerGlow';
import App from './App';
import { isSupabaseConfigured } from './lib/supabase';
import './index.css';

createRoot(document.getElementById('root')!).render(
  !isSupabaseConfigured ? (
    <div style={{ padding: '2rem', color: 'var(--t1, #fff)', fontFamily: 'monospace', position: 'relative', zIndex: 1 }}>
      <h2>Configuration missing</h2>
      <p>VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set for this build. Add them in the hosting environment variables for this deployment and rebuild.</p>
    </div>
  ) : (
  <StrictMode>
    <ThemeProvider>
      <MotivationalBackdrop />
      <PointerGlow />
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
  ),
);
