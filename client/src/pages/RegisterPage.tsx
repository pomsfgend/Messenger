import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import toast from 'react-hot-toast';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';
import AppLogo from '../components/AppLogo';
import * as api from '../services/api';

const RegisterPage: React.FC = () => {
    const [registerType, setRegisterType] = useState<'default' | 'phone'>('default');
    
    // Default registration state
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Phone registration state
    const [phoneStep, setPhoneStep] = useState(1); // 1: Enter phone, 2: Verify code, 3: Set credentials
    const [phoneNumber, setPhoneNumber] = useState('');
    const [code, setCode] = useState('');
    const [phoneUsername, setPhoneUsername] = useState('');
    const [phonePassword, setPhonePassword] = useState('');
    const [phoneConfirmPassword, setPhoneConfirmPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const { register, phoneLogin } = useAuth();
    const { t } = useI18n();
    const navigate = ReactRouterDOM.useNavigate();

    const handleDefaultSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password || !displayName) {
            toast.error(t('register.allFieldsRequired'));
            return;
        }
        if (password !== confirmPassword) {
            toast.error(t('register.passwordsDoNotMatch'));
            return;
        }
        setLoading(true);
        try {
            await register(username, password, displayName);
            toast.success(t('toast.registerSuccess'));
            navigate('/app');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('register.usernameExists'));
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneRequestCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.phoneRequestCode(phoneNumber, true); // isRegistering = true
            toast.success(response.message, { duration: 6000 });
            setPhoneStep(2);
        } catch (error: any) {
            toast.error(error.message || t('toast.codeSendError'));
        } finally {
            setLoading(false);
        }
    };
    
    const handlePhoneVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.phoneVerifyCode(phoneNumber, code);
            toast.success(t("toast.codeVerified"));
            setPhoneStep(3);
        } catch (error: any) {
             toast.error(error.message || t("toast.codeVerifyError"));
        } finally {
            setLoading(false);
        }
    };
    
    const handlePhoneRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneUsername || !phonePassword) {
            return toast.error(t('register.allFieldsRequired'));
        }
        if (phonePassword !== phoneConfirmPassword) {
            return toast.error(t('register.passwordsDoNotMatch'));
        }
        setLoading(true);
        try {
            // After successful registration via API, we log in the user to establish a session
            await api.phoneRegister(phoneNumber, phoneUsername, phonePassword);
            await phoneLogin(phoneNumber, code); // This uses the verified code to log in
            toast.success(t('toast.registerSuccess'));
            navigate('/app');
        } catch(error: any) {
             toast.error(error.message || t("toast.registrationError"));
        } finally {
            setLoading(false);
        }
    };

    const renderDefaultRegister = () => (
        <form onSubmit={handleDefaultSubmit} className="space-y-4">
           <div className="soft-panel-inset p-1">
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('profile.displayName')} />
           </div>
           <div className="soft-panel-inset p-1">
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('register.loginUsername')} />
           </div>
           <p className="text-xs text-center text-slate-500 dark:text-slate-400 -mt-2 px-2">This is your unique login. Your display name can be set later in your profile.</p>
           <div className="soft-panel-inset p-1">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('register.password')} />
           </div>
           <div className="soft-panel-inset p-1">
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('register.confirmPassword')} />
           </div>
          <button type="submit" disabled={loading} className="w-full py-3 px-4 btn-primary">
            {loading ? t('register.creatingAccount') : t('register.signUp')}
          </button>
        </form>
    );

    const renderPhoneRegister = () => {
        if (phoneStep === 1) {
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
        }
        if (phoneStep === 2) {
             return (
                 <form onSubmit={handlePhoneVerifyCode} className="space-y-4">
                     <div className="soft-panel-inset p-1">
                        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('login.verificationCode')} />
                     </div>
                     <button type="submit" disabled={loading || !code} className="w-full py-3 px-4 btn-primary">
                        {loading ? t('register.verifying') : t('register.verifyCode')}
                    </button>
                </form>
            );
        }
        if (phoneStep === 3) {
            return (
                 <form onSubmit={handlePhoneRegister} className="space-y-4">
                   <div className="soft-panel-inset p-1">
                      <input type="text" value={phoneUsername} onChange={(e) => setPhoneUsername(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('register.loginUsername')} />
                   </div>
                   <p className="text-xs text-center text-slate-500 dark:text-slate-400 -mt-2 px-2">This is your unique login. Your display name can be set later in your profile.</p>
                   <div className="soft-panel-inset p-1">
                      <input type="password" value={phonePassword} onChange={(e) => setPhonePassword(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('register.password')} />
                   </div>
                   <div className="soft-panel-inset p-1">
                      <input type="password" value={phoneConfirmPassword} onChange={(e) => setPhoneConfirmPassword(e.target.value)} className="w-full bg-transparent p-3 text-slate-800 dark:text-white outline-none" placeholder={t('register.confirmPassword')} />
                   </div>
                  <button type="submit" disabled={loading} className="w-full py-3 px-4 btn-primary">
                    {loading ? t('register.creatingAccount') : t('register.signUp')}
                  </button>
                </form>
            )
        }
        return null;
    }

    return (
        <div className="min-h-screen w-full overflow-y-auto flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 p-4 font-sans relative" style={{backgroundColor: 'rgb(var(--color-bg-primary))'}}>
            <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center w-full">
                <ReactRouterDOM.Link to="/" className="z-20">
                    <AppLogo imgClassName="h-16 w-16"/>
                </ReactRouterDOM.Link>
                <h1 className="absolute left-1/2 -translate-x-1/2 text-2xl sm:text-3xl font-bold tracking-wider auth-neon-title">
                    Мессенджер Бульк
                </h1>
                <div className="z-20 flex items-center gap-2">
                    <ThemeSwitcher />
                    <LanguageSwitcher />
                </div>
            </header>
          <div className="max-w-md w-full p-4 sm:p-8 space-y-4 animate-fade-in soft-panel mt-24 mb-8">
            <div className="bg-slate-200/30 dark:bg-slate-800/30 p-4 sm:p-6 rounded-xl space-y-4">
                <div className="text-center space-y-2 mb-4">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{t('register.createAccount')}</h1>
                    <p className="text-slate-500 dark:text-slate-400">{t('register.joinPrompt')}</p>
                </div>

                <div className="flex bg-slate-200 dark:bg-slate-700/50 rounded-lg p-1">
                    <button onClick={() => setRegisterType('default')} className={`w-1/2 py-2 rounded-md text-sm font-bold transition ${registerType === 'default' ? 'bg-[rgb(var(--color-accent-primary))] text-white' : 'text-slate-600 dark:text-slate-300'}`}>{t('login.defaultTab')}</button>
                    <button onClick={() => setRegisterType('phone')} className={`w-1/2 py-2 rounded-md text-sm font-bold transition ${registerType === 'phone' ? 'bg-[rgb(var(--color-accent-primary))] text-white' : 'text-slate-600 dark:text-slate-300'}`}>{t('login.phoneTab')}</button>
                </div>

                {registerType === 'default' ? renderDefaultRegister() : renderPhoneRegister()}
                
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-2">
                  {t('register.hasAccount')}{' '}
                  <ReactRouterDOM.Link to="/login" className="font-medium text-[rgb(var(--color-accent-primary))] hover:text-[rgb(var(--color-accent-secondary))] transition-colors">
                    {t('register.signIn')}
                  </ReactRouterDOM.Link>
                </p>
            </div>
          </div>
        </div>
    );
};

export default RegisterPage;