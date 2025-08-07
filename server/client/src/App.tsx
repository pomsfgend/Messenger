
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { I18nProvider, useI18n } from './hooks/useI18n';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import { Toaster, toast } from 'react-hot-toast';

const App: React.FC = () => {
  return (
    <I18nProvider>
      <AuthProvider>
        <Toaster
          position="top-center"
          reverseOrder={false}
          toastOptions={{
            className: '',
            style: {
              background: '#334155',
              color: '#e2e8f0',
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </I18nProvider>
  );
};

const AppRoutes: React.FC = () => {
  const { currentUser, loading, isInitialLoad } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    // This effect runs only once after the initial user load is complete.
    // It checks the new `profileSetup` flag to see if a prompt is needed.
    if (!isInitialLoad && currentUser && !currentUser.profileSetup) {
      setTimeout(() => {
        toast(t('toast.profileUpdatePrompt'), { icon: '👋', duration: 6000 });
      }, 1500);
    }
  }, [isInitialLoad, currentUser, t]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-slate-500"></div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={!currentUser ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/register" element={!currentUser ? <RegisterPage /> : <Navigate to="/" replace />} />
        <Route path="/profile" element={currentUser ? <ProfilePage /> : <Navigate to="/login" replace />} />
        <Route path="/chat/:chatId" element={currentUser ? <ChatPage /> : <Navigate to="/login" replace />} />
        <Route path="*" element={currentUser ? <Navigate to="/chat/global" replace /> : <Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
