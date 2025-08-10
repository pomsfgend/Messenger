import React, { memo } from 'react';
import type { ChatContact, User } from '../types';
import { useI18n } from '../hooks/useI18n';
import Avatar from './Avatar';

// Define the structure of itemData passed from the List
export interface SidebarContactData {
    contacts: ChatContact[];
    activeChatId?: string;
    unreadCounts: Record<string, number>;
    typingStatus: Record<string, { userId: string; timer: number }>;
    isGlobalMuted: boolean;
    currentUser: User | null | undefined;
    handleContactClick: (contact: ChatContact) => void;
    handleContextMenu: (e: React.MouseEvent, contact: ChatContact) => void;
}

interface SidebarContactProps {
    index: number;
    style: React.CSSProperties;
    data: SidebarContactData;
}

const SidebarContact: React.FC<SidebarContactProps> = ({ index, style, data }) => {
    const {
        contacts, activeChatId, unreadCounts, typingStatus, isGlobalMuted, 
        currentUser, handleContactClick, handleContextMenu
    } = data;
    
    const contact = contacts[index];
    const { t } = useI18n();
    const GLOBAL_CHAT_ID = 'global';

    const privateChatId = (contact.id !== GLOBAL_CHAT_ID && currentUser) ? [currentUser.id, contact.id].sort().join('-') : GLOBAL_CHAT_ID;
    const isActive = activeChatId === privateChatId;
    const unreadCount = contact.unreadCount || unreadCounts[privateChatId] || 0;
    const isTyping = !!typingStatus[privateChatId];
    const isMuted = privateChatId === GLOBAL_CHAT_ID ? isGlobalMuted : contact.is_muted || false;
    
    const renderLastMessage = () => {
        if (isTyping) {
            return <span className="text-[rgb(var(--color-accent-primary))] italic">{t('chat.typing')}</span>;
        }
        if (contact.lastMessageIsDeleted) {
            return <span className="italic">{t('sidebar.lastMessageDeleted')}</span>;
        }
        if (contact.lastMessageContent || (contact.lastMessageType && contact.lastMessageType !== 'text')) {
            const prefix = contact.lastMessageSenderId === currentUser?.id ? `${t('chat.you')}: ` : '';
            if (contact.lastMessageType && contact.lastMessageType !== 'text') {
                 const key = `messageType.${contact.lastMessageType}` as any;
                 return `${prefix}[${t(key, {fileName: contact.lastMessageContent})}]`;
            }
            // Ensure content is treated as a string to avoid rendering '0' or 'false'
            const content = String(contact.lastMessageContent);
            return `${prefix}${content}`;
        }
        return contact.id === GLOBAL_CHAT_ID ? t('sidebar.globalChatDesc') : t('sidebar.dm');
    };

    return (
        <li 
            style={style}
            onClick={() => handleContactClick(contact)}
            onContextMenu={(e) => handleContextMenu(e, contact)}
            // The list item itself has padding, so we adjust the li style to fill the space
            className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors duration-200 mx-1 ${isActive ? 'bg-slate-200/80 dark:bg-slate-700/80' : 'hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
        >
            <Avatar user={contact} />
            <div className="flex-1 ml-3 min-w-0">
                <p className="font-semibold text-sm truncate">{contact.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{renderLastMessage()}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
                {unreadCount > 0 && !isMuted && (
                    <div className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                )}
                {isMuted && (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0L19.414 6.27a1 1 0 010 1.414L16.07 11.03a1 1 0 01-1.414-1.414l2.657-2.657-2.657-2.657a1 1 0 010-1.414zm-2.828 0a1 1 0 011.414 1.414L10.586 7a1 1 0 01-1.414-1.414L11.828 2.93z" clipRule="evenodd" /></svg>
                )}
            </div>
        </li>
    );
};

export default memo(SidebarContact);
