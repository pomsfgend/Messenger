
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { useI18n } from '../hooks/useI18n';
import Avatar from '../components/Avatar';

const ProfilePage: React.FC = () => {
    const { currentUser, logout, updateCurrentUser } = useAuth();
    const navigate = useNavigate();
    const { t } = useI18n();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<Partial<User>>({
        name: currentUser?.name || '',
        uniqueId: currentUser?.uniqueId || '',
        gender: currentUser?.gender || 'prefer_not_to_say',
        dob: currentUser?.dob ? currentUser.dob.split('T')[0] : '',
        avatarUrl: currentUser?.avatarUrl || '',
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (currentUser?.avatarUrl) {
            // Use a cache-busting query to ensure the latest avatar is shown
            setAvatarPreview(`/api/media/${currentUser.avatarUrl}?v=${Date.now()}`);
        }
    }, [currentUser?.avatarUrl]);

    if (!currentUser) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAvatarClick = () => fileInputRef.current?.click();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
            setFormData(prev => ({ ...prev, avatarUrl: '' }));
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleSubmit = async (e: React.FormEvent) => {
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
            // This is the crucial fix: directly update the user state.
            updateCurrentUser(updatedUser);
            toast.success(t('toast.profileUpdateSuccess'));
            setAvatarFile(null); // Clear the file after successful upload
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('toast.profileUpdateError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-slate-800 rounded-2xl shadow-lg p-8 space-y-8 animate-fade-in">
                <div>
                    <h1 className="text-3xl font-bold text-white">{t('profile.title')}</h1>
                    <p className="text-slate-400 mt-1">{t('profile.subtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/png, image/jpeg, image/gif"
                                className="hidden"
                            />
                            <div 
                                className="w-24 h-24 rounded-full bg-slate-700 cursor-pointer flex items-center justify-center overflow-hidden group"
                                onClick={handleAvatarClick}
                            >
                                <Avatar user={{...currentUser, avatarUrl: avatarPreview || currentUser.avatarUrl }} forcePreview={!!avatarPreview} />
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    Change Avatar
                                </div>
                            </div>
                        </div>
                        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">{t('profile.displayName')}</label>
                                <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                            </div>
                            <div>
                                <label htmlFor="uniqueId" className="block text-sm font-medium text-slate-300 mb-2">{t('profile.uniqueId')}</label>
                                <input type="text" name="uniqueId" id="uniqueId" value={formData.uniqueId} onChange={handleChange} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="gender" className="block text-sm font-medium text-slate-300 mb-2">{t('profile.gender')}</label>
                            <select name="gender" id="gender" value={formData.gender} onChange={handleChange} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition">
                                <option value="prefer_not_to_say">{t('profile.gender.pnts')}</option>
                                <option value="male">{t('profile.gender.male')}</option>
                                <option value="female">{t('profile.gender.female')}</option>
                                <option value="other">{t('profile.gender.other')}</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="dob" className="block text-sm font-medium text-slate-300 mb-2">{t('profile.dob')}</label>
                            <input type="date" name="dob" id="dob" value={formData.dob} onChange={handleChange} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <button type="button" onClick={() => navigate('/')} className="w-full sm:w-auto flex-grow justify-center text-center bg-slate-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-700 transition-colors duration-300">
                            {t('profile.backToChat')}
                        </button>
                        <button type="submit" disabled={loading} className="w-full sm:w-auto flex-grow justify-center text-center bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors duration-300">
                            {loading ? t('profile.saving') : t('profile.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfilePage;
