
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import CountdownTimer from './CountdownTimer';

const BanScreen: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const { t } = useI18n();

    if (!currentUser || !currentUser.is_banned) {
        return null;
    }

    const isPermanent = currentUser.ban_expires_at === 'Permanent' || (currentUser.ban_expires_at && new Date(currentUser.ban_expires_at).getFullYear() > 9000);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4 font-sans" style={{ backgroundColor: 'rgb(var(--color-bg-primary))' }}>
            <div className="max-w-md w-full p-8 space-y-6 text-center soft-panel">
                <div className="mx-auto h-16 w-16 text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">{t('ban.title')}</h1>
                <p className="text-slate-500 dark:text-slate-400">{t('ban.message')}</p>

                <div className="text-left bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg">
                    <p className="font-semibold">{t('ban.reason')}</p>
                    <p className="text-sm">{currentUser.ban_reason || t('ban.noReason')}</p>
                </div>
                
                <div className="text-left bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg">
                    {isPermanent ? (
                        <p className="font-semibold text-center">{t('ban.permanent')}</p>
                    ) : (
                        <>
                            <p className="font-semibold">{t('ban.expiresIn')}</p>
                            <div className="text-2xl font-mono text-center text-indigo-600 dark:text-indigo-400 py-2">
                                <CountdownTimer expiryTimestamp={currentUser.ban_expires_at!} />
                            </div>
                        </>
                    )}
                </div>

                <button onClick={logout} className="w-full py-3 px-4 btn-primary">
                    {t('ban.logout')}
                </button>
            </div>
        </div>
    );
};

export default BanScreen;