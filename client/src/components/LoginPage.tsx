import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { translateApiError } from '../i18n';
import toast from 'react-hot-toast';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useTheme } from '../hooks/useTheme';
import ThemeSwitcher from '../components/ThemeSwitcher';
import AppLogo from '../components/AppLogo';
import * as api from '../services/api';
import { clientConfig } from '../config';

declare global {
    interface Window { Telegram: any; onTelegramAuth: (user: any) => void; }
}

const LoginPage: React.FC = () => {
    const [loginType, setLoginType] = useState<'default' | 'phone'>('default');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [guestUsername, setGuestUsername] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [code, setCode] = useState('');
    const [codeRequested, setCodeRequested] = useState(false);
    
    const [loading, setLoading] = useState(false);
    
    const { login, googleLogin, anonymousLogin, phoneRequestCode, phoneLogin, telegramLogin, updateCurrentUser } = useAuth();
    const { t } = useI18n();
    const { mode } = useTheme();
    const navigate = ReactRouterDOM.useNavigate();

    useEffect(() => {
        window.onTelegramAuth = async (user: any) => {
            setLoading(true);
            try {
                const loggedInUser = await telegramLogin(user);
                toast.success(t('toast.loginSuccess'));
                navigate('/');
            } catch (error: any) {
                handleAuthError(error);
            } finally {
                setLoading(false);
            }
        };

        const telegramBotUsername = clientConfig.TELEGRAM_BOT_USERNAME;
        if (!telegramBotUsername) {
            console.warn("Telegram Bot Username is not set in client/src/config.ts. Telegram login widget will not be displayed.");
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.async = true;
        script.setAttribute('data-telegram-login', telegramBotUsername);
        script.setAttribute('data-size', "large");
        script.setAttribute('data-radius', "20");
        script.setAttribute('data-onauth', "onTelegramAuth(user)");
        script.setAttribute('data-request-access', "write");

        // Wait for the component to mount before trying to find the container
        const mountTelegramWidget = () => {
            const telegramContainer = document.getElementById('telegram-login-container');
            if (telegramContainer) {
                telegramContainer.innerHTML = ''; // Clear previous instances
                telegramContainer.appendChild(script);
            }
        };
        
        // Use a small timeout to ensure the DOM element is available
        const timerId = setTimeout(mountTelegramWidget, 100);

        return () => {
            clearTimeout(timerId);
            const container = document.getElementById('telegram-login-container');
            if (container && script.parentNode === container) {
                try {
                    container.removeChild(script);
                } catch (e) {
                    // Ignore errors on cleanup
                }
            }
        }
    }, [t, navigate, telegramLogin]);


    const handleAuthError = (error: any) => {
        const message = translateApiError(error.message, t);
        if (error.data?.ban_expires_at) {
            const expiresDate = new Date(error.data.ban_expires_at).toLocaleString();
            toast.error(t('toast.userBannedMessage', { reason: error.data.ban_reason || 'N/A', expires: expiresDate }), { duration: 10000 });
        } else if (error.data?.is_banned) {
            toast.error(t('toast.userBannedPermanently', { reason: error.data.ban_reason || 'N/A' }), { duration: 10000 });
        } else {
           toast.error(message || t('toast.guestLoginError'));
        }
    };

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
        } catch (error: any) {
            handleAuthError(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneRequestCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await phoneRequestCode(phoneNumber, false); // isRegistering = false
            toast.success(response.message);
            setCodeRequested(true);
        } catch (error: any) {
             toast.error(error.message || t('toast.codeSendError'));
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await phoneLogin(phoneNumber, code);
            toast.success(t('toast.loginSuccess'));
            navigate('/');
        } catch (error: any) {
             handleAuthError(error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleAnonymousLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!guestUsername) {
            toast.error(t('login.guestUsernameRequired'));
            return;
        }
        setLoading(true);
        try {
            await anonymousLogin(guestUsername);
            toast.success(t('toast.loginSuccess'));
            navigate('/');
        } catch (error: any) {
            handleAuthError(error);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        setLoading(true);
        try {
            if (credentialResponse.credential) {
                await googleLogin(credentialResponse.credential);
                toast.success(t('toast.loginSuccess'));
                navigate('/');
            }
        } catch (error: any) {
            handleAuthError(error);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        toast.error('Google login failed. Please try again.');
    };
    
    const renderDefaultLogin = () => (
         <form onSubmit={handleLoginSubmit} className="space-y-4">
             <div className="soft-panel-inset p-1">
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('login.username')} />
            </div>
            <div className="soft-panel-inset p-1">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('login.password')} />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 px-4 btn-primary">
                {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
        </form>
    );
    
    const renderPhoneLogin = () => {
        if (!codeRequested) {
            return (
                 <form onSubmit={handlePhoneRequestCode} className="space-y-4">
                     <div className="soft-panel-inset p-1">
                        <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('login.phoneNumber')} />
                     </div>
                     <button type="submit" disabled={loading || !phoneNumber} className="w-full py-3 px-4 btn-primary">
                        {loading ? t('login.requestingCode') : t('login.requestCode')}
                    </button>
                </form>
            );
        } else {
            return (
                 <form onSubmit={handlePhoneLogin} className="space-y-4">
                     <div className="soft-panel-inset p-1">
                        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('login.verificationCode')} />
                     </div>
                     <button type="submit" disabled={loading || !code} className="w-full py-3 px-4 btn-primary">
                        {loading ? t('login.signingIn') : t('login.signIn')}
                    </button>
                </form>
            );
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4 font-sans" style={{backgroundColor: 'rgb(var(--color-bg-primary))'}}>
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <ThemeSwitcher />
                <LanguageSwitcher />
            </div>
            <div className="max-w-md w-full p-8 space-y-6 animate-fade-in soft-panel">
                <div className="text-center space-y-4">
                    <AppLogo className="mx-auto" />
                    <h1 className="text-3xl font-bold tracking-tight">{t('login.welcome')}</h1>
                    <p className="mt-2 text-slate-500 dark:text-slate-400">{t('login.signInPrompt')}</p>
                </div>
                
                 <div className="flex bg-slate-200 dark:bg-slate-700/50 rounded-lg p-1">
                    <button onClick={() => setLoginType('default')} className={`w-1/2 py-2 rounded-md text-sm font-bold transition ${loginType === 'default' ? 'bg-[rgb(var(--color-accent-primary))] text-white shadow' : 'text-slate-600 dark:text-slate-300'}`}>{t('login.defaultTab')}</button>
                    <button onClick={() => setLoginType('phone')} className={`w-1/2 py-2 rounded-md text-sm font-bold transition ${loginType === 'phone' ? 'bg-[rgb(var(--color-accent-primary))] text-white shadow' : 'text-slate-600 dark:text-slate-300'}`}>{t('login.phoneTab')}</button>
                </div>

                {loginType === 'default' ? renderDefaultLogin() : renderPhoneLogin()}

                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
                    <span className="flex-shrink mx-4 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">{t('login.or')}</span>
                    <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
                </div>

                <div className="flex flex-col items-center gap-3">
                    <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} theme={mode === 'dark' ? "filled_black" : "outline"} text="signin_with" shape="pill" />
                    <div id="telegram-login-container" className="h-[52px]"></div>
                </div>

                <form onSubmit={handleAnonymousLogin} className="space-y-2 pt-2">
                    <div className="soft-panel-inset p-1">
                        <input type="text" value={guestUsername} onChange={(e) => setGuestUsername(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('login.guestUsername')} />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-slate-500 dark:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 dark:hover:bg-slate-700 disabled:bg-slate-500 transition-colors">
                        {t('login.guestSignIn')}
                    </button>
                </form>
                
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-4">
                    {t('login.noAccount')}{' '}
                    <ReactRouterDOM.Link to="/register" className="font-medium text-[rgb(var(--color-accent-primary))] hover:text-[rgb(var(--color-accent-secondary))] transition-colors">
                        {t('login.signUp')}
                    </ReactRouterDOM.Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;