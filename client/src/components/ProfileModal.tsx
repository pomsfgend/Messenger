
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { useI18n } from '../hooks/useI18n';
import Avatar from '../components/Avatar';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';

interface ProfileModalProps {
    onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
    const { currentUser, logout, updateCurrentUser, refreshSession } = useAuth();
    const navigate = useNavigate();
    const { t } = useI18n();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<Partial<User>>({
        name: '', uniqueId: '', gender: 'prefer_not_to_say', dob: '',
        phone_number: '', telegram_id: '',
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        if (currentUser) {
            setFormData({
                name: currentUser.name || '',
                uniqueId: currentUser.uniqueId || '',
                gender: currentUser.gender || 'prefer_not_to_say',
                dob: currentUser.dob ? currentUser.dob.split('T')[0] : '',
                phone_number: currentUser.phone_number || '',
                telegram_id: currentUser.telegram_id || '',
            });
            setAvatarPreview(null);
        }
    }, [currentUser]);

    if (!currentUser) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleLogout = async () => {
        await logout();
        onClose();
        navigate('/login');
    };
    
    const handleDeleteAccount = async () => {
        if (window.confirm(t('profile.deleteConfirm'))) {
            setDeleteLoading(true);
            try {
                await api.deleteMyAccount();
                toast.success(t('toast.deleteSuccess'));
                await logout();
                onClose();
                navigate('/login');
            } catch (error) {
                toast.error(error instanceof Error ? error.message : t('toast.deleteError'));
            } finally {
                setDeleteLoading(false);
            }
        }
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const submissionData = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                submissionData.append(key, value as string);
            }
        });
        if (avatarFile) {
            submissionData.append('avatarFile', avatarFile);
        }

        try {
            const updatedUser = await api.updateUser(submissionData);
            updateCurrentUser(updatedUser);
            toast.success(t('toast.profileUpdateSuccess'));
            setAvatarFile(null);
            setAvatarPreview(null);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('toast.profileUpdateError'));
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) return toast.error(t('register.passwordsDoNotMatch'));
        if (!currentPassword || !newPassword) return toast.error(t('register.allFieldsRequired'));

        setPasswordLoading(true);
        try {
            const result = await api.changePassword(currentPassword, newPassword);
            toast.success(result.message);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('toast.passwordChangeError'));
        } finally {
            setPasswordLoading(false);
        }
    }

    const inputClasses = "w-full bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-800 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition";
    const selectClasses = `${inputClasses} appearance-none`;
    const displayAvatarUrl = avatarPreview || currentUser.avatarUrl;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 font-sans" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('profile.title')}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-2xl leading-none">&times;</button>
                </header>

                <main className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <aside className="lg:col-span-1 space-y-6">
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 flex flex-col items-center text-center">
                            <div className="relative mb-4">
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden"/>
                                <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 cursor-pointer flex items-center justify-center overflow-hidden group ring-4 ring-white dark:ring-gray-800" onClick={() => fileInputRef.current?.click()}>
                                    <Avatar user={{...currentUser, avatarUrl: displayAvatarUrl}} size="large" />
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">{t('profile.change')}</div>
                                </div>
                            </div>
                            <h1 className="text-xl font-bold text-gray-800 dark:text-white truncate">{formData.name}</h1>
                            <p className="text-gray-500 dark:text-gray-400">@{formData.uniqueId}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 space-y-2">
                             <h3 className="font-bold text-gray-800 dark:text-white px-2 mb-2">{t('profile.appSettings')}</h3>
                             <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700/50">
                                <label className="font-medium text-gray-600 dark:text-gray-300">{t('profile.language')}</label>
                                <LanguageSwitcher />
                             </div>
                             <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700/50">
                                <label className="font-medium text-gray-600 dark:text-gray-300">{t('profile.theme')}</label>
                                <ThemeSwitcher />
                             </div>
                        </div>
                    </aside>

                    <div className="lg:col-span-2 space-y-8">
                        <form onSubmit={handleProfileSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.displayName')}</label><input type="text" name="name" value={formData.name || ''} onChange={handleChange} className={inputClasses} /></div>
                                <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.uniqueId')}</label><input type="text" name="uniqueId" value={formData.uniqueId || ''} onChange={handleChange} className={inputClasses} /></div>
                                <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.dob')}</label><input type="date" name="dob" value={formData.dob || ''} onChange={handleChange} className={inputClasses} /></div>
                                <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.gender')}</label><select name="gender" value={formData.gender} onChange={handleChange} className={selectClasses}>
                                        <option value="prefer_not_to_say">{t('profile.genderPreferNotToSay')}</option><option value="male">{t('profile.genderMale')}</option><option value="female">{t('profile.genderFemale')}</option><option value="other">{t('profile.genderOther')}</option>
                                    </select></div>
                                <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.phoneNumber')}</label><input type="tel" name="phone_number" value={formData.phone_number || ''} onChange={handleChange} className={inputClasses} placeholder="+1234567890" /></div>
                                <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t('profile.telegramId')}</label><input type="text" name="telegram_id" value={formData.telegram_id || ''} onChange={handleChange} className={inputClasses} placeholder="123456789"/></div>
                            </div>
                            <div className="flex justify-end"><button type="submit" disabled={loading} className="w-full sm:w-auto justify-center text-center bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-primary-hover disabled:bg-primary/50 transition-colors">{loading ? t('common.saving') : t('common.saveChanges')}</button></div>
                        </form>

                        {!currentUser.is_anonymous && !currentUser.google_id && (
                        <form onSubmit={handlePasswordSubmit} className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('profile.changePassword')}</h3>
                             <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder={t('profile.currentPassword')} className={inputClasses} />
                             <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('profile.newPassword')} className={inputClasses} />
                             <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder={t('register.confirmPassword')} className={inputClasses} />
                            <div className="flex justify-end"><button type="submit" disabled={passwordLoading} className="w-full sm:w-auto bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-primary-hover disabled:bg-primary/50 transition-colors">{passwordLoading ? t('common.saving') : t('profile.change')}</button></div>
                        </form>
                        )}
                        
                        {!currentUser.is_anonymous && (
                         <div className="border-t border-red-500/30 pt-6 space-y-4">
                            <div>
                                <h3 className="text-lg font-bold text-red-500 dark:text-red-400">{t('profile.deleteAccount')}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('profile.deleteAccountHelp')}</p>
                            </div>
                            <div className="flex justify-end"><button onClick={handleDeleteAccount} disabled={deleteLoading} className="w-full sm:w-auto bg-red-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-red-700 disabled:bg-red-400/50 transition-colors">{deleteLoading ? t('common.deleting') : t('common.delete')}</button></div>
                        </div>
                        )}

                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                             <button onClick={handleLogout} className="w-full sm:w-auto bg-gray-500 dark:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-600 dark:hover:bg-gray-700">{t('profile.logout')}</button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ProfileModal;
