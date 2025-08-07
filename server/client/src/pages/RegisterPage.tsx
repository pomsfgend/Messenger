
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import toast from 'react-hot-toast';
import LanguageSwitcher from '../components/LanguageSwitcher';

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
        toast.error(t('register.allFieldsRequired'));
        return;
    }
    if (password !== confirmPassword) {
      toast.error(t('register.passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      await register(username, password);
      toast.success(t('toast.registerSuccess'));
      navigate('/');
    } catch (error) {
       toast.error(error instanceof Error ? error.message : t('register.usernameExists'));
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
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('register.createAccount')}</h1>
          <p className="mt-2 text-slate-400">{t('register.joinPrompt')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
           <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-slate-700/50 border-2 border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            placeholder={t('register.loginUsername')}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-700/50 border-2 border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            placeholder={t('register.password')}
          />
           <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-slate-700/50 border-2 border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            placeholder={t('register.confirmPassword')}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 transition-all duration-300 disabled:bg-indigo-400/50 transform hover:scale-105"
          >
            {loading ? t('register.creatingAccount') : t('register.signUp')}
          </button>
        </form>
        <p className="text-center text-sm text-slate-400">
          {t('register.hasAccount')}{' '}
          <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
            {t('register.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;