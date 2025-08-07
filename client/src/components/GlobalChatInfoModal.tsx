import React, { useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import * as api from '../services/api';
import SharedMediaViewer from './SharedMediaViewer';
import { useI18n } from '../hooks/useI18n';
import Avatar from './Avatar';
import { GLOBAL_CHAT_ID } from '../constants';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

interface GlobalChatInfoModalProps {
    onClose: () => void;
}

const GlobalChatInfoModal: React.FC<GlobalChatInfoModalProps> = ({ onClose }) => {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('participants');
    const [onlineUsers, setOnlineUsers] = useState<Pick<User, 'id' | 'name' | 'avatarUrl' | 'uniqueId'>[]>([]);
    const [loading, setLoading] = useState(true);

    const modalRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const modalId = 'global-chat-info';
    const { transform } = useDraggable(modalRef, handleRef, modalId);
    const { size } = useResizable(modalRef, modalId);

    useEffect(() => {
        const fetchOnline = async () => {
            try {
                const users = await api.getOnlineUsers();
                setOnlineUsers(users);
            } catch {
                // handle error silently
            } finally {
                setLoading(false);
            }
        };
        if (activeTab === 'participants') {
            fetchOnline();
        }
    }, [activeTab]);

    const TabButton: React.FC<{tabId: string, label: string}> = ({ tabId, label }) => (
        <button 
            onClick={() => setActiveTab(tabId)} 
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === tabId ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
        >
            {label}
        </button>
    );

    const renderContent = () => {
        if (activeTab === 'participants') {
            if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div></div>;
            return (
                 <div className="space-y-2 overflow-y-auto pr-2">
                    {onlineUsers.map(user => (
                        <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-100 dark:bg-slate-700/50">
                             <Avatar user={user} size="small" />
                             <div>
                                 <p className="font-semibold text-sm">{user.name}</p>
                                 <p className="text-xs text-slate-500 dark:text-slate-400">@{user.uniqueId}</p>
                             </div>
                        </div>
                    ))}
                </div>
            );
        }
        if (activeTab === 'media') {
            return <SharedMediaViewer chatId={GLOBAL_CHAT_ID} />;
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4" onClick={onClose}>
            <div 
                ref={modalRef}
                className="soft-panel bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col animate-fade-in-up" 
                onClick={e => e.stopPropagation()}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px)`,
                    width: size.width ? `${size.width}px` : 'min(90vw, 512px)',
                    height: size.height ? `${size.height}px` : '70vh',
                    minWidth: '320px',
                }}
            >
                <div ref={handleRef} className="flex items-start justify-between mb-4 flex-shrink-0 cursor-move">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('sidebar.globalChat')}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('globalChat.participantsOnline', { count: onlineUsers.length })}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-2xl font-light leading-none hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">&times;</button>
                </div>
                 <div className="flex bg-slate-100 dark:bg-slate-900/50 rounded-lg p-1 space-x-1 mb-4 flex-shrink-0">
                    <TabButton tabId="participants" label={t('globalChat.participants')} />
                    <TabButton tabId="media" label={t('profile.sharedMedia')} />
                </div>
                 <div className="flex-1 min-h-0">
                    {renderContent()}
                </div>
            </div>
        </div>
    )
};

export default GlobalChatInfoModal;