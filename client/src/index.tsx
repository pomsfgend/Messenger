import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider } from './hooks/useTheme';
import { SocketProvider } from './hooks/useSocket';
import { AuthProvider } from './hooks/useAuth';
import { I18nProvider } from './hooks/useI18n';
import { clientConfig } from './config';

// CRITICAL: Add a startup check for Google Client ID.
if (!clientConfig.GOOGLE_CLIENT_ID) {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `<div style="font-family: sans-serif; padding: 2rem; text-align: center; color: #ef4444;">
      <h1 style="font-size: 1.5rem; font-weight: bold;">FATAL CONFIGURATION ERROR</h1>
      <p>GOOGLE_CLIENT_ID is not defined in the client/src/config.ts file. Google Login will not work.</p>
      <p>Please check the setup instructions in README.md.</p>
    </div>`;
  }
  // This stops the app from rendering further.
  throw new Error("FATAL: GOOGLE_CLIENT_ID is not defined in the client/src/config.ts file.");
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        {/* @ts-ignore - Workaround for potential type incompatibility with React 18 */}
        <GoogleOAuthProvider clientId={clientConfig.GOOGLE_CLIENT_ID}>
          <ThemeProvider>
            <AuthProvider>
              <SocketProvider>
                <App />
              </SocketProvider>
            </AuthProvider>
          </ThemeProvider>
        </GoogleOAuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);