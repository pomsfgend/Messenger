import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import type { ChatContact, User, Message } from '../types';
import { GLOBAL_CHAT_ID } from '../constants';
import { useI18n } from '../hooks/useI18n';
import toast from 'react-hot-toast';
import Avatar from './Avatar';
import { useSocket } from '../hooks/useSocket';
import ViewProfileModal from './ViewProfileModal';
import SettingsModal from './SettingsModal';
import SidebarContextMenu from './SidebarContextMenu';
import { FixedSizeList as List } from 'react-window';
import SidebarContact from './SidebarContact';

const notificationSoundSrc = "/assets/notification.mp3";

const ConnectionStatusIndicator: React.FC = () => {
    const { socket } = useSocket();
    const [isConnected, setIsConnected] = useState(socket?.connected || false);

    useEffect(() => {
        if (!socket) return;
        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, [socket]);

    return (
        <div className="flex items-center gap-2 px-2 pb-2 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
            <div className={`w-2 h-2 rounded-full transition-colors ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
            {isConnected ? 'Online' : 'Reconnecting...'}
        </div>
    );
};


const Sidebar: React.FC<{
    activeChatId?: string;
    onSidebarClose: () => void;
}> = ({ activeChatId, onSidebarClose }) => {
    const { currentUser, logout, updateCurrentUser } = useAuth();
    const { t } = useI18n();
    const navigate = ReactRouterDOM.useNavigate();
    const { socket } = useSocket();
    const [contacts, setContacts] = useState<ChatContact[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [viewingProfile, setViewingProfile] = useState<User | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [typingStatus, setTypingStatus] = useState<Record<string, { userId: string, timer: number }>>({});
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [isGlobalMuted, setIsGlobalMuted] = useState(() => localStorage.getItem('global_chat_muted') === 'true');
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, contact: ChatContact } | null>(null);
    const [listHeight, setListHeight] = useState(0);

    const audioRef = useRef<HTMLAudioElement>(null);
    const debounceTimer = useRef<number | null>(null);
    const processedMessageIds = useRef(new Set<string>());
    const mainRef = useRef<HTMLElement>(null);
    
    const activeChatIdRef = useRef(activeChatId);
    useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);

    const isGlobalMutedRef = useRef(isGlobalMuted);
    useEffect(() => { isGlobalMutedRef.current = isGlobalMuted; }, [isGlobalMuted]);

    const contactsRef = useRef(contacts);
    useEffect(() => { contactsRef.current = contacts; }, [contacts]);
    
    useEffect(() => {
        if (mainRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    setListHeight(entry.contentRect.height);
                }
            });
            resizeObserver.observe(mainRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'global_chat_muted') setIsGlobalMuted(e.newValue === 'true');
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const sortContacts = useCallback((a: ChatContact, b: ChatContact) => {
        if (a.id === GLOBAL_CHAT_ID) return -1;
        if (b.id === GLOBAL_CHAT_ID) return 1;
        const aTimestamp = a.lastMessageTimestamp || a.createdAt || '1970-01-01';
        const bTimestamp = b.lastMessageTimestamp || b.createdAt || '1970-01-01';
        return bTimestamp.localeCompare(aTimestamp);
    }, []);

    const fetchMyChats = useCallback(async () => {
        if (!currentUser) return;
        try {
            const [usersFromApi, onlineUsers] = await Promise.all([api.getMyChats(), api.getOnlineUsers()]);
            const unreadMap: Record<string, number> = {};
            
            const userContacts: ChatContact[] = usersFromApi.map(user => {
                const chatId = [currentUser.id, user.id].sort().join('-');
                if (user.unreadCount && user.unreadCount > 0) unreadMap[chatId] = user.unreadCount;
                return { ...user, type: 'private' };
            });
            
            setUnreadCounts(prev => ({...prev, ...unreadMap}));
            setOnlineUserIds(new Set(onlineUsers.map(u => u.id)));

            const globalChatPseudoContact: ChatContact = {
                id: GLOBAL_CHAT_ID,
                name: t('sidebar.globalChat'),
                type: 'global',
                createdAt: new Date(0).toISOString(),
                username: 'global'
            };
            
            const allContacts = [globalChatPseudoContact, ...userContacts].sort(sortContacts);
            setContacts(allContacts);
            return allContacts;
        } catch (error) { 
            toast.error(t('toast.chatLoadError'));
            return [];
        }
    }, [currentUser, t, sortContacts]);

    useEffect(() => {
        fetchMyChats();
    }, [fetchMyChats]);
    
    useEffect(() => {
        if (activeChatId && socket) {
            const privateChatId = activeChatId.includes('-') ? activeChatId.split('-').sort().join('-') : activeChatId;
            setUnreadCounts(prev => {
                if (!prev[privateChatId]) return prev;
                const newCounts = { ...prev };
                delete newCounts[privateChatId];
                return newCounts;
            });
            socket.emit('markMessagesAsRead', { chatId: activeChatId });
        }
    }, [activeChatId, socket]);

    
    useEffect(() => {
        if (!socket || !currentUser) return;

        const handlePresenceChange = (data: { userId: string, online: boolean, lastSeen: string | null, profile_color?: string, message_color?: string }) => {
            setOnlineUserIds(prev => {
                const newSet = new Set(prev);
                if (data.online) newSet.add(data.userId);
                else newSet.delete(data.userId);
                return newSet;
            });
            setContacts(prevContacts => prevContacts.map(contact => 
                contact.id === data.userId ? { ...contact, lastSeen: data.lastSeen, isOnline: data.online, profile_color: data.profile_color, message_color: data.message_color } : contact
            ));
        };
        
        const handleNewMessage = (payload: Message & { sender: User }) => {
            const { sender, ...msg } = payload;
            
            // FIX: Deduplication to prevent double notifications from server double-emit.
            if (processedMessageIds.current.has(msg.id)) return;
            processedMessageIds.current.add(msg.id);
            setTimeout(() => processedMessageIds.current.delete(msg.id), 2000);

            setContacts(prevContacts => {
                const partnerId = msg.chatId.includes('-') ? msg.chatId.split('-').find(id => id !== currentUser.id) : null;
                const contactId = msg.chatId === GLOBAL_CHAT_ID ? GLOBAL_CHAT_ID : partnerId;
                
                const updatedContacts = prevContacts.map(c => {
                    if (c.id === contactId) {
                        return {
                            ...c,
                            lastMessageContent: msg.content,
                            lastMessageSenderId: msg.senderId,
                            lastMessageTimestamp: msg.timestamp,
                            lastMessageType: msg.type,
                            lastMessageIsDeleted: msg.isDeleted ?? false,
                        };
                    }
                    return c;
                });
                return updatedContacts.sort(sortContacts);
            });
        
            const isFromSelf = msg.senderId === currentUser.id;
            const isChatActive = msg.chatId === activeChatIdRef.current;
            const isWindowFocused = document.hasFocus();
        
            if (!isFromSelf && (!isChatActive || !isWindowFocused)) {
                const contact = contactsRef.current.find(c => {
                    if (msg.chatId === GLOBAL_CHAT_ID) return c.id === GLOBAL_CHAT_ID;
                    const partnerId = msg.chatId.split('-').find(id => id !== currentUser.id);
                    return c.id === partnerId;
                });
                
                const isMuted = msg.chatId === GLOBAL_CHAT_ID ? isGlobalMutedRef.current : contact?.is_muted;
        
                if (!isMuted) {
                    audioRef.current?.play().catch(e => console.warn("Audio play failed:", e));
                    const normalizedChatId = msg.chatId.includes('-') ? msg.chatId.split('-').sort().join('-') : msg.chatId;
                    setUnreadCounts(prev => ({...prev, [normalizedChatId]: (prev[normalizedChatId] || 0) + 1 }));
                }
            }
        };

        const handleNewChatCreated = (data: { contact: ChatContact, firstMessage: Message }) => {
            const { contact, firstMessage } = data;
        
            setContacts(prev => {
                if (prev.some(c => c.id === contact.id)) return prev; // Safety check
        
                const newContactWithMsg = {
                    ...contact,
                    lastMessageContent: firstMessage.content,
                    lastMessageSenderId: firstMessage.senderId,
                    lastMessageTimestamp: firstMessage.timestamp,
                    lastMessageType: firstMessage.type,
                    lastMessageIsDeleted: firstMessage.isDeleted ?? false,
                };
                return [newContactWithMsg, ...prev].sort(sortContacts);
            });
        
            const isFromSelf = firstMessage.senderId === currentUser.id;
            if (!isFromSelf) {
                const privateChatId = firstMessage.chatId.split('-').sort().join('-');
                setUnreadCounts(prev => ({ ...prev, [privateChatId]: 1 }));
                
                const isMuted = isGlobalMutedRef.current; 
                if (!isMuted) {
                    audioRef.current?.play().catch(e => console.warn("Audio play failed:", e));
                }
            }
        };
        
        const handleProfileUpdate = (updatedUser: Partial<User>) => {
             if (updatedUser.id === currentUser.id) updateCurrentUser({ ...currentUser, ...updatedUser});
             setContacts(prev => prev.map(c => c.id === updatedUser.id ? {...c, ...updatedUser } : c));
             setViewingProfile(prev => (prev && prev.id === updatedUser.id) ? { ...prev, ...updatedUser } : prev);
        };
        
        const handleUserTyping = (data: { chatId: string, userId: string }) => {
            if (data.userId === currentUser.id) return;
            const privateChatId = data.chatId.includes('-') ? data.chatId.split('-').sort().join('-') : data.chatId;
            setTypingStatus(prev => {
                if (prev[privateChatId]) clearTimeout(prev[privateChatId].timer);
                const timer = window.setTimeout(() => setTypingStatus(current => {
                    const newStatus = { ...current };
                    delete newStatus[privateChatId];
                    return newStatus;
                }), 3000);
                return { ...prev, [privateChatId]: { userId: data.userId, timer } };
            });
        };

        const handleUserStoppedTyping = (data: { chatId: string, userId: string }) => {
            const privateChatId = data.chatId.includes('-') ? data.chatId.split('-').sort().join('-') : data.chatId;
            setTypingStatus(prev => {
                const newStatus = { ...prev };
                if (newStatus[privateChatId]?.userId === data.userId) {
                    clearTimeout(newStatus[privateChatId].timer);
                    delete newStatus[privateChatId];
                }
                return newStatus;
            });
        };

        const handleUnreadCleared = ({ chatId }: { chatId: string }) => {
            const privateChatId = chatId.includes('-') ? chatId.split('-').sort().join('-') : chatId;
            setUnreadCounts(prev => {
                if (!prev[privateChatId]) return prev;
                const newCounts = { ...prev };
                delete newCounts[privateChatId];
                return newCounts;
            });
        };
        
        const handleChatStateUpdated = (data: { chatId: string, is_muted: boolean }) => {
            setContacts(prev => prev.map(c => {
                if (c.id === GLOBAL_CHAT_ID) return c;
                const contactChatId = [currentUser!.id, c.id].sort().join('-');
                if (contactChatId === data.chatId) return { ...c, is_muted: data.is_muted };
                return c;
            }));
        };

        socket.on('user-online', (data) => handlePresenceChange({ ...data, online: true }));
        socket.on('user-offline', (data) => handlePresenceChange({ ...data, online: false }));
        socket.on('newMessage', handleNewMessage);
        socket.on('newChatCreated', handleNewChatCreated);
        socket.on('userProfileUpdated', handleProfileUpdate);
        socket.on('messageDeleted', fetchMyChats);
        socket.on('messagesDeleted', fetchMyChats);
        socket.on('user-is-typing', handleUserTyping);
        socket.on('user-stopped-typing', handleUserStoppedTyping);
        socket.on('unreadCountCleared', handleUnreadCleared);
        socket.on('chatStateUpdated', handleChatStateUpdated);

        return () => {
            socket.off('user-online');
            socket.off('user-offline');
            socket.off('newMessage');
            socket.off('newChatCreated');
            socket.off('userProfileUpdated');
            socket.off('messageDeleted');
            socket.off('messagesDeleted');
            socket.off('user-is-typing');
            socket.off('user-stopped-typing');
            socket.off('unreadCountCleared');
            socket.off('chatStateUpdated');
        };
    }, [socket, currentUser, fetchMyChats, sortContacts, updateCurrentUser, t]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSearchTerm(term);
        setIsSearching(!!term);

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (!term) {
            setSearchResults([]);
            return;
        }

        debounceTimer.current = window.setTimeout(async () => {
            try {
                const results = await api.searchUsers(term);
                setSearchResults(results);
            } catch (error) {
                console.error("Search failed:", error);
            }
        }, 300);
    };

    const handleContactClick = (contact: ChatContact | User) => {
        if (!currentUser) return;
        setSearchTerm('');
        setIsSearching(false);
        const chatId = contact.id === GLOBAL_CHAT_ID ? GLOBAL_CHAT_ID : [currentUser.id, contact.id].sort().join('-');
        navigate(`/app/chat/${chatId}`);
        onSidebarClose();
    };
    
    const handleContextMenu = (e: React.MouseEvent, contact: ChatContact) => {
        e.preventDefault();
        if (contact.id === GLOBAL_CHAT_ID) return;
        setContextMenu({ x: e.clientX, y: e.clientY, contact });
    };

    const displayList = isSearching ? searchResults : contacts;

    return (
        <div className="bg-slate-100 dark:bg-slate-900 h-full flex flex-col p-3" style={{backgroundColor: 'rgb(var(--color-bg-primary))'}}>
            {viewingProfile && <ViewProfileModal user={viewingProfile} onClose={() => setViewingProfile(null)} onStartChat={(userId) => { setViewingProfile(null); navigate(`/app/chat/${[currentUser!.id, userId].sort().join('-')}`)}} />}
            {isSettingsModalOpen && <SettingsModal onClose={() => setIsSettingsModalOpen(false)} />}
            {contextMenu && <SidebarContextMenu x={contextMenu.x} y={contextMenu.y} contact={contextMenu.contact} onClose={() => setContextMenu(null)} />}
            <audio ref={audioRef} src={notificationSoundSrc} preload="auto" />

            <header className="flex-shrink-0 p-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => currentUser && setViewingProfile(currentUser)}>
                        <Avatar user={currentUser || {}} />
                        <span className="font-semibold text-sm truncate">{currentUser?.name}</span>
                    </div>
                    <div className="flex items-center">
                        <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title={t('sidebar.settings')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                </div>
                <div className="relative mt-4 flex-shrink-0">
                    <input type="text" placeholder={t('sidebar.searchPlaceholder')} value={searchTerm} onChange={handleSearch} className="w-full bg-slate-200/80 dark:bg-slate-800/80 border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"/>
                </div>
            </header>
            
            <ConnectionStatusIndicator />

            <main ref={mainRef} className="flex-1 overflow-y-auto min-h-0">
                {isSearching ? (
                    <ul>
                    {displayList.map(contact => (
                        <SidebarContact
                            key={contact.id}
                            index={-1} // Not needed for non-virtualized
                            style={{}}   // Not needed
                            data={{
                                contacts: displayList as ChatContact[],
                                activeChatId: '',
                                unreadCounts: {},
                                typingStatus: {},
                                isGlobalMuted: false,
                                onlineUserIds,
                                currentUser,
                                handleContactClick,
                                handleContextMenu,
                            }}
                         />
                    ))}
                    </ul>
                ) : (
                    <List
                        height={listHeight}
                        itemCount={contacts.length}
                        itemSize={68} // h-10 (40px) + p-3 (1.5rem=24px) = 64px. 68px for spacing.
                        width="100%"
                        itemData={{
                            contacts,
                            activeChatId,
                            unreadCounts,
                            typingStatus,
                            isGlobalMuted,
                            onlineUserIds,
                            currentUser,
                            handleContactClick,
                            handleContextMenu,
                        }}
                    >
                        {SidebarContact}
                    </List>
                )}
            </main>
        </div>
    );
};

export default Sidebar;