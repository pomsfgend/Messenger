
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import type { ChatContact } from '../types';
import { GLOBAL_CHAT_ID } from '../constants';
import { useI18n } from '../hooks/useI18n';
import toast from 'react-hot-toast';
import LanguageSwitcher from './LanguageSwitcher';
import Avatar from './Avatar';

const Sidebar: React.FC<{ activeChatId?: string }> = ({ activeChatId }) => {
    const { currentUser, logout } = useAuth();
    const { t } = useI18n();
    const navigate = useNavigate();
    const [contacts, setContacts] = useState<ChatContact[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchMyChats = async () => {
            if (!currentUser) return;
            try {
                // This is the new API call for the real messenger experience
                const usersFromApi = await api.getMyChats();

                const userContacts: ChatContact[] = usersFromApi.map(user => ({
                    id: user.id,
                    name: user.name || user.username,
                    type: 'private',
                    avatarUrl: user.avatarUrl
                }));

                // Always include the Global Chat
                const allContactsList: ChatContact[] = [
                    { id: GLOBAL_CHAT_ID, name: t('sidebar.globalChat'), type: 'global', avatarUrl: '/favicon.svg' },
                    ...userContacts
                ];
                setContacts(allContactsList);
            } catch (error) {
                toast.error("Failed to load your chats.");
            }
        };

        fetchMyChats();
    }, [currentUser, activeChatId, t]); // Re-fetch when activeChatId changes to see new chats immediately

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;
        try {
            const user = await api.getUserByUniqueId(searchTerm.trim());
            if (user && user.id !== currentUser?.id) {
                // Navigate to chat, a message needs to be sent for it to appear in the list
                navigate(`/chat/${user.id}`);
                setSearchTerm('');
            } else if (user?.id === currentUser?.id) {
                 toast.error("You can't chat with yourself!");
            } else {
                toast.error(t('sidebar.userNotFound'));
            }
        } catch (error) {
             toast.error(t('sidebar.userNotFound'));
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="w-80 flex-shrink-0 bg-slate-900/70 backdrop-blur-sm flex flex-col border-r border-slate-700/50">
            {/* Header */}
            <div className="h-16 flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-700/50">
                <div className="flex items-center gap-3 cursor-pointer overflow-hidden" onClick={() => navigate('/profile')}>
                    <Avatar user={currentUser || {}} size="small" />
                    <span className="font-semibold text-white truncate">{currentUser?.name}</span>
                </div>
                <div className="flex items-center gap-1">
                     <LanguageSwitcher />
                    <button title={t('sidebar.logout')} onClick={handleLogout} className="p-2 rounded-full hover:bg-slate-700 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg>
                    </button>
                </div>
            </div>
            {/* Search */}
            <div className="p-4 border-b border-slate-700/50">
                <form onSubmit={handleSearch}>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('sidebar.searchPlaceholder')}
                            className="w-full bg-slate-800 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                </form>
            </div>
            {/* Contact List */}
            <div className="flex-1 overflow-y-auto">
                <ul className="p-2">
                    {contacts.map(contact => (
                        <li key={contact.id}>
                            <div
                                onClick={() => navigate(`/chat/${contact.id}`)}
                                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${activeChatId === contact.id ? 'bg-indigo-600/50' : 'hover:bg-slate-700/50'}`}
                            >
                                <Avatar user={contact} />
                                <div className="flex-1 overflow-hidden">
                                    <h3 className="font-semibold text-sm text-slate-100 truncate">{contact.name}</h3>
                                    <p className="text-xs text-slate-400 truncate">
                                        {contact.type === 'global' ? t('sidebar.globalChatDesc') : t('sidebar.dm')}
                                    </p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default Sidebar;
