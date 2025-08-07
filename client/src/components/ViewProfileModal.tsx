import React, { useState, useMemo, useRef } from 'react';
import type { User } from '../types';
import { useI18n } from '../hooks/useI18n';
import Avatar from './Avatar';
import { useAuth } from '../hooks/useAuth';
import EditProfileModal from './EditProfileModal';
import SharedMediaViewer from './SharedMediaViewer';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

interface ViewProfileModalProps {
    user: User;
    onClose: () => void;
    onStartChat: (userId: string) => void;
}

const InfoRow: React.FC<{ label: string, value: string | undefined | null }> = ({ label, value }) => {
    if (!value) return null;
    return (
        <div className="text-left">
            <p className="text-sm text-slate-700 dark:text-slate-200">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        </div>
    )
}

const ViewProfileModal: React.FC<ViewProfileModalProps> = ({ user, onClose, onStartChat }) => {
    const { t } = useI18n();
    const { currentUser, refreshSession } = useAuth();
    const isSelf = user.id === currentUser?.id;
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const modalRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const modalId = `view-profile-${user.id}`;
    const { transform } = useDraggable(modalRef, handleRef, modalId);
    const { size } = useResizable(modalRef, modalId);
    
    const privateChatId = isSelf ? null : [currentUser!.id, user.id].sort().join('-');
    
    const handleEditSuccess = async () => {
        setIsEditModalOpen(false);
        await refreshSession(); // Refresh currentUser data after edit
        onClose(); // Close the main profile view after successful edit
    }
    
    const userProfileColor = user.profile_color || 'rgb(var(--color-accent-primary))';
    
    const emojiBackground = useMemo(() => {
        if (!user.profile_emoji) return {};
        try {
            const density = user.profile_emoji_density ?? 50; // Default density
            const rotation = user.profile_emoji_rotation ?? 0; // Default rotation
            const tileSize = 20 + (100 - density); // Map density (1-100) to tile size (120px to 20px)

            const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 100 100">
                    <text x="50%" y="50%" font-size="40" dominant-baseline="middle" text-anchor="middle"
                    transform="rotate(${rotation} 50 50)"
                    >${user.profile_emoji}</text>
                </svg>`;
            const encodedSvg = btoa(unescape(encodeURIComponent(svgContent)));

            return { 
                backgroundImage: `url("data:image/svg+xml;base64,${encodedSvg}")`,
                backgroundSize: `${tileSize}px ${tileSize}px`,
                opacity: 0.1,
            };
        } catch (error) {
            console.error("Failed to generate emoji background:", error);
            return {};
        }
    }, [user.profile_emoji, user.profile_emoji_density, user.profile_emoji_rotation]);

    // This handles the modal replacement logic.
    if (isEditModalOpen && currentUser) {
        return <EditProfileModal user={currentUser} onClose={() => setIsEditModalOpen(false)} onSuccess={handleEditSuccess} />;
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4" onClick={onClose}>
            <div 
                ref={modalRef}
                className="soft-panel relative bg-slate-50 dark:bg-slate-800 flex flex-col animate-fade-in-up overflow-hidden" 
                onClick={e => e.stopPropagation()}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px)`,
                    width: size.width ? `${size.width}px` : 'min(90vw, 384px)', // max-w-sm
                    height: size.height ? `${size.height}px` : 'min(90vh, 720px)',
                    minWidth: '320px',
                    minHeight: '400px',
                }}
            >
                 <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <header 
                    ref={handleRef}
                    className="h-28 rounded-t-2xl flex flex-col items-center justify-end relative p-4 transition-colors duration-500 flex-shrink-0 overflow-hidden cursor-move"
                    style={{ backgroundColor: userProfileColor }}
                >
                     <div className="absolute inset-0" style={emojiBackground}></div>
                     <div className="absolute -bottom-12">
                        <Avatar user={user} size="large" />
                     </div>
                </header>
                
                <div className="flex-grow overflow-y-auto min-h-0">
                    <div className="pt-16 pb-2 px-6 text-center flex-shrink-0">
                         <h1 className="text-2xl font-bold text-slate-800 dark:text-white truncate">{user.name}</h1>
                         <p className="text-slate-500 dark:text-slate-400 truncate">@{user.uniqueId}</p>
                         {user.description && <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 text-center">{user.description}</p>}
                    </div>

                     <div className="px-6 space-y-3 flex-shrink-0">
                        <InfoRow label={t('profile.dob')} value={user.dob ? new Date(user.dob).toLocaleDateString() : null} />
                        <InfoRow label={t('profile.phoneNumber')} value={user.phoneNumber} />
                        <InfoRow label={t('profile.telegramId')} value={user.telegramId} />
                    </div>
                    
                    {!isSelf && privateChatId && (
                         <div className="flex-grow flex flex-col min-h-0 px-6 pb-6 mt-4">
                             <div className="border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                                 <h3 className="text-sm font-bold pt-4 text-slate-600 dark:text-slate-300">{t('profile.sharedMedia')}</h3>
                             </div>
                             <div className="flex-grow min-h-0 pt-2">
                                <SharedMediaViewer chatId={privateChatId} />
                             </div>
                        </div>
                     )}
                </div>

                <footer className="p-6 flex-shrink-0 border-t border-slate-200 dark:border-slate-700 mt-auto">
                    {isSelf ? (
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="w-full text-center bg-slate-200 dark:bg-slate-700 font-bold py-3 px-6 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-300"
                        >
                           {t('profile.editProfile')}
                        </button>
                    ) : (
                        <button 
                            onClick={() => onStartChat(user.id)} 
                            className="w-full text-center py-3 px-6 transition-colors duration-300 btn-primary"
                        >
                            {t('profile.sendMessage')}
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default ViewProfileModal;