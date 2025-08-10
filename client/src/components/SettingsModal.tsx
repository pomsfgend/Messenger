import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import { useI18n } from '../hooks/useI18n';
import ThemeSelector from './ThemeSelector';
import { useTheme } from '../hooks/useTheme';
import Enable2FAModal from './Enable2FAModal';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM;
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

interface Props {
    onClose: () => void;
}

const PrivacySwitch: React.FC<{
    label: string;
    helpText?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}> = ({ label, helpText, checked, onChange, disabled }) => (
    <div className="flex items-start justify-between py-4">
        <div>
            <h4 className="font-semibold text-slate-700 dark:text-slate-200">{label}</h4>
            {helpText && <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">{helpText}</p>}
        </div>
        <div className="flex-shrink-0 ml-4">
            <label className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={checked} 
                    onChange={(e) => onChange(e.target.checked)} 
                    disabled={disabled}
                    className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[rgb(var(--color-accent-primary))]"></div>
            </label>
        </div>
    </div>
);

const SettingsModal: React.FC<Props> = ({ onClose }) => {
    const { currentUser, updateCurrentUser, logout, refreshSession } = useAuth();
    const { t, language, setLanguage } = useI18n();
    const { mode, setMode } = useTheme();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('privacy');
    const [loading, setLoading] = useState(false);
    const [isEnable2FAModalOpen, setEnable2FAModalOpen] = useState(false);
    
    const [privacySettings, setPrivacySettings] = useState({
        privacy_show_phone: currentUser?.privacy_show_phone ?? true,
        privacy_show_telegram: currentUser?.privacy_show_telegram ?? true,
        privacy_show_dob: currentUser?.privacy_show_dob ?? true,
        privacy_show_description: currentUser?.privacy_show_description ?? true,
        privacy_show_last_seen: currentUser?.privacy_show_last_seen ?? true,
        privacy_show_typing: currentUser?.privacy_show_typing ?? true,
    });
    
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });

    const modalRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const modalId = 'settings';
    const { transform } = useDraggable(modalRef, handleRef, modalId);
    const { size } = useResizable(modalRef, handleRef, modalId);

    const handlePrivacyChange = (key: keyof typeof privacySettings, value: boolean) => {
        setPrivacySettings(prev => ({ ...prev, [key]: value }));
    };

    const savePrivacySettings = async () => {
        setLoading(true);
        try {
            const updatedUser = await api.updateUserPrivacy(privacySettings);
            updateCurrentUser(updatedUser);
            toast.success(t('toast.privacySuccess'));
            onClose();
        } catch (error) {
            toast.error(t('toast.privacyError'));
        } finally {
            setLoading(false);
        }
    };
    
    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.changePassword(passwordData.currentPassword, passwordData.newPassword);
            toast.success(t('toast.passwordChangeSuccess'));
            setPasswordData({ currentPassword: '', newPassword: '' });
        } catch(error) {
            toast.error(error instanceof Error ? error.message : t('toast.passwordChangeError'));
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteAccount = async () => {
        if(window.confirm(t('profile.deleteConfirm'))) {
            setLoading(true);
            try {
                await api.deleteMyAccount();
                toast.success(t('toast.deleteSuccess'));
                logout(); // This will navigate to login page
            } catch (error) {
                 toast.error(t('toast.deleteError'));
            } finally {
                setLoading(false);
            }
        }
    }

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };
    
    const handleDisable2FA = async () => {
        setLoading(true);
        try {
            await api.disable2FA();
            toast.success("Two-Factor Authentication disabled.");
            await refreshSession(); // Refresh user data
        } catch (error) {
            toast.error("Failed to disable 2FA.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleEnable2FASuccess = async () => {
        setEnable2FAModalOpen(false);
        await refreshSession();
    };


    const TabButton: React.FC<{tabId: string, label: string}> = ({ tabId, label }) => (
        <button 
            onClick={() => setActiveTab(tabId)} 
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === tabId ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
        >
            {label}
        </button>
    );
    
    const renderContent = () => {
        switch(activeTab) {
            case 'privacy':
                return (
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        <PrivacySwitch label={t('privacy.show_phone')} checked={privacySettings.privacy_show_phone} onChange={v => handlePrivacyChange('privacy_show_phone', v)} />
                        <PrivacySwitch label={t('privacy.show_telegram')} checked={privacySettings.privacy_show_telegram} onChange={v => handlePrivacyChange('privacy_show_telegram', v)} />
                        <PrivacySwitch label={t('privacy.show_dob')} checked={privacySettings.privacy_show_dob} onChange={v => handlePrivacyChange('privacy_show_dob', v)} />
                        <PrivacySwitch label={t('privacy.show_description')} checked={privacySettings.privacy_show_description} onChange={v => handlePrivacyChange('privacy_show_description', v)} />
                        <PrivacySwitch label={t('privacy.show_last_seen')} helpText={t('privacy.show_last_seen_help')} checked={privacySettings.privacy_show_last_seen} onChange={v => handlePrivacyChange('privacy_show_last_seen', v)} />
                        <PrivacySwitch label={t('privacy.show_typing')} helpText={t('privacy.show_typing_help')} checked={privacySettings.privacy_show_typing} onChange={v => handlePrivacyChange('privacy_show_typing', v)} />
                    </div>
                );
            case 'appearance':
                 return (
                    <div className="space-y-6">
                        <div>
                            <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">{t('profile.themeMode')}</h4>
                            <div className="flex bg-slate-200 dark:bg-slate-700/50 rounded-lg p-1">
                                <button onClick={() => setMode('light')} className={`w-1/2 py-2 rounded-md text-sm font-bold transition ${mode === 'light' ? 'bg-[rgb(var(--color-accent-primary))] text-white shadow' : 'text-slate-600 dark:text-slate-300'}`}>{t('theme.light')}</button>
                                <button onClick={() => setMode('dark')} className={`w-1/2 py-2 rounded-md text-sm font-bold transition ${mode === 'dark' ? 'bg-[rgb(var(--color-accent-primary))] text-white shadow' : 'text-slate-600 dark:text-slate-300'}`}>{t('theme.dark')}</button>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">{t('profile.theme')}</h4>
                            <ThemeSelector />
                        </div>
                         <div>
                            <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">{t('profile.language')}</h4>
                             <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="w-full bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option value="en">English</option>
                                <option value="ru">Русский</option>
                            </select>
                        </div>
                    </div>
                );
            case 'security':
                return (
                    <div className="space-y-6 divide-y divide-slate-200 dark:divide-slate-700">
                        <div className="pt-2">
                             <h3 className="font-semibold text-slate-700 dark:text-slate-200">Двухфакторная аутентификация</h3>
                             <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Повысьте безопасность своей учетной записи, требуя код подтверждения из Telegram при входе в систему.</p>
                             <div className="mt-4">
                                 {currentUser?.is_2fa_enabled ? (
                                    <div className="flex items-center justify-between p-3 bg-green-100 dark:bg-green-500/20 rounded-lg">
                                        <p className="text-sm font-medium text-green-800 dark:text-green-300">2FA Активна</p>
                                        <button onClick={handleDisable2FA} disabled={loading} className="text-sm font-bold text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50">
                                            {loading ? 'Отключение...' : 'Отключить'}
                                        </button>
                                    </div>
                                 ) : (
                                    <button onClick={() => setEnable2FAModalOpen(true)} className="btn-primary py-2 px-4">
                                        Включить 2FA
                                    </button>
                                 )}
                             </div>
                        </div>
                         <form onSubmit={handlePasswordChange} className="space-y-4 pt-6">
                            <h3 className="font-semibold text-slate-700 dark:text-slate-200">{t('profile.changePassword')}</h3>
                            <input type="password" value={passwordData.currentPassword} onChange={e => setPasswordData(p => ({ ...p, currentPassword: e.target.value }))} placeholder={t('profile.currentPassword')} className="w-full bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                            <input type="password" value={passwordData.newPassword} onChange={e => setPasswordData(p => ({ ...p, newPassword: e.target.value }))} placeholder={t('profile.newPassword')} className="w-full bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                            <div className="text-right">
                                <button type="submit" disabled={loading} className="btn-primary py-2 px-4">
                                    {loading ? t('common.saving') : t('profile.change')}
                                </button>
                            </div>
                         </form>
                         <div className="pt-6">
                            <h3 className="font-semibold text-slate-700 dark:text-slate-200">{t('sidebar.logout')}</h3>
                             <div className="text-right mt-4">
                                <button onClick={handleLogout} disabled={loading} className="bg-slate-500 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-slate-600 disabled:bg-slate-400/50">
                                     {loading ? t('common.deleting') : t('sidebar.logout')}
                                </button>
                            </div>
                         </div>
                         {(currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
                             <div className="pt-6">
                                <h3 className="font-semibold text-slate-700 dark:text-slate-200">{t('sidebar.adminPanel')}</h3>
                                 <div className="text-right mt-4">
                                    <button onClick={() => { onClose(); navigate('/app/admin'); }} className="btn-primary py-2 px-4">
                                         Перейти в Админ-панель
                                    </button>
                                </div>
                             </div>
                         )}
                         <div className="pt-6">
                            <h3 className="font-semibold text-red-500 dark:text-red-400">{t('profile.deleteAccount')}</h3>
                             <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('profile.deleteAccountHelp')}</p>
                             <div className="text-right mt-4">
                                <button onClick={handleDeleteAccount} disabled={loading} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-red-700 disabled:bg-red-400/50">
                                     {loading ? t('common.deleting') : t('common.delete')}
                                </button>
                            </div>
                         </div>
                    </div>
                );
            default: return null;
        }
    }

    return (
        <>
            {isEnable2FAModalOpen && <Enable2FAModal onClose={() => setEnable2FAModalOpen(false)} onSuccess={handleEnable2FASuccess} />}
            <div className="fixed inset-0 bg-black/60 z-[120] p-4 flex items-center justify-center" onClick={onClose}>
                <div 
                    ref={modalRef}
                    className="soft-panel bg-slate-50 dark:bg-slate-800 w-full flex flex-col animate-fade-in-up overflow-hidden" 
                    onClick={e => e.stopPropagation()}
                    style={{
                        transform: `translate(${transform.x}px, ${transform.y}px)`,
                        width: size.width ? `${size.width}px` : 'min(90vw, 900px)',
                        height: size.height ? `${size.height}px` : '90vh',
                        minWidth: '320px',
                        minHeight: '480px',
                    }}
                >
                    <header ref={handleRef} className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 flex-shrink-0 flex justify-between items-center cursor-move">
                        <h2 className="text-xl font-bold">{t('profile.appSettings')}</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">&times;</button>
                    </header>
                    
                     <nav className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 flex-shrink-0 flex flex-wrap items-center gap-2">
                        <TabButton tabId="privacy" label={t('profile.privacy')} />
                        <TabButton tabId="appearance" label={t('profile.appearance')} />
                        <TabButton tabId="security" label={t('profile.security')} />
                    </nav>

                    <main className="flex-1 p-6 overflow-y-auto min-h-0">
                        {renderContent()}
                    </main>

                    <footer className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 flex-shrink-0 flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">{t('common.cancel')}</button>
                        <button type="button" disabled={loading} onClick={savePrivacySettings} className="btn-primary py-2 px-6">
                            {loading ? t('common.saving') : t('common.saveChanges')}
                        </button>
                    </footer>
                </div>
            </div>
        </>
    );
};

export default SettingsModal;