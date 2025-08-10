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
import { useCallState, setVideoRefs, acceptCall, rejectCall, endCall, toggleMute, toggleCamera } from './hooks/useCall';
import IncomingCallToast from './components/IncomingCallToast';
import { User } from './types';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash } from 'react-icons/fa';

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


// --- NEW CALL INTERFACE COMPONENT ---
const CallInterface: React.FC = () => {
    const { callStatus, localStream, remoteStream, peer, incomingCall, isMuted, isCameraOff } = useCallState();
    const localRef = useRef<HTMLVideoElement>(null);
    const remoteRef = useRef<HTMLVideoElement>(null);
    const [callTime, setCallTime] = useState(0);

    useEffect(() => {
        setVideoRefs({ local: localRef, remote: remoteRef });
    }, []);

    useEffect(() => {
        if (localRef.current) localRef.current.srcObject = localStream;
        if (remoteRef.current) remoteRef.current.srcObject = remoteStream;
    }, [localStream, remoteStream]);
    
    useEffect(() => {
        if (callStatus === 'incoming' && incomingCall) {
            IncomingCallToast({ caller: incomingCall.caller, onAccept: acceptCall, onReject: rejectCall });
        }
    }, [callStatus, incomingCall]);

     useEffect(() => {
        let timer: number;
        if (callStatus === 'in-call') {
            setCallTime(0);
            timer = window.setInterval(() => {
                setCallTime(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [callStatus]);
    
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const peerInfo: User | null = peer || incomingCall?.caller || null;

    if (callStatus === 'idle' || callStatus === 'failed') {
        return null;
    }
    
    // Incoming call toast is handled separately, so we only show full UI for active calls.
    if (callStatus === 'incoming') {
        return null;
    }

    return (
        <div className="call-interface">
            <video ref={remoteRef} autoPlay playsInline className="remote-video-fullscreen" />
            <video ref={localRef} autoPlay playsInline muted className="local-video-pip" />
            
            <div className="call-info-overlay">
                {peerInfo && (
                    <div className="bg-black/50 rounded-full py-2 px-6 inline-block text-white text-center">
                        <p className="font-bold text-xl">{peerInfo.name}</p>
                        <p className="text-sm">{callStatus === 'in-call' ? formatTime(callTime) : 'Calling...'}</p>
                    </div>
                )}
            </div>
            
            <div className="call-controls-bar">
                <button onClick={toggleMute} className={`call-control-btn ${isMuted ? 'danger' : ''}`}><FaMicrophoneSlash className={`w-6 h-6 ${isMuted ? 'hidden' : 'inline'}`} /><FaMicrophone className={`w-6 h-6 ${isMuted ? 'inline' : 'hidden'}`} /></button>
                <button onClick={toggleCamera} className={`call-control-btn ${isCameraOff ? 'danger' : ''}`}><FaVideoSlash className={`w-6 h-6 ${isCameraOff ? 'hidden' : 'inline'}`} /><FaVideo className={`w-6 h-6 ${isCameraOff ? 'inline' : 'hidden'}`} /></button>
                <button onClick={endCall} className="call-control-btn danger"><FaPhoneSlash className="w-6 h-6" /></button>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const { mode } = useTheme();

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
      <ReactRouterDOM.BrowserRouter>
        <AppRoutes />
      </ReactRouterDOM.BrowserRouter>
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
        
        {/* Standalone Chat Route */}
        <ReactRouterDOM.Route path="/app/chat-standalone/:chatId" element={<ProtectedRoute />}>
            <ReactRouterDOM.Route index element={<StandaloneChatPage />} />
        </ReactRouterDOM.Route>

        {/* Protected Application Routes */}
        <ReactRouterDOM.Route path="/app/*" element={<ProtectedRoute />}>
          {/* If authenticated and not banned, render the main messenger layout */}
          <ReactRouterDOM.Route path="*" element={currentUser && !currentUser.isEffectivelyBanned ? <MessengerLayout /> : <LoadingSpinner />} />
        </ReactRouterDOM.Route>
        
        {/* Fallback redirect */}
        <ReactRouterDOM.Route path="*" element={<ReactRouterDOM.Navigate to={currentUser ? "/app" : "/"} replace />} />
      </ReactRouterDOM.Routes>
  );
};

export default App;