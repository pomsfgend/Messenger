import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import type { AvatarData, User } from '../types';
import { useI18n } from '../hooks/useI18n';
import ImageCropper from './ImageCropper';
import { Area } from 'react-easy-crop';
import ColorPicker from './ColorPicker';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { useTheme as useAppTheme } from '../hooks/useTheme';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

interface EditProfileModalProps {
    user: User;
    onClose: () => void;
    onSuccess: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, onClose, onSuccess }) => {
    const { t } = useI18n();
    const { mode } = useAppTheme();
    const [formData, setFormData] = useState({
        name: user.name || '',
        uniqueId: user.uniqueId || '',
        dob: user.dob || '',
        phoneNumber: user.phoneNumber || '', // Use camelCase
        telegramId: user.telegramId || '', // Use camelCase
        description: user.description || '',
        profile_emoji: user.profile_emoji || '',
        emojiDensity: user.profile_emoji_density || 50,
        emojiRotation: user.profile_emoji_rotation || 0,
        profile_color: user.profile_color,
        message_color: user.message_color
    });
    const [avatars, setAvatars] = useState<AvatarData[]>([]);
    const [loading, setLoading] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLFormElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const modalId = 'edit-profile';
    const { transform } = useDraggable(modalRef, handleRef, modalId);
    const { size } = useResizable(modalRef, modalId);

    const fetchAvatars = useCallback(async () => {
        try {
            const myAvatars = await api.getMyAvatars();
            setAvatars(myAvatars);
        } catch (error) {
            toast.error(t('toast.avatarsLoadError'));
        }
    }, [t]);

    useEffect(() => {
        fetchAvatars();
    }, [fetchAvatars]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPicker]);

    const handleFormChange = (field: keyof typeof formData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type.startsWith('video/')) {
            // Handle video upload directly, bypassing the cropper
            const videoFormData = new FormData();
            videoFormData.append('avatarFile', file);
            
            setLoading(true);
            api.uploadAvatar(videoFormData)
                .then(async () => {
                    toast.success(t('toast.avatarUploadSuccess'));
                    await fetchAvatars();
                    onSuccess();
                })
                .catch(() => toast.error(t('toast.uploadError')))
                .finally(() => setLoading(false));

        } else if (file.type.startsWith('image/')) {
            // Handle image cropping as before
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageToCrop(reader.result as string);
            });
            reader.readAsDataURL(file);
        } else {
            toast.error("Unsupported file type. Please select an image or a video.");
        }
        
        e.target.value = ''; // Reset file input
    };
    
    const handleCropComplete = async (croppedAreaPixels: Area) => {
        if (!imageToCrop) return;
        
        // This is a bit of a trick to convert the base64 string back to a File-like object
        const response = await fetch(imageToCrop);
        const blob = await response.blob();
        
        const formData = new FormData();
        formData.append('avatarFile', blob);
        formData.append('crop', JSON.stringify(croppedAreaPixels));

        try {
            setLoading(true);
            await api.uploadAvatar(formData);
            toast.success(t('toast.avatarUploadSuccess'));
            await fetchAvatars(); // Refresh avatar list
            onSuccess(); // This will refresh the currentUser in the main app
        } catch (error) {
            toast.error(t('toast.uploadError'));
        } finally {
            setLoading(false);
            setImageToCrop(null);
        }
    };
    
    const handleSetPrimary = async (avatarId: string) => {
        try {
            await api.setPrimaryAvatar(avatarId);
            toast.success(t('toast.primaryAvatarSuccess'));
            onSuccess();
        } catch (error) {
            toast.error(t('toast.primaryAvatarError'));
        }
    };
    
    const handleDeleteAvatar = async (avatarId: string) => {
        if(window.confirm(t('profile.deleteAvatarConfirm'))) {
            try {
                await api.deleteAvatar(avatarId);
                toast.success(t('toast.avatarDeleteSuccess'));
                await fetchAvatars();
                onSuccess();
            } catch (error) {
                 toast.error(t('toast.avatarDeleteError'));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.updateUser(formData);
            toast.success(t('toast.profileUpdateSuccess'));
            onSuccess();
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('toast.profileUpdateError'));
        } finally {
            setLoading(false);
        }
    };
    
    const handleEmojiSelect = (emoji: EmojiClickData) => {
        handleFormChange('profile_emoji', emoji.emoji);
        setShowEmojiPicker(false);
    };

    const inputClasses = "w-full bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none";

    return (
        <>
        {imageToCrop && <ImageCropper imageSrc={imageToCrop} onClose={() => setImageToCrop(null)} onCropComplete={handleCropComplete} />}
        <div className="fixed inset-0 bg-black/60 z-[120] p-4 flex items-center justify-center" onClick={onClose}>
            <form 
                ref={modalRef}
                onSubmit={handleSubmit} 
                className="soft-panel bg-slate-50 dark:bg-slate-800 w-full max-w-2xl h-[90vh] max-h-[800px] flex flex-col animate-fade-in-up overflow-hidden" 
                onClick={e => e.stopPropagation()}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px)`,
                    width: size.width ? `${size.width}px` : 'min(90vw, 672px)',
                    height: size.height ? `${size.height}px` : 'min(90vh, 800px)',
                    minWidth: '320px',
                }}
            >
                <div ref={handleRef} className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 flex-shrink-0 flex justify-between items-center cursor-move">
                    <h2 className="text-xl font-bold">{t('profile.editProfile')}</h2>
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">&times;</button>
                </div>
                
                <main className="flex-1 p-6 space-y-6 overflow-y-auto">
                    {/* AVATAR GALLERY */}
                    <div>
                        <h3 className="font-semibold mb-2 text-slate-700 dark:text-slate-300">{t('profile.profilePicture')}</h3>
                         <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/mp4,video/webm" />
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                             <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-slate-200 dark:bg-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                <span className="text-xs mt-1">{t('profile.uploadNew')}</span>
                            </button>
                            {avatars.map(avatar => (
                                <div key={avatar.id} className="relative aspect-square group">
                                    <img src={`/api/media/${avatar.filename}`} alt="User avatar" className="w-full h-full object-cover rounded-lg" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                                         <button type="button" onClick={() => handleSetPrimary(avatar.id)} className="text-white text-xs bg-indigo-600/80 px-2 py-1 rounded w-full hover:bg-indigo-500/80">{t('profile.setPrimary')}</button>
                                         <button type="button" onClick={() => handleDeleteAvatar(avatar.id)} className="text-white text-xs bg-red-600/80 px-2 py-1 rounded w-full hover:bg-red-500/80">{t('common.delete')}</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PERSONAL INFO */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">{t('profile.displayName')}</label>
                            <input type="text" value={formData.name} onChange={e => handleFormChange('name', e.target.value)} className={inputClasses}/>
                        </div>
                         <div>
                            <label className="text-sm font-medium">{t('profile.uniqueId')}</label>
                            <input type="text" value={formData.uniqueId} onChange={e => handleFormChange('uniqueId', e.target.value)} className={inputClasses}/>
                        </div>
                        <div>
                            <label className="text-sm font-medium">{t('profile.dob')}</label>
                            <input type="date" value={formData.dob} onChange={e => handleFormChange('dob', e.target.value)} className={inputClasses}/>
                        </div>
                         <div>
                            <label className="text-sm font-medium">{t('profile.phoneNumber')}</label>
                            <input type="tel" value={formData.phoneNumber} onChange={e => handleFormChange('phoneNumber', e.target.value)} className={inputClasses}/>
                        </div>
                        <div>
                            <label className="text-sm font-medium">{t('profile.telegramId')}</label>
                            <input type="text" value={formData.telegramId} onChange={e => handleFormChange('telegramId', e.target.value)} className={inputClasses}/>
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium">{t('profile.description')}</label>
                        <textarea value={formData.description} onChange={e => handleFormChange('description', e.target.value)} placeholder={t('profile.descriptionPlaceholder')} rows={3} className={`${inputClasses} resize-none`}></textarea>
                    </div>

                    {/* PROFILE CUSTOMIZATION */}
                    <div>
                         <h3 className="font-semibold mb-2 text-slate-700 dark:text-slate-300">{t('profile.profileColors')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">{t('profile.profileBannerColor')}</label>
                                <ColorPicker selectedColor={formData.profile_color} onColorSelect={c => handleFormChange('profile_color', c)} />
                            </div>
                             <div>
                                <label className="text-sm font-medium">{t('profile.messageBubbleColor')}</label>
                                <ColorPicker selectedColor={formData.message_color} onColorSelect={c => handleFormChange('message_color', c)} />
                            </div>
                        </div>
                    </div>
                     <div>
                        <h3 className="font-semibold mb-2 text-slate-700 dark:text-slate-300">{t('profile.profileEmoji')}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('profile.profileEmojiHelp')}</p>
                        <div className="relative">
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setShowEmojiPicker(p => !p)} className="text-4xl p-2 rounded-lg bg-slate-200 dark:bg-slate-700/50">{formData.profile_emoji || '?'}</button>
                                <div className="flex-grow space-y-1">
                                     <input type="range" min="1" max="100" value={formData.emojiDensity} onChange={e => handleFormChange('emojiDensity', e.target.value)} className="w-full" />
                                     <input type="range" min="-180" max="180" value={formData.emojiRotation} onChange={e => handleFormChange('emojiRotation', e.target.value)} className="w-full" />
                                </div>
                            </div>
                             {showEmojiPicker && (
                                <div ref={emojiPickerRef} className="absolute bottom-full left-0 mb-2 z-50" onClick={e => e.stopPropagation()}>
                                   <EmojiPicker onEmojiClick={handleEmojiSelect} theme={mode === 'dark' ? Theme.DARK : Theme.LIGHT} />
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                <footer className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 flex-shrink-0 flex justify-end gap-4">
                    <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">{t('common.cancel')}</button>
                    <button type="submit" disabled={loading} className="btn-primary py-2 px-6">
                        {loading ? t('common.saving') : t('common.saveChanges')}
                    </button>
                </footer>
            </form>
        </div>
        </>
    );
};

export default EditProfileModal;