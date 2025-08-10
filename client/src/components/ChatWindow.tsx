import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import type { Message, User, MessageType, ReactionMap, ChatContact } from '../types';
import toast from 'react-hot-toast';
import { useI18n } from '../hooks/useI18n';
import { useSocket } from '../hooks/useSocket';
import { GLOBAL_CHAT_ID } from '../constants';
import Avatar from './Avatar';
import ViewProfileModal from './ViewProfileModal';
import MediaUploadPreviewModal from './MediaUploadPreviewModal';
import MessageContextMenu, { Action } from './MessageContextMenu';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM;
import MediaViewerModal from './MediaViewerModal';
import useAutosizeTextArea from '../hooks/useAutosizeTextArea';
import GlobalChatInfoModal from './GlobalChatInfoModal';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from './ConfirmationModal';
import MessageBubble from './MessageBubble';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { useTheme } from '../hooks/useTheme';
import VideoRecorderModal from './VideoRecorderModal';
import { FaVideo, FaMicrophone, FaEllipsisV, FaBell, FaBellSlash, FaSmile } from 'react-icons/fa';
import { useCall } from '../hooks/useCall';
import IncomingCallToast from './IncomingCallToast';
import { isMobile } from 'react-device-detect';
import ForwardMessageModal from './ForwardMessageModal';


const AudioRecorder: React.FC<{ onSend: (file: File) => void; onCancel: () => void; }> = ({ onSend, onCancel }) => {
    const { t } = useI18n();
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingIntervalRef = useRef<number | null>(null);
    const isCancelledRef = useRef(false);

    const cleanup = useCallback(() => {
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try { mediaRecorderRef.current.stop(); } catch(e) {}
        }
    }, []);
    
    useEffect(() => {
        let isMounted = true;
        isCancelledRef.current = false;
        
        const startRecording = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (!isMounted) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = stream;
                
                const options = { mimeType: 'audio/webm;codecs=opus' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    toast.error(t('toast.unsupportedFileType'));
                    onCancel(); return;
                }

                mediaRecorderRef.current = new MediaRecorder(stream, options);
                const chunks: BlobPart[] = [];
                mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
                mediaRecorderRef.current.onstop = () => {
                     streamRef.current?.getTracks().forEach(track => track.stop());
                     if (isCancelledRef.current) {
                         onCancel(); return;
                     }
                     const blob = new Blob(chunks, { type: options.mimeType });
                     if (blob.size > 256) {
                         const file = new File([blob], `voice-${Date.now()}.webm`, { type: options.mimeType });
                         onSend(file);
                     } else {
                         toast.error(t('toast.emptyFileError'));
                         onCancel();
                     }
                };
                mediaRecorderRef.current.start();
                setRecordingTime(0);
                recordingIntervalRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
            } catch (err) {
                toast.error(t('toast.micDenied'));
                onCancel();
            }
        };
        startRecording();
        return () => { isMounted = false; cleanup(); };
    }, [onSend, onCancel, t, cleanup]);

    const handleSend = () => {
        isCancelledRef.current = false;
        cleanup();
    };

    const handleCancel = () => {
        isCancelledRef.current = true;
        cleanup();
    };


    return (
        <div className="w-full flex items-center justify-between px-4 animate-fade-in">
            <button onClick={handleCancel} className="p-3 text-red-500 rounded-full hover:bg-red-500/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            </button>
            <div className="flex items-center gap-2 text-red-500">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-mono">{new Date(recordingTime * 1000).toISOString().substr(14, 5)}</span>
            </div>
            <button onClick={handleSend} className="w-12 h-12 flex items-center justify-center bg-indigo-500 rounded-full text-white flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            </button>
        </div>
    );
};

const formatLastSeen = (lastSeen: string | null | undefined, t: (key: string, options?: any) => string): string => {
    if (lastSeen === 'recent') return t('chat.lastSeenRecent');
    if (!lastSeen) return t('chat.online');
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffSeconds = Math.round((now.getTime() - lastSeenDate.getTime()) / 1000);

    if (diffSeconds < 60) return t('time.justNow');
    if (diffSeconds < 3600) return t('time.minutesAgo', { count: Math.floor(diffSeconds / 60) });
    if (diffSeconds < 86400) return t('time.hoursAgo', { count: Math.floor(diffSeconds / 3600) });
    
    return `${t('chat.lastSeen')} ${lastSeenDate.toLocaleString()}`;
};


const ChatWindow: React.FC<{
  chatId?: string;
  onToggleSidebar: () => void;
  isStandalone?: boolean;
}> = ({ chatId, onToggleSidebar, isStandalone = false }) => {
    const { currentUser } = useAuth();
    const { socket } = useSocket();
    const { t } = useI18n();
    const { mode } = useTheme();
    const navigate = useNavigate();

    const [messages, setMessages] = useState<Message[]>([]);
    const [chatUsers, setChatUsers] = useState<Record<string, User>>({});
    const [partner, setPartner] = useState<ChatContact | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [hasMore, setHasMore] = useState(true);
    
    const isFetchingMoreRef = useRef(false);
    const scrollStateRef = useRef({ shouldPreserve: false, oldScrollHeight: 0 });
    const wasAtBottomRef = useRef(true);
    
    const [viewingProfile, setViewingProfile] = useState<User | null>(null);
    const [isChatInfoModalOpen, setIsChatInfoModalOpen] = useState(false);
    
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const typingTimeoutRef = useRef<number | null>(null);
    
    const [mediaPreview, setMediaPreview] = useState<{ file: File; type: MessageType } | null>(null);
    const [isRecordingVideo, setIsRecordingVideo] = useState(false);
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<Record<string, { progress: number; cancel: () => void; }>>({});

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, message: Message } | null>(null);
    const [mediaViewerState, setMediaViewerState] = useState<{ items: Message[], startIndex: number } | null>(null);
    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
    
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [isReacting, setIsReacting] = useState<string | null>(null);
    
    const [isMuted, setIsMuted] = useState(false);
    const [temporarilyDeleted, setTemporarilyDeleted] = useState<Set<string>>(new Set());
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const chatMenuRef = useRef<HTMLDivElement>(null);

    const hasScrolledInitially = useRef(false);
    useAutosizeTextArea(textAreaRef.current, newMessage);
    
    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const call = useCall({ localVideoRef, remoteVideoRef, chatId: chatId || null });
    
    useEffect(() => {
        if (call.incomingCall) {
            IncomingCallToast({
                caller: call.incomingCall.caller,
                onAccept: call.acceptCall,
                onReject: call.rejectCall,
            });
        }
    }, [call.incomingCall, call.acceptCall, call.rejectCall]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
            if (isChatMenuOpen && chatMenuRef.current && !chatMenuRef.current.contains(event.target as Node)) {
                setIsChatMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPicker, isChatMenuOpen]);
    
    const resetState = useCallback(() => {
        setMessages([]);
        setChatUsers({});
        setPartner(null);
        setIsLoading(true);
        setError(null);
        setNewMessage('');
        setHasMore(true);
        setTypingUsers(new Set());
        setSelectionMode(false);
        setSelectedMessages(new Set());
        setEditingMessage(null);
        hasScrolledInitially.current = false;
        wasAtBottomRef.current = true;
    }, []);

    const fetchMessages = useCallback(async (isInitial = false) => {
        if (!chatId || (!isInitial && isFetchingMoreRef.current)) return;
        
        isFetchingMoreRef.current = true;
        if (isInitial) setIsLoading(true);
        
        try {
            const currentMessages = messagesRef.current;
            const before = isInitial || currentMessages.length === 0 ? undefined : currentMessages[0].timestamp;
            const { messages: newMessages, users, hasMore: newHasMore } = await api.getMessages(chatId, 50, before);
            
            setChatUsers(prev => ({ ...prev, ...users }));
            setMessages(prev => isInitial ? newMessages : [...newMessages, ...prev]);
            setHasMore(newHasMore);
            
            if (isInitial) {
                if (chatId === GLOBAL_CHAT_ID) {
                    setIsMuted(localStorage.getItem('global_chat_muted') === 'true');
                    setPartner(null); // Explicitly clear partner for global chat
                } else {
                    const partnerId = chatId.split('-').find(id => id !== currentUser!.id);
                    if (partnerId && users[partnerId]) {
                        const partnerData = users[partnerId] as ChatContact;
                        // Fetch the full contact list to get the mute status
                        const myChats = await api.getMyChats();
                        const chatContact = myChats.find(c => c.id === partnerId);
                        setIsMuted(chatContact?.is_muted ?? false);
                        // Ensure partner state is set correctly even if name is missing
                        setPartner({
                            ...partnerData,
                            name: partnerData.name || partnerData.uniqueId || 'User',
                            isOnline: !partnerData.lastSeen
                        });
                    } else if (partnerId) {
                        // Handle case where user might not be in the initial fetch (e.g., new chat)
                        const profile = await api.getProfileByUniqueId(partnerId);
                        setChatUsers(prev => ({ ...prev, [profile.id]: profile }));
                        setPartner({
                           ...profile,
                           name: profile.name || profile.uniqueId || 'User',
                           isOnline: !profile.lastSeen,
                           type: 'private'
                        });
                    }
                }
            }
        } catch (e) {
            setError(t('chat.loadError'));
        } finally {
            if (isInitial) setIsLoading(false);
            isFetchingMoreRef.current = false;
        }
    }, [chatId, currentUser, t]);
    
    useEffect(() => {
        resetState();
        fetchMessages(true);
    }, [chatId, fetchMessages, resetState]);

    const handleScroll = useCallback(() => {
        const container = chatContainerRef.current;
        if (container) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            wasAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;

            if (scrollTop < 50 && hasMore && !isFetchingMoreRef.current) {
                scrollStateRef.current = {
                    shouldPreserve: true,
                    oldScrollHeight: scrollHeight
                };
                fetchMessages(false);
            }
        }
    }, [hasMore, fetchMessages]);
    
    useLayoutEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;

        if (scrollStateRef.current.shouldPreserve) {
            container.scrollTop += (container.scrollHeight - scrollStateRef.current.oldScrollHeight);
            scrollStateRef.current.shouldPreserve = false;
        } else if (wasAtBottomRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: hasScrolledInitially.current ? 'smooth' : 'auto' });
        }
        
        if (!hasScrolledInitially.current && messages.length > 0) {
            hasScrolledInitially.current = true;
        }
    }, [messages]);

    useEffect(() => {
        if (socket && chatId) {
            socket.emit('viewingChat', { chatId });
            return () => {
                socket.emit('stopViewingChat', { chatId });
            };
        }
    }, [socket, chatId]);

    useEffect(() => {
        if (!socket || !chatId) return;

        socket.emit('joinRoom', chatId);
        
        const handleNewMessage = (payload: Message & { sender?: User }) => {
            const { sender, ...msg } = payload;
            if (msg.chatId === chatId) {
                const container = chatContainerRef.current;
                if(container) {
                    const { scrollTop, scrollHeight, clientHeight } = container;
                    wasAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
                } else {
                    wasAtBottomRef.current = true;
                }

                if (sender) {
                     setChatUsers(prev => prev[sender.id] ? prev : { ...prev, [sender.id]: sender });
                }

                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id || (m.tempId && m.tempId === msg.tempId))) {
                        return prev.map(m => m.tempId === msg.tempId ? msg : m);
                    }
                    return [...prev, msg];
                });
                if (document.visibilityState === 'visible' && msg.senderId !== currentUser?.id) { 
                    socket.emit('markMessagesAsRead', { chatId });
                }
            }
        };

        const handleMessageEdited = (msg: { id: string, chatId: string, content: string, isEdited: boolean }) => {
            if (msg.chatId === chatId) {
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content, isEdited: true } : m));
            }
        };
        
        const handleMessageReactionUpdated = (data: { messageId: string; reactions: ReactionMap; chatId: string }) => {
            if (data.chatId === chatId) {
                setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
            }
        };
        const handleMessagesDeleted = (data: { messageIds: string[]; chatId: string; }) => {
            if (data.chatId === chatId) {
                setMessages(prev => prev.filter(m => !data.messageIds.includes(m.id)));
            }
        };
        
        const handleMessageDeleted = (data: { id: string, chatId: string }) => {
            if (data.chatId === chatId) {
                setTemporarilyDeleted(prev => new Set(prev).add(data.id));
                setTimeout(() => {
                    setMessages(prev => prev.filter(m => m.id !== data.id));
                    setTemporarilyDeleted(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(data.id);
                        return newSet;
                    });
                }, 5000);
            }
        };
        
        const handleUserTyping = (data: { chatId: string, userId: string }) => {
            if (data.chatId === chatId && data.userId !== currentUser?.id) {
                setTypingUsers(prev => new Set(prev).add(data.userId));
            }
        };

        const handleUserStoppedTyping = (data: { chatId: string, userId: string }) => {
            if (data.chatId === chatId) {
                setTypingUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(data.userId);
                    return newSet;
                });
            }
        };
        
        const handleMessagesRead = (data: { messageIds: string[], chatId: string, readerId: string }) => {
            if (data.chatId === chatId) {
                setMessages(prev => prev.map(m => {
                    if (data.messageIds.includes(m.id)) {
                        const readBy = new Set(m.readBy || []);
                        readBy.add(data.readerId);
                        return { ...m, readBy: Array.from(readBy) };
                    }
                    return m;
                }));
            }
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('messageEdited', handleMessageEdited);
        socket.on('messageReactionUpdated', handleMessageReactionUpdated);
        socket.on('messageDeleted', handleMessageDeleted);
        socket.on('messagesDeleted', handleMessagesDeleted);
        socket.on('user-is-typing', handleUserTyping);
        socket.on('user-stopped-typing', handleUserStoppedTyping);
        socket.on('messagesRead', handleMessagesRead);
        
        socket.on('chatStateUpdated', (data: { chatId: string, is_muted: boolean }) => {
            if (data.chatId === chatId) {
                setIsMuted(data.is_muted);
            }
        });

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('messageEdited', handleMessageEdited);
            socket.off('messageReactionUpdated', handleMessageReactionUpdated);
            socket.off('messageDeleted', handleMessageDeleted);
            socket.off('messagesDeleted', handleMessagesDeleted);
            socket.off('user-is-typing', handleUserTyping);
            socket.off('user-stopped-typing', handleUserStoppedTyping);
            socket.off('messagesRead', handleMessagesRead);
            socket.off('chatStateUpdated');
        };
    }, [socket, chatId, currentUser]);

    const handleSendMessage = useCallback((content: string, type: MessageType = 'text', mediaUrl?: string, mediaMimetype?: string) => {
        if (!chatId || !currentUser || (!content.trim() && !mediaUrl)) {
            return;
        }

        const tempId = `temp_${Date.now()}`;
        const tempMessage: Message = {
            id: tempId, tempId, chatId, senderId: currentUser.id,
            content: content.trim(), timestamp: new Date().toISOString(),
            type, mediaUrl, mediaMimetype, isEdited: false, isDeleted: false,
        };
        
        wasAtBottomRef.current = true;
        setMessages(prev => [...prev, tempMessage]);
        socket?.emit('sendMessage', tempMessage);

        if (type === 'text') {
            setNewMessage('');
            if (textAreaRef.current) {
                textAreaRef.current.style.height = 'auto';
            }
        }
    }, [chatId, currentUser, socket]);

    const handleSendFile = useCallback((file: File, caption: string, typeOverride?: MessageType) => {
        if (!chatId) return;
        const tempId = `temp_${Date.now()}`;

        const formData = new FormData();
        formData.append('mediaFile', file);
        const { promise, cancel } = api.uploadChatFile(formData, (progress) => {
            setUploadingFiles(prev => ({ ...prev, [tempId]: { ...prev[tempId], progress } }));
        });
        
        setUploadingFiles(prev => ({ ...prev, [tempId]: { progress: 0, cancel } }));
        
        const tempMessage: Message = {
            id: tempId, tempId, chatId, senderId: currentUser!.id,
            content: caption || file.name, timestamp: new Date().toISOString(),
            type: typeOverride || (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file'),
            mediaUrl: URL.createObjectURL(file), 
            mediaMimetype: file.type, isEdited: false, isDeleted: false,
        };

        wasAtBottomRef.current = true;
        setMessages(prev => [...prev, tempMessage]);

        promise.then(({ mediaUrl, type }) => {
            handleSendMessage(caption || file.name, tempMessage.type, mediaUrl, type);
        }).catch(err => {
            if (err.message !== 'Upload was cancelled') {
                toast.error(t('toast.uploadError'));
                setMessages(prev => prev.filter(m => m.tempId !== tempId));
            }
        }).finally(() => {
            setUploadingFiles(prev => {
                const newUploading = { ...prev };
                if (newUploading[tempId] && tempMessage.mediaUrl?.startsWith('blob:')) {
                     URL.revokeObjectURL(tempMessage.mediaUrl);
                }
                delete newUploading[tempId];
                return newUploading;
            });
        });

    }, [chatId, currentUser, handleSendMessage, t]);
    
    const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewMessage(e.target.value);
        if (socket && chatId && !typingTimeoutRef.current) {
            socket.emit('start-typing', { chatId });
            typingTimeoutRef.current = window.setTimeout(() => {
                socket.emit('stop-typing', { chatId });
                typingTimeoutRef.current = null;
            }, 3000);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
            e.preventDefault();
            if (editingMessage) handleSaveEdit();
            else handleSendMessage(newMessage);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setMediaPreview({ file, type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file' });
        e.target.value = ''; 
    };

    const handleSaveEdit = async () => {
        if (!editingMessage || !newMessage.trim()) return;
        try {
            await api.editMessage(editingMessage.id, { content: newMessage.trim() });
            setEditingMessage(null);
            setNewMessage('');
        } catch {
            toast.error(t('toast.editError'));
        }
    };
    
    const handleToggleMute = async () => {
        const newMutedState = !isMuted;
        try {
            if (chatId === GLOBAL_CHAT_ID) {
                localStorage.setItem('global_chat_muted', String(newMutedState));
                // Manually dispatch a storage event to notify other tabs
                window.dispatchEvent(new StorageEvent('storage', { key: 'global_chat_muted', newValue: String(newMutedState) }));
                setIsMuted(newMutedState);
            } else if (partner) {
                await api.updateChatState(chatId!, { is_muted: newMutedState });
                setIsMuted(newMutedState);
            }
            toast.success(newMutedState ? t('chat.mute') : t('chat.unmute'));
        } catch {
            toast.error('Failed to update mute status');
        }
        setIsChatMenuOpen(false);
    };

    const onContextMenuAction = (action: Action) => {
        action.action();
        setContextMenu(null);
    };

    const getContextMenuActions = (message: Message): (Action | false | undefined)[] => [
        { label: t('chat.react'), action: () => setIsReacting(message.id) },
        { label: t('chat.forward'), action: () => setForwardingMessage(message) },
        message.senderId === currentUser?.id && { label: t('common.edit'), action: () => {
            setEditingMessage(message);
            setNewMessage(message.content);
            textAreaRef.current?.focus();
        }},
        (message.senderId === currentUser?.id || ['admin', 'moderator'].includes(currentUser?.role || '')) && {
            label: t('common.delete'),
            isDestructive: true,
            action: async () => {
                try {
                    await api.deleteMessage(message.id);
                } catch {
                    toast.error(t('toast.deleteMessageError'));
                }
            }
        }
    ];

    const renderChatContent = () => {
        if (isLoading) return <div className="flex-1 flex justify-center items-center"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div></div>;
        if (error) return <div className="flex-1 flex justify-center items-center text-red-500">{error}</div>;
        
        return (
            <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        message={msg}
                        isOwn={msg.senderId === currentUser?.id}
                        sender={chatUsers[msg.senderId]}
                        isPrivateChat={chatId !== GLOBAL_CHAT_ID}
                        uploadProgress={uploadingFiles[msg.tempId!]?.progress}
                        onCancelUpload={() => uploadingFiles[msg.tempId!]?.cancel()}
                        onViewProfile={setViewingProfile}
                        onContextMenu={(e, m) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, message: m }); }}
                        onMediaClick={(m) => {
                            const mediaItems = messages.filter(i => i.type === 'image' || i.type === 'video' || i.type === 'video_circle');
                            const startIndex = mediaItems.findIndex(i => i.id === m.id);
                            if(startIndex > -1) setMediaViewerState({ items: mediaItems, startIndex });
                        }}
                        onToggleSelect={console.log}
                        selectionMode={selectionMode}
                        isSelected={selectedMessages.has(msg.id)}
                        isReacting={isReacting === msg.id}
                        onReactionHandled={() => setIsReacting(null)}
                        isTemporarilyDeleted={temporarilyDeleted.has(msg.id)}
                    />
                ))}
                <div ref={messagesEndRef} className="h-1" />
            </div>
        );
    };

    return (
        <div className="flex flex-col h-[var(--app-height)] bg-slate-100 dark:bg-slate-900 min-w-0">
            {viewingProfile && <ViewProfileModal user={viewingProfile} onClose={() => setViewingProfile(null)} onStartChat={(userId) => { setViewingProfile(null); navigate(`/app/chat/${[currentUser!.id, userId].sort().join('-')}`)}} />}
            {mediaPreview && <MediaUploadPreviewModal item={mediaPreview} onClose={() => setMediaPreview(null)} onSend={handleSendFile} />}
            {isDeleteConfirmOpen && <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={()=>{}} title="Delete Messages" message={`Are you sure you want to delete ${selectedMessages.size} messages?`} />}
            {contextMenu && <MessageContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} actions={getContextMenuActions(contextMenu.message)} />}
            {mediaViewerState && <MediaViewerModal items={mediaViewerState.items} startIndex={mediaViewerState.startIndex} onClose={() => setMediaViewerState(null)} />}
            {forwardingMessage && <ForwardMessageModal messageToForward={forwardingMessage} sender={chatUsers[forwardingMessage.senderId]} onClose={() => setForwardingMessage(null)} />}
            {isRecordingVideo && <VideoRecorderModal onClose={() => setIsRecordingVideo(false)} onSend={(file) => handleSendFile(file, '', 'video_circle')} />}
            {isChatInfoModalOpen && <GlobalChatInfoModal onClose={() => setIsChatInfoModalOpen(false)} />}
            
            <header className="flex-shrink-0 flex items-center justify-between p-3 border-b border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-3 min-w-0">
                    {!isStandalone && <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg></button>}
                    
                    {chatId !== GLOBAL_CHAT_ID && partner ? (
                        <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => setViewingProfile(partner)}>
                            <Avatar user={{...partner, isOnline: !partner.lastSeen}} />
                            <div className="min-w-0">
                                <p className="font-semibold truncate">{partner.name || partner.uniqueId}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{Array.from(typingUsers).length > 0 ? t('chat.typing') : formatLastSeen(partner.lastSeen, t)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIsChatInfoModalOpen(true)}>
                            <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
                            <p className="font-semibold">{t('sidebar.globalChat')}</p>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 relative">
                    {partner && <button onClick={() => call.startCall(partner)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><FaVideo/></button>}
                    <div ref={chatMenuRef} className="relative">
                         <button onClick={() => setIsChatMenuOpen(p => !p)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"><FaEllipsisV/></button>
                         {isChatMenuOpen && (
                             <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-700 rounded-lg shadow-xl z-20 py-1">
                                 <button onClick={handleToggleMute} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">
                                     {isMuted ? <FaBell/> : <FaBellSlash/>}
                                     <span>{isMuted ? t('chat.unmute') : t('chat.mute')}</span>
                                 </button>
                             </div>
                         )}
                    </div>
                </div>
            </header>

            {renderChatContent()}

            <footer className="flex-shrink-0 p-3 border-t border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                <AnimatePresence>
                {isRecordingAudio ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                        <AudioRecorder onSend={(file) => handleSendFile(file, '', 'audio')} onCancel={() => setIsRecordingAudio(false)} />
                    </motion.div>
                ) : (
                     <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                        
                        <div className="relative flex-1">
                            <textarea
                                ref={textAreaRef}
                                value={newMessage}
                                onChange={handleTyping}
                                onKeyDown={handleKeyDown}
                                placeholder={t('chat.typeMessage')}
                                className="w-full bg-slate-200 dark:bg-slate-700 border-2 border-transparent rounded-2xl p-3 pr-12 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors resize-none"
                                rows={1}
                            />
                             <button 
                                onClick={(e) => { e.preventDefault(); setShowEmojiPicker(p => !p); }} 
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400"
                             >
                                <FaSmile className="w-5 h-5"/>
                             </button>
                             {showEmojiPicker && (
                                <div ref={emojiPickerRef} className="absolute bottom-full left-0 sm:right-0 sm:left-auto mb-2 z-50">
                                   <EmojiPicker 
                                      onEmojiClick={(e) => setNewMessage(p => p + e.emoji)} 
                                      theme={mode === 'dark' ? Theme.DARK : Theme.LIGHT}
                                      searchDisabled={true}
                                   />
                                </div>
                            )}
                        </div>
                        
                        {newMessage.trim() ? (
                             <button onClick={() => handleSendMessage(newMessage)} className="w-12 h-12 flex items-center justify-center bg-indigo-500 rounded-full text-white flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg></button>
                        ) : (
                            <>
                            <button onClick={() => setIsRecordingVideo(true)} className="w-12 h-12 flex items-center justify-center bg-cyan-500 rounded-full text-white flex-shrink-0"><FaVideo/></button>
                            <button onClick={() => setIsRecordingAudio(true)} className="w-12 h-12 flex items-center justify-center bg-rose-500 rounded-full text-white flex-shrink-0"><FaMicrophone/></button>
                            </>
                        )}
                    </motion.div>
                )}
                </AnimatePresence>
            </footer>
        </div>
    );
};

export default ChatWindow;