import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import type { ChatContact, Message, User } from '../types';
import { GLOBAL_CHAT_ID } from '../constants';
import Avatar from './Avatar';
import MessageBubble from './MessageBubble';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

interface ForwardMessageModalProps {
    messageToForward: Message;
    sender?: User;
    onClose: () => void;
}

const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({ messageToForward, sender, onClose }) => {
    const { t } = useI18n();
    const { currentUser } = useAuth();
    const [contacts, setContacts] = useState<ChatContact[]>([]);
    const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [hideSender, setHideSender] = useState(false);

    const modalRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLHeadingElement>(null);
    const modalId = 'forward-message';
    const { transform } = useDraggable(modalRef, handleRef, modalId);
    const { size } = useResizable(modalRef, modalId);

    useEffect(() => {
        const fetchChats = async () => {
            try {
                const chats = await api.getMyChats();
                const globalChat: ChatContact = {
                    id: GLOBAL_CHAT_ID,
                    name: t('sidebar.globalChat'),
                    type: 'global',
                    isOnline: true,
                    createdAt: new Date(0).toISOString(),
                    username: 'global'
                };
                setContacts([globalChat, ...chats]);
            } catch (e) {
                toast.error(t('toast.chatLoadError'));
            }
        };
        fetchChats();
    }, [t]);

    const handleToggleChat = (contact: ChatContact) => {
        if (!currentUser) return;
        const chatId = contact.id === GLOBAL_CHAT_ID ? GLOBAL_CHAT_ID : [currentUser.id, contact.id].sort().join('-');
        
        setSelectedChats(prev => {
            const newSet = new Set(prev);
            if (newSet.has(chatId)) {
                newSet.delete(chatId);
            } else {
                newSet.add(chatId);
            }
            return newSet;
        });
    };

    const handleForward = async () => {
        if (selectedChats.size === 0) return;
        setLoading(true);
        try {
            await api.forwardMessage(messageToForward.id, Array.from(selectedChats), hideSender);
            toast.success(t('toast.forwardSuccess'));
            onClose();
        } catch (error) {
            toast.error(t('toast.forwardError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-4 pointer-events-none" onClick={onClose}>
            <motion.div 
                ref={modalRef}
                className="soft-panel bg-slate-50 dark:bg-slate-800 w-full max-w-md p-6 space-y-4 flex flex-col pointer-events-auto" 
                onClick={e => e.stopPropagation()}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px)`,
                    width: size.width ? `${size.width}px` : 'min(90vw, 512px)',
                    height: size.height ? `${size.height}px` : 'min(90vh, 700px)',
                    minWidth: '320px',
                }}
            >
                <h2 ref={handleRef} className="text-xl font-bold text-slate-800 dark:text-white flex-shrink-0 cursor-move">{t('chat.forwardTo')}</h2>
                
                <div className="border border-slate-300/50 dark:border-slate-700/50 p-3 rounded-lg flex-shrink-0">
                    <div className="max-h-32 overflow-y-auto pr-2 scale-90 origin-top-left">
                        <MessageBubble
                            message={messageToForward}
                            isOwn={false}
                            sender={sender}
                            onViewProfile={() => {}}
                            onContextMenu={() => {}}
                            onMenuClick={() => {}}
                            onMediaClick={() => {}}
                            onToggleSelect={() => {}}
                            selectionMode={false}
                            isSelected={false}
                            isReacting={false}
                            onReactionHandled={() => {}}
                            isTemporarilyDeleted={false}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 min-h-0">
                    {contacts.map(contact => {
                        const chatId = contact.id === GLOBAL_CHAT_ID ? GLOBAL_CHAT_ID : [currentUser!.id, contact.id].sort().join('-');
                        return (
                        <div key={contact.id} onClick={() => handleToggleChat(contact)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/20 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                            <div className="w-5 h-5 rounded-md border-2 border-slate-400 dark:border-slate-500 flex items-center justify-center flex-shrink-0">
                                {selectedChats.has(chatId) && (
                                    <div className="w-3 h-3 bg-[rgb(var(--color-accent-primary))] rounded-sm"></div>
                                )}
                            </div>
                            <Avatar user={contact} />
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{contact.name}</span>
                        </div>
                    )})}
                </div>

                <div className="flex items-center gap-3 px-2 py-2 flex-shrink-0">
                    <input type="checkbox" id="hideSenderCheck" checked={hideSender} onChange={e => setHideSender(e.target.checked)} className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500" />
                    <label htmlFor="hideSenderCheck" className="text-sm text-slate-700 dark:text-slate-200 cursor-pointer">{t('chat.hideSenderName')}</label>
                </div>
                
                <div className="flex justify-end gap-4 pt-4 border-t border-slate-300/50 dark:border-slate-700/50 flex-shrink-0">
                    <button onClick={onClose} className="bg-slate-200/50 dark:bg-slate-600/50 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-300/50 dark:hover:bg-slate-500/50 transition-colors">{t('common.cancel')}</button>
                    <button onClick={handleForward} disabled={loading || selectedChats.size === 0} className="btn-primary py-2 px-6">{loading ? t('chat.forwarding') : t('chat.forward')}</button>
                </div>
            </motion.div>
        </div>
    );
};

export default ForwardMessageModal;