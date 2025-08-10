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
import MediaViewerModal from './MediaViewerModal';
import useAutosizeTextArea from '../hooks/useAutosizeTextArea';
import GlobalChatInfoModal from './GlobalChatInfoModal';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from './ConfirmationModal';
import MessageBubble from './MessageBubble';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { useTheme } from '../hooks/useTheme';
import VideoRecorderModal from './VideoRecorderModal';
import { processVideoCircleForDownload } from '../utils/mediaProcessor';
import { FaVideo, FaMicrophone, FaMicrophoneSlash, FaVideoSlash, FaPhoneSlash } from 'react-icons/fa';
import { useCall } from '../hooks/useCall';
import IncomingCallToast from './IncomingCallToast';
import { isMobile } from 'react-device-detect';


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
    // FIX: Correctly handle 'recent' status from server privacy filter
    if (lastSeen === 'recent') return t('chat.lastSeenRecent');
    if (!lastSeen) return t('chat.online');
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffSeconds = Math.round((now.getTime() - lastSeenDate.getTime()) / 1000);

    if (diffSeconds < 60) return t('time.justNow');
    if (diffSeconds < 3600) return t('time.minutesAgo', { count: Math.floor(diffSeconds / 60) });
    if (diffSeconds < 86400) return t('time.hoursAgo', { count: Math.floor(diffSeconds / 3600) });
    
    // For dates older than a day, show date and time
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
    const navigate = ReactRouterDOM.useNavigate();

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
    
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
    const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [isReacting, setIsReacting] = useState<string | null>(null);
    
    const [isMuted, setIsMuted] = useState(false);
    const [temporarilyDeleted, setTemporarilyDeleted] = useState<Set<string>>(new Set());
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const hasScrolledInitially = useRef(false);
    useAutosizeTextArea(textAreaRef.current, newMessage);
    
    const messagesRef = useRef(messages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const call = useCall({
        localVideoRef,
        remoteVideoRef,
        chatId: chatId || null
    });
    
    useEffect(() => {
        if (call.incomingCall) {
            IncomingCallToast({
                caller: call.incomingCall.caller,
                onAccept: call.acceptCall,
                onReject: call.rejectCall,
            });
        }
    }, [call.incomingCall, call.acceptCall, call.rejectCall]);


    
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
                const partnerId = chatId !== GLOBAL_CHAT_ID ? chatId.split('-').find(id => id !== currentUser!.id) : undefined;
                if (partnerId && users[partnerId]) {
                    const partnerData = users[partnerId] as ChatContact;
                     const myChats = await api.getMyChats();
                     const chatContact = myChats.find(c => c.id === partnerId);
                     setIsMuted(chatContact?.is_muted ?? false);

                    setPartner({ ...partnerData, isOnline: !partnerData.lastSeen });
                } else if (chatId === GLOBAL_CHAT_ID) {
                    setIsMuted(localStorage.getItem('global_chat_muted') === 'true');
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
    
    // Reworked scroll logic into a single robust effect
    useLayoutEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;

        if (scrollStateRef.current.shouldPreserve) {
            // This is for loading older messages, preserve position
            container.scrollTop += (container.scrollHeight - scrollStateRef.current.oldScrollHeight);
            scrollStateRef.current.shouldPreserve = false;
        } else if (wasAtBottomRef.current) {
            // This is for initial load or new messages when user was at the bottom
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

                // FIX: If the sender's data isn't in chatUsers, add it.
                // This prevents the UI from breaking when a new user (e.g., via Telegram reply) messages.
                if (sender) {
                     setChatUsers(prev => prev[sender.id] ? prev : { ...prev, [sender.id]: sender });
                }

                setMessages(prev => {
                    // This is the de-duplication logic.
                    if (prev.some(m => m.id === msg.id || (m.tempId && m.tempId === msg.tempId))) {
                        // If we find a temp message, replace it with the real one from the server.
                        return prev.map(m => m.tempId === msg.tempId ? msg : m);
                    }
                    return [...prev, msg];
                });
                 // CRITICAL FIX: Mark as read immediately if window is focused
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
        
        const handleMessageReactionUpdated = (data: { messageId: string, reactions: ReactionMap }) => {
            setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
        };

        const handleDelete = (data: { id?: string; messageIds?: string[] }) => {
            const idsToDelete = new Set(data.messageIds || (data.id ? [data.id] : []));
            if (idsToDelete.size === 0) return;

            idsToDelete.forEach(id => {
                setTemporarilyDeleted(prev => new Set(prev).add(id));
                setTimeout(() => {
                    setMessages(prev => prev.filter(m => m.id !== id));
                    setTemporarilyDeleted(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(id);
                        return newSet;
                    });
                }, 5000); 
            });
        };
        
         const handlePresenceChange = (data: { userId: string, online: boolean, lastSeen: string | null }) => {
            if (partner?.id === data.userId) {
                setPartner(prev => prev ? { ...prev, isOnline: data.online, lastSeen: data.lastSeen } : null);
            }
        };
        
        const handleUserTyping = (data: { chatId: string, userId: string }) => {
            if (data.chatId === chatId) {
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
        
        const handleMuteAction = (data: { reason: string, expiresAt: string }) => {
            const expiry = new Date(data.expiresAt).toLocaleTimeString();
            const message = data.reason ? t('chat.mutedMessageReason', { time: expiry, reason: data.reason}) : t('chat.mutedMessage', { time: expiry });
            toast.error(message, { duration: 10000 });
        };
        
        const handleMessagesRead = (data: { messageIds: string[], chatId: string, readerId: string }) => {
            if (data.chatId !== chatId) return;
            setMessages(prev => prev.map(msg => {
                if (data.messageIds.includes(msg.id)) {
                    const readBy = new Set(msg.readBy || []);
                    readBy.add(data.readerId);
                    return { ...msg, readBy: Array.from(readBy) };
                }
                return msg;
            }));
        };
        
        const handleChatStateUpdated = (data: { chatId: string, is_muted: boolean }) => {
            if (data.chatId === chatId) {
                setIsMuted(data.is_muted);
            }
        };

        const handleProfileUpdate = (updatedUser: Partial<User>) => {
             setPartner(prev => (prev && prev.id === updatedUser.id) ? { ...prev, ...updatedUser } : prev);
             setViewingProfile(prev => (prev && prev.id === updatedUser.id) ? { ...prev, ...updatedUser } : prev);
             if (updatedUser.id) {
                setChatUsers(prev => {
                    if (prev[updatedUser.id!]) {
                        return { ...prev, [updatedUser.id!]: { ...prev[updatedUser.id!], ...updatedUser } };
                    }
                    return prev;
                });
            }
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('messageEdited', handleMessageEdited);
        socket.on('messageDeleted', handleDelete);
        socket.on('messagesDeleted', handleDelete);
        socket.on('user-online', handlePresenceChange);
        socket.on('user-offline', handlePresenceChange);
        socket.on('user-is-typing', handleUserTyping);
        socket.on('user-stopped-typing', handleUserStoppedTyping);
        socket.on('messageReactionUpdated', handleMessageReactionUpdated);
        socket.on('actionFailedMute', handleMuteAction);
        socket.on('messagesRead', handleMessagesRead);
        socket.on('chatStateUpdated', handleChatStateUpdated);
        socket.on('userProfileUpdated', handleProfileUpdate);
        
        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('messageEdited', handleMessageEdited);
            socket.off('messageDeleted', handleDelete);
            socket.off('messagesDeleted', handleDelete);
            socket.off('user-online', handlePresenceChange);
            socket.off('user-offline', handlePresenceChange);
            socket.off('user-is-typing', handleUserTyping);
            socket.off('user-stopped-typing', handleUserStoppedTyping);
            socket.off('messageReactionUpdated', handleMessageReactionUpdated);
            socket.off('actionFailedMute', handleMuteAction);
            socket.off('messagesRead', handleMessagesRead);
            socket.off('chatStateUpdated', handleChatStateUpdated);
            socket.off('userProfileUpdated', handleProfileUpdate);
        };
    }, [socket, chatId, partner?.id, t, currentUser?.id]);
    
    useEffect(() => {
        const markAsReadIfFocused = () => {
            if (document.hasFocus() && chatId && socket) {
                socket.emit('markMessagesAsRead', { chatId });
            }
        };
        window.addEventListener('focus', markAsReadIfFocused);
        return () => {
            window.removeEventListener('focus', markAsReadIfFocused);
        };
    }, [chatId, socket]);
    
    const handleSendMessage = (payload: Partial<Message>) => {
        if (!socket || !chatId) return;

        const tempId = `temp_${Date.now()}`;
        const messagePayload = {
            chatId,
            content: payload.content || '',
            type: payload.type || 'text',
            mediaUrl: payload.mediaUrl,
            mediaMimetype: payload.mediaMimetype,
            tempId,
        };
        
        if (!messagePayload.content && !messagePayload.mediaUrl) return;
        
        const optimisticMessage: Message = {
            id: tempId,
            chatId: chatId!,
            senderId: currentUser!.id,
            content: messagePayload.content,
            timestamp: new Date().toISOString(),
            type: messagePayload.type,
            mediaUrl: messagePayload.mediaUrl,
            mediaMimetype: messagePayload.mediaMimetype,
            isEdited: false,
            isDeleted: false,
            tempId: tempId,
        };
        setMessages(prev => [...prev, optimisticMessage]);


        socket.emit('sendMessage', messagePayload);
        setNewMessage('');
        setEditingMessage(null);
    };

    const handleFileUpload = (file: File, caption: string, typeOverride?: MessageType) => {
        const tempId = `temp_upload_${Date.now()}`;
        
        let optimisticType: MessageType = 'file';
        if (typeOverride) {
            optimisticType = typeOverride;
        } else if (file.type.startsWith('image/')) {
            optimisticType = 'image';
        } else if (file.type.startsWith('video/')) {
            optimisticType = 'video';
        } else if (file.type.startsWith('audio/')) {
            optimisticType = 'audio';
        }
        
        const optimisticMessage: Message = {
            id: tempId,
            chatId: chatId!,
            senderId: currentUser!.id,
            content: optimisticType === 'file' ? file.name : caption,
            timestamp: new Date().toISOString(),
            type: optimisticType,
            mediaUrl: URL.createObjectURL(file), 
            mediaMimetype: file.type,
            isEdited: false,
            isDeleted: false,
        };
        setMessages(prev => [...prev, optimisticMessage]);

        const formData = new FormData();
        formData.append('mediaFile', file);
        
        const { promise, cancel } = api.uploadChatFile(formData, (progress) => {
             setUploadingFiles(prev => ({ ...prev, [tempId]: { ...prev[tempId], progress } }));
        });
        
        setUploadingFiles(prev => ({...prev, [tempId]: { progress: 0, cancel }}));

        promise.then(result => {
            let messageType: MessageType = 'file'; // Default
            if (typeOverride) {
                messageType = typeOverride;
            } else if (result.type.startsWith('image/')) {
                messageType = 'image';
            } else if (result.type.startsWith('video/')) {
                messageType = 'video';
            } else if (result.type.startsWith('audio/')) {
                messageType = 'audio';
            }

            handleSendMessage({
                content: messageType === 'file' ? result.originalName : caption,
                type: messageType,
                mediaUrl: result.mediaUrl,
                mediaMimetype: result.type,
            });
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }).catch(error => {
            if (error.message !== 'Upload was cancelled') {
                toast.error(t('toast.uploadError'));
            } else {
                 toast.success(t('toast.uploadCancelled'));
            }
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }).finally(() => {
            setUploadingFiles(prev => {
                const newUploading = { ...prev };
                if (newUploading[tempId]) {
                    URL.revokeObjectURL(optimisticMessage.mediaUrl!);
                }
                delete newUploading[tempId];
                return newUploading;
            });
        });
    };
    
    const cancelUpload = (tempId: string) => {
        if (uploadingFiles[tempId]) {
            uploadingFiles[tempId].cancel();
        }
    };


    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        let type: MessageType = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        if (file.type.startsWith('video/')) type = 'video';
        
        setMediaPreview({ file, type });
        e.target.value = ''; 
    };

    const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (editingMessage) {
                handleEditSubmit();
            } else {
                handleSendMessage({ content: newMessage });
            }
        }
    };
    
     const startTyping = useCallback(() => {
        if (socket && chatId) {
            socket.emit('start-typing', { chatId });
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = window.setTimeout(() => {
                 socket.emit('stop-typing', { chatId });
            }, 3000);
        }
    }, [socket, chatId]);
    
    const handleDownload = (url: string, filename: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleProcessAndDownload = async (message: Message) => {
        if (!message.mediaUrl) return;
        const toastId = `process-${message.id}`;
        try {
            toast.loading('Обработка... 0%', { id: toastId });
            await processVideoCircleForDownload(
                `/api/media/${message.mediaUrl}`,
                (progress) => {
                    toast.loading(`Обработка... ${Math.round(progress)}%`, { id: toastId });
                }
            );
            toast.success('Обработка завершена!', { id: toastId });
        } catch (error: any) {
            toast.error(`Ошибка обработки: ${error.message}`, { id: toastId, duration: 8000 });
        }
    };
    
    const handleContextMenu = (e: React.MouseEvent, message: Message) => {
        e.preventDefault();
        if (selectionMode) return;
        setContextMenu({ x: e.clientX, y: e.clientY, message });
    };

    const handleMediaClick = (message: Message) => {
        const mediaItems = messages.filter(m => ['image', 'video', 'video_circle'].includes(m.type) && !m.isDeleted);
        const startIndex = mediaItems.findIndex(m => m.id === message.id);
        if (startIndex !== -1) {
            setMediaViewerState({ items: mediaItems, startIndex });
        }
    };
    
    const handleToggleSelect = (messageId: string) => {
        setSelectedMessages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
    };

    const handleDeleteSelected = async () => {
        if (selectedMessages.size === 0) return;
        try {
            await api.bulkDeleteMessages(Array.from(selectedMessages));
        } catch (error) {
            toast.error(t('toast.deleteMessageError'));
        } finally {
            setSelectionMode(false);
            setSelectedMessages(new Set());
            setDeleteConfirmOpen(false);
        }
    };

    const handleEditMessage = (message: Message) => {
        setEditingMessage(message);
        setNewMessage(message.content);
        textAreaRef.current?.focus();
    };

    const handleEditSubmit = async () => {
        if (!editingMessage || !newMessage.trim()) return;
        try {
            await api.editMessage(editingMessage.id, { content: newMessage });
        } catch (e) {
            toast.error(t('toast.editError'));
        } finally {
            setEditingMessage(null);
            setNewMessage('');
        }
    };
    
    const handleMuteToggle = async () => {
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);

        if (chatId === GLOBAL_CHAT_ID) {
            localStorage.setItem('global_chat_muted', String(newMutedState));
            // Manually dispatch a storage event to notify other components (like Sidebar) in the same window.
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'global_chat_muted',
                newValue: String(newMutedState),
            }));
            toast.success(newMutedState ? t('chat.mute') : t('chat.unmute'));
        } else if (partner) {
            try {
                await api.updateChatState(chatId!, { is_muted: newMutedState });
                toast.success(newMutedState ? t('chat.mute') : t('chat.unmute'));
            } catch (error) {
                setIsMuted(!newMutedState); // Revert on error
                toast.error("Failed to update mute status.");
            }
        }
    };
    
    const isPrivateChat = chatId !== GLOBAL_CHAT_ID;

    const renderChatHeader = () => (
         <header className="flex-shrink-0 flex items-center justify-between p-3 border-b border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
                 {!isStandalone && (
                     <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                    </button>
                 )}
                 {chatId === GLOBAL_CHAT_ID ? (
                    <div className="flex items-center cursor-pointer min-w-0" onClick={() => setIsChatInfoModalOpen(true)}>
                         <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">#</div>
                        <div className="ml-3 min-w-0">
                            <h2 className="font-semibold text-sm truncate">{t('sidebar.globalChat')}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t('sidebar.globalChatDesc')}</p>
                        </div>
                    </div>
                ) : partner ? (
                    <div className="flex items-center cursor-pointer min-w-0" onClick={() => setViewingProfile(partner)}>
                        <Avatar user={partner} />
                        <div className="ml-3 min-w-0">
                            <h2 className="font-semibold text-sm truncate">{partner.name}</h2>
                             <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {typingUsers.has(partner.id)
                                    ? <span className="text-indigo-500 italic">{t('chat.typing')}</span>
                                    : partner.isOnline ? t('chat.online') : formatLastSeen(partner.lastSeen, t)
                                }
                            </p>
                        </div>
                    </div>
                ) : <div className="h-10"></div> }
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                 {isPrivateChat && partner && (
                    <button onClick={() => call.startCall(partner)} disabled={call.inCall} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 disabled:opacity-50" title="Video Call">
                        <FaVideo className="h-5 w-5" />
                    </button>
                 )}
                 <button onClick={handleMuteToggle} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400" title={isMuted ? t('chat.unmute') : t('chat.mute')}>
                     {isMuted ? (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0L19.414 6.27a1 1 0 010 1.414L16.07 11.03a1 1 0 01-1.414-1.414l2.657-2.657-2.657-2.657a1 1 0 010-1.414zm-2.828 0a1 1 0 011.414 1.414L10.586 7a1 1 0 01-1.414-1.414L11.828 2.93z" clipRule="evenodd" /></svg>
                     ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 12.586V8a6 6 0 00-6-6zM10 16a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                     )}
                </button>
            </div>
        </header>
    );

    const renderMessageInput = () => {
        if (isRecordingAudio) {
            return <AudioRecorder 
                        onSend={(file) => {
                            handleFileUpload(file, '', 'audio');
                            setIsRecordingAudio(false);
                        }} 
                        onCancel={() => setIsRecordingAudio(false)} 
                    />;
        }
        return (
            <div className="flex items-end gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </button>
                 <button onClick={() => setIsRecordingVideo(true)} className="p-3 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                </button>
                <div className="flex-1 relative">
                    {editingMessage && (
                        <div className="absolute bottom-full left-0 right-0 p-2 bg-slate-200 dark:bg-slate-700 rounded-t-lg text-xs text-slate-600 dark:text-slate-300 flex justify-between items-center">
                            <span>{t('chat.editingMessage')}</span>
                            <button onClick={() => { setEditingMessage(null); setNewMessage(''); }}>&times;</button>
                        </div>
                    )}
                    <textarea
                        ref={textAreaRef}
                        value={newMessage}
                        onChange={(e) => { setNewMessage(e.target.value); startTyping(); }}
                        onKeyDown={handleTextareaKeyDown}
                        placeholder={t('chat.typeMessage')}
                        className="w-full bg-slate-200 dark:bg-slate-700 border-2 border-transparent rounded-2xl p-3 pr-12 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] outline-none transition-colors resize-none max-h-40"
                        rows={1}
                    />
                </div>
                {newMessage ? (
                    <button onClick={() => editingMessage ? handleEditSubmit() : handleSendMessage({ content: newMessage })} className="w-12 h-12 flex items-center justify-center bg-indigo-500 rounded-full text-white flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                    </button>
                ) : (
                     <button onClick={() => setIsRecordingAudio(true)} className="w-12 h-12 flex items-center justify-center bg-indigo-500 rounded-full text-white flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full relative overflow-hidden">
            {viewingProfile && <ViewProfileModal user={viewingProfile} onClose={() => setViewingProfile(null)} onStartChat={(userId) => { setViewingProfile(null); navigate(`/app/chat/${[currentUser!.id, userId].sort().join('-')}`)}} />}
            {isChatInfoModalOpen && <GlobalChatInfoModal onClose={() => setIsChatInfoModalOpen(false)} />}
            {mediaPreview && <MediaUploadPreviewModal item={mediaPreview} onClose={() => setMediaPreview(null)} onSend={handleFileUpload} />}
            {contextMenu && <MessageContextMenu menuRef={contextMenuRef} x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} actions={[]} />}
            {mediaViewerState && <MediaViewerModal items={mediaViewerState.items} startIndex={mediaViewerState.startIndex} onClose={() => setMediaViewerState(null)} />}
            {isRecordingVideo && <VideoRecorderModal onClose={() => setIsRecordingVideo(false)} onSend={(file) => handleFileUpload(file, '', 'video_circle')} />}
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDeleteSelected} title={t('common.delete') + ' ' + (selectedMessages.size > 1 ? t('chat.messages') : t('chat.message'))} message={t('chat.deleteConfirm', { count: selectedMessages.size })} />
            
            {renderChatHeader()}
            
            <AnimatePresence>
                {selectionMode && (
                    <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
                        className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-2 rounded-lg shadow-lg">
                        <span className="font-semibold text-sm">{t('common.selectedCount', { count: selectedMessages.size })}</span>
                        <button onClick={() => setDeleteConfirmOpen(true)} className="p-2 text-red-500 rounded-full hover:bg-red-500/10 transition-colors" disabled={selectedMessages.size === 0}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        </button>
                        <button onClick={() => { setSelectionMode(false); setSelectedMessages(new Set()); }} className="p-2 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">&times;</button>
                    </motion.div>
                )}
            </AnimatePresence>

            <main ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {isLoading ? (
                     [...Array(10)].map((_, i) => (
                        <div key={i} className={`flex items-end gap-3 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                            <div className="skeleton-bubble">
                                <div className="skeleton-line w-3/4 mb-2"></div>
                                <div className="skeleton-line w-full"></div>
                            </div>
                        </div>
                     ))
                ) : (
                    messages.map((msg, index) => {
                        const prevMsg = messages[index - 1];
                        const isOwn = msg.senderId === currentUser!.id;
                        const showAvatar = !isOwn && (!prevMsg || prevMsg.senderId !== msg.senderId);

                        return (
                            <div key={msg.id || msg.tempId} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <MessageBubble
                                    message={msg}
                                    isOwn={isOwn}
                                    sender={chatUsers[msg.senderId]}
                                    isPrivateChat={isPrivateChat}
                                    onViewProfile={(user) => setViewingProfile(user || null)}
                                    onContextMenu={handleContextMenu}
                                    onMediaClick={handleMediaClick}
                                    uploadProgress={uploadingFiles[msg.id]?.progress}
                                    onCancelUpload={() => cancelUpload(msg.id)}
                                    onToggleSelect={handleToggleSelect}
                                    selectionMode={selectionMode}
                                    isSelected={selectedMessages.has(msg.id)}
                                    isReacting={isReacting === msg.id}
                                    onReactionHandled={() => setIsReacting(null)}
                                    isTemporarilyDeleted={temporarilyDeleted.has(msg.id)}
                                />
                            </div>
                        );
                    })
                )}
                 <div ref={messagesEndRef} />
            </main>

            <footer className="flex-shrink-0 p-3 border-t border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md">
                {renderMessageInput()}
            </footer>

            {/* Video Call UI */}
            <AnimatePresence>
                {call.inCall && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={`call-ui ${isMobile ? 'mobile-fullscreen' : ''}`}
                    >
                        <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
                        <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
                        <div className="call-controls">
                            <button onClick={call.toggleMic} className={`call-control-btn ${call.isMuted ? 'danger' : ''}`}>
                                {call.isMuted ? <FaMicrophoneSlash size={20} /> : <FaMicrophone size={20} />}
                            </button>
                            <button onClick={call.toggleCamera} className={`call-control-btn ${call.isCameraOff ? 'danger' : ''}`}>
                                {call.isCameraOff ? <FaVideoSlash size={20} /> : <FaVideo size={20} />}
                            </button>
                            <button onClick={call.endCall} className="call-control-btn danger">
                                <FaPhoneSlash size={20} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ChatWindow;