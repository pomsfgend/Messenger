
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import toast from 'react-hot-toast';
import LanguageSwitcher from '../components/LanguageSwitcher';

// This component encapsulates the Telegram Login script logic.
const TelegramLoginWidget: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { updateCurrentUser } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    (window as any).onTelegramAuth = async (user: any) => {
      try {
        toast.loading(t('login.signingIn'));
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Telegram login failed');
        }

        const loggedInUser = await response.json();
        updateCurrentUser(loggedInUser);
        toast.dismiss();
        toast.success(t('toast.loginSuccess'));
        navigate('/');
      } catch (error) {
        toast.dismiss();
        toast.error(error instanceof Error ? error.message : 'An error occurred');
      }
    };

    const script = document.getElementById('telegram-widget') as HTMLScriptElement;
    if (!script) return;
    
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    // TODO: Replace 'your_bot_name_here' with your actual Telegram bot username.
    // This is required for Telegram login to work. See README.md for details.
    script.setAttribute('data-telegram-login', 'your_bot_name_here'); 
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    
    containerRef.current.appendChild(script);

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [t, navigate, updateCurrentUser]);

  return <div ref={containerRef} className="w-full flex justify-center"></div>;
};


const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [guestUsername, setGuestUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, anonymousLogin } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
        toast.error(t('login.usernameRequired'));
        return;
    }
    setLoading(true);
    try {
      await login(username, password);
      toast.success(t('toast.loginSuccess'));
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestUsername.trim()) {
        toast.error(t('login.guestUsernameRequired'));
        return;
    }
    setLoading(true);
    try {
      await anonymousLogin(guestUsername.trim());
      toast.success(t('toast.loginSuccess'));
      navigate('/');
    } catch (error) {
        toast.error(error instanceof Error ? error.message : t('login.invalidCredentials'));
    } finally {
        setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans">
        <div className="absolute top-4 right-4">
            <LanguageSwitcher />
        </div>
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl shadow-indigo-900/20 p-8 space-y-6 animate-fade-in">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('login.welcome')}</h1>
          <p className="mt-2 text-slate-400">{t('login.signInPrompt')}</p>
        </div>
        
        {/* Regular Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-6">
          <div className="relative">
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="peer w-full bg-slate-700/50 border-2 border-slate-600 rounded-lg p-3 text-white placeholder-transparent focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder={t('login.username')}
            />
            <label htmlFor="username" className="absolute left-3 -top-2.5 text-slate-400 text-sm bg-slate-800 px-1 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-400 peer-placeholder-shown:top-3.5 peer-placeholder-shown:bg-transparent peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-indigo-400 peer-focus:bg-slate-800">{t('login.username')}</label>
          </div>
          <div className="relative">
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="peer w-full bg-slate-700/50 border-2 border-slate-600 rounded-lg p-3 text-white placeholder-transparent focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder={t('login.password')}
            />
            <label htmlFor="password" className="absolute left-3 -top-2.5 text-slate-400 text-sm bg-slate-800 px-1 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-400 peer-placeholder-shown:top-3.5 peer-placeholder-shown:bg-transparent peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-indigo-400 peer-focus:bg-slate-800">{t('login.password')}</label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-all duration-300 disabled:bg-indigo-400/50 disabled:cursor-not-allowed transform hover:scale-105"
          >
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
        
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-600"></div>
          <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase">{t('login.or')}</span>
          <div className="flex-grow border-t border-slate-600"></div>
        </div>
        
        {/* Anonymous Login Form */}
        <form onSubmit={handleAnonymousSubmit} className="space-y-4">
            <div className="relative">
                 <input
                    type="text"
                    id="guestUsername"
                    value={guestUsername}
                    onChange={(e) => setGuestUsername(e.target.value)}
                    className="peer w-full bg-slate-700/50 border-2 border-slate-600 rounded-lg p-3 text-white placeholder-transparent focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
                    placeholder={t('login.guestUsername')}
                />
                <label htmlFor="guestUsername" className="absolute left-3 -top-2.5 text-slate-400 text-sm bg-slate-800 px-1 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-400 peer-placeholder-shown:top-3.5 peer-placeholder-shown:bg-transparent peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-teal-400 peer-focus:bg-slate-800">{t('login.guestUsername')}</label>
            </div>
             <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-teal-500 transition-all duration-300 disabled:bg-teal-400/50 disabled:cursor-not-allowed transform hover:scale-105"
            >
                {loading ? t('login.signingIn') : t('login.guestSignIn')}
            </button>
        </form>

        <p className="text-center text-sm text-slate-400 pt-4">
          {t('login.noAccount')}{' '}
          <Link to="/register" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
            {t('login.signUp')}
          </Link>
        </p>

      </div>
    </div>
  );
};

export default LoginPage;