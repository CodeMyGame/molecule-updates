import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './lib/i18n';
import App from './App';
import './styles/globals.css';

// Global error handlers to forward UI errors to the daily error logger
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    try {
      if (window.electronAPI?.logger?.logError) {
        window.electronAPI.logger.logError({
          message: event.message || 'Uncaught window error',
          stack: event.error?.stack,
          context: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        }).catch(() => {});
      }
    } catch {
      // Ignore
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      if (window.electronAPI?.logger?.logError) {
        const reason = event.reason;
        const message =
          reason instanceof Error
            ? reason.message
            : typeof reason === 'string'
              ? reason
              : 'Unhandled promise rejection';
        const stack = reason instanceof Error ? reason.stack : undefined;

        window.electronAPI.logger.logError({
          message,
          stack,
          context: {
            type: 'unhandledrejection',
          },
        }).catch(() => {});
      }
    } catch {
      // Ignore
    }
  });
}

const container = document.getElementById('root')!;

createRoot(container).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#f9fafb',
            borderRadius: '8px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#f9fafb' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#f9fafb' } },
        }}
      />
    </HashRouter>
  </React.StrictMode>
);
