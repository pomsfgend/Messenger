import React, { useEffect, lazy, Suspense, useRef, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import MagicLoginPage from './pages/MagicLoginPage';
import LandingPage from './pages/LandingPage'; // Import the new landing page
import StandaloneChatPage from './pages/StandaloneChatPage'; // Import for standalone chat
import { Toaster, toast } from 'react-hot-toast';
import { useTheme } from './hooks/useTheme';
import BanScreen from './components/BanScreen';
import * as api from './services/api';
import { useI18n } from './hooks/useI18n';
import { useSocket } from './hooks/useSocket';
import ParticleBackground from './components/ParticleBackground';
import { CallInterface } from './components/call/CallInterface';
import { TelegramAuthModal } from './components/TelegramAuthModal';

const AdminPage = lazy(() => import('./pages/AdminPage'));

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};


const App: React.FC = () => {
  const { mode } = useTheme();

  useEffect(() => {
    // @ts-ignore
    if (window.Telegram && window.Telegram.WebApp) {
        // @ts-ignore
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.setHeaderColor('#2b2d31');
        tg.setBackgroundColor('#1e1f22');
        tg.onEvent('backButtonClicked', () => window.history.back());
        if(window.history.length > 1) {
            tg.BackButton.show();
        }
    }
  }, []);

  useEffect(() => {
    const setAppHeight = () => {
      const doc = document.documentElement;
      doc.style.setProperty('--app-height', `${window.innerHeight}px`);
    }
    window.addEventListener('resize', setAppHeight);
    setAppHeight();
    return () => window.removeEventListener('resize', setAppHeight);
  }, []);

  const toastOptions = mode === 'dark' 
    ? { background: '#1e293b', color: '#e0e0ff' }
    : { background: '#ffffff', color: '#1e293b' };


  return (
    <>
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          className: 'text-center shadow-lg rounded-md',
          style: toastOptions,
        }}
      />
      <TelegramAuthModal />
      <AppRoutes />
    </>
  );
};

const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
);

// This component wraps public-only routes like login/register.
// If the user is already authenticated, it redirects them to the main app.
const PublicRoutes = () => {
    const { currentUser } = useAuth();
    if (currentUser) {
        return <ReactRouterDOM.Navigate to="/app" replace />;
    }
    return <ReactRouterDOM.Outlet />;
};


// This component protects routes that require authentication.
// It also handles the loading state.
const ProtectedRoute = () => {
    const { currentUser } = useAuth();
    const location = ReactRouterDOM.useLocation();

    if (currentUser === undefined) {
        return <LoadingSpinner />;
    }

    if (!currentUser) {
        return <ReactRouterDOM.Navigate to="/login" state={{ from: location }} replace />;
    }

    if (currentUser.isEffectivelyBanned) {
        return <BanScreen />;
    }
    
    // Pass through to the protected component (MessengerLayout)
    return <ReactRouterDOM.Outlet />;
};

const AdminRoute = () => {
    const { currentUser } = useAuth();
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'moderator') {
        return <ReactRouterDOM.Navigate to="/app" replace />;
    }
    return <ReactRouterDOM.Outlet />;
};

// This new component wraps the entire messenger part of the application
const MessengerLayout: React.FC = () => {
  const { currentUser } = useAuth();
  const { socket } = useSocket();
  const { t } = useI18n();
  const location = ReactRouterDOM.useLocation();
  const isAdminPage = location.pathname.startsWith('/app/admin');
  
  useEffect(() => {
    const setupPushNotifications = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push notifications are not supported by this browser.');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            await navigator.serviceWorker.ready;

            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return;
            }

            if (Notification.permission === 'granted') {
                const existingSubscription = await registration.pushManager.getSubscription();
                if (existingSubscription) {
                    return; 
                }

                const { publicKey } = await api.getVapidPublicKey();
                const applicationServerKey = urlBase64ToUint8Array(publicKey);
                
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey,
                });

                await api.subscribeToPush(subscription);
            }
        } catch (error) {
            if (!sessionStorage.getItem('pushConfigWarned')) {
                toast.error(t('toast.pushConfigError'), { duration: 8000 });
                sessionStorage.setItem('pushConfigWarned', 'true');
            }
            console.error('Service Worker or Push Subscription failed:', error);
        }
    };

    if (currentUser) {
      const timer = setTimeout(setupPushNotifications, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentUser, t]);

  useEffect(() => {
      if (!socket) return;
      const handleVisibilityChange = () => {
          socket.emit('windowFocusChanged', { isFocused: document.visibilityState === 'visible' });
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      handleVisibilityChange();

      return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [socket]);
  
  return (
    <div className={`relative w-full h-[var(--app-height)] ${isAdminPage ? '' : 'overflow-hidden'}`}>
      <ParticleBackground />
      <CallInterface /> 
      <div className="relative z-10 w-full h-full">
        {/* The router for the main application, paths are relative to /app */}
        <ReactRouterDOM.Routes>
            <ReactRouterDOM.Route path="chat/:chatId" element={<ChatPage />} />
            <ReactRouterDOM.Route index element={<ChatPage />} /> {/* Renders ChatPage with undefined chatId */}
            <ReactRouterDOM.Route element={<AdminRoute />}>
                <ReactRouterDOM.Route path="admin" element={
                    <Suspense fallback={<LoadingSpinner />}>
                        <AdminPage />
                    </Suspense>
                } />
            </ReactRouterDOM.Route>
            <ReactRouterDOM.Route path="*" element={<ReactRouterDOM.Navigate to="/app" replace />} />
        </ReactRouterDOM.Routes>
      </div>
    </div>
  );
};


const AppRoutes: React.FC = () => {
  const { currentUser } = useAuth();

  return (
      <ReactRouterDOM.Routes>
        {/* Public Routes */}
        <ReactRouterDOM.Route path="/" element={<LandingPage />} />
        <ReactRouterDOM.Route path="/auth/magic/:token" element={<MagicLoginPage />} /> 
        
        {/* Routes for unauthenticated users */}
        <ReactRouterDOM.Route element={<PublicRoutes />}>
          <ReactRouterDOM.Route path="/login" element={<LoginPage />} />
          <ReactRouterDOM.Route path="/register" element={<RegisterPage />} />
        </ReactRouterDOM.Route>
        
        {/* Protected Application Routes are now grouped under a single ProtectedRoute element */}
        <ReactRouterDOM.Route element={<ProtectedRoute />}>
            <ReactRouterDOM.Route path="/app/chat-standalone/:chatId" element={<StandaloneChatPage />} />
            <ReactRouterDOM.Route path="/app/*" element={<MessengerLayout />} />
        </ReactRouterDOM.Route>
        
        {/* Fallback redirect */}
        <ReactRouterDOM.Route path="*" element={<ReactRouterDOM.Navigate to={currentUser ? "/app" : "/"} replace />} />
      </ReactRouterDOM.Routes>
  );
};

export default App;