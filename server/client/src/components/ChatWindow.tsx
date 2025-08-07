
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import type { Message, User, MessageType } from '../types';
import toast from 'react-hot-toast';
import { useI18n } from '../hooks/useI18n';
import { io, Socket } from 'socket.io-client';
import { GLOBAL_CHAT_ID } from '../constants';
import Avatar from './Avatar';

const MediaMessage: React.FC<{ message: Message }> = ({ message }) => {
    const { mediaUrl = '', type, content } = message;
    // All media is now served through the secure route
    const secureMediaUrl = mediaUrl ? `/api/media/${mediaUrl}` : '';
    const isPreviewable = type === 'image' || type === 'video' || type === 'audio';

    if (!isPreviewable) {
        // This is a downloadable file
        return (
            <a href={secureMediaUrl} download={content} className="mt-1 flex items-center gap-3 bg-slate-600/50 p-3 rounded-lg hover:bg-slate-600 transition-colors max-w-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                <div className="overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{content || 'File'}</p>
                </div>
            </a>
        );
    }
    
    switch(type) {
        case 'image':
            return <img src={secureMediaUrl} alt={content || "User upload"} className="max-w-xs lg:max-w-md rounded-lg mt-1 cursor-pointer" onClick={() => window.open(secureMediaUrl, '_blank')} />;
        case 'video':
            return <video src={secureMediaUrl} controls className="max-w-xs lg:max-w-md rounded-lg mt-1" />;
        case 'audio':
            return <audio src={secureMediaUrl} controls className="w-64 mt-1" />;
        default:
             return null; // Should not happen due to the check above
    }
}

const MessageBubble: React.FC<{ message: Message; isOwn: boolean; senderName: string }> = ({ message, isOwn, senderName }) => {
    const bubbleClasses = isOwn ? 'bg-indigo-600 rounded-br-none' : 'bg-slate-700 rounded-bl-none';
    const alignClasses = isOwn ? 'self-end items-end' : 'self-start items-start';

    return (
        <div className={`flex flex-col gap-1 max-w-lg w-fit ${alignClasses} animate-fade-in-up`}>
            {!isOwn && <div className="text-xs text-indigo-300 px-1 font-medium">{senderName}</div>}
            <div className={`px-4 py-3 rounded-2xl shadow-md ${bubbleClasses}`}>
                {message.type === 'text' && <p className="text-sm text-white whitespace-pre-wrap break-words">{message.content}</p>}
                {(message.type !== 'text' && message.mediaUrl) && <MediaMessage message={message} />}
            </div>
            <div className="text-xs text-slate-400 px-1">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
    );
};

// Helper to create a deterministic chat ID for private chats
const getPrivateChatId = (userId1: string, userId2: string): string => {
    return [userId1, userId2].sort().join('-');
};

const ChatWindow: React.FC<{ chatId: string }> = ({ chatId }) => {
    const { currentUser } = useAuth();
    const { t } = useI18n();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatPartner, setChatPartner] = useState<Partial<User>>({});
    const [usersMap, setUsersMap] = useState<Record<string, User>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<NodeJS.Timeout>();

    const isPrivateChat = chatId !== GLOBAL_CHAT_ID;
    const resolvedChatId = isPrivateChat && currentUser ? getPrivateChatId(currentUser.id, chatId) : GLOBAL_CHAT_ID;

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    const fetchChatData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            const [msgs, allUsersResponse] = await Promise.all([
                api.getMessages(resolvedChatId),
                api.getMyChats()
            ]);
            
            const usersFromChats = allUsersResponse.reduce((acc, user) => {
                acc[user.id] = user;
                return acc;
            }, {} as Record<string, User>);

            setMessages(msgs);

            const fullUserMap = { ...usersFromChats, [currentUser.id]: currentUser };
            setUsersMap(fullUserMap);

            if (isPrivateChat) {
                 const partner = await api.getUserByUniqueId(chatId) || await api.getUserByUniqueId(resolvedChatId.replace(currentUser.id,'').replace('-',''));
                if (partner) {
                     setChatPartner(partner);
                } else {
                     // Fallback for new chats not yet in DB
                     const search = await api.getUserByUniqueId(chatId);
                     if (search) setChatPartner(search);
                }
            }
        } catch (error) { toast.error(t('chat.loadError')) } 
        finally { setIsLoading(false) }
    }, [resolvedChatId, currentUser, t, isPrivateChat, chatId]);

    useEffect(() => { fetchChatData() }, [fetchChatData]);
    
    useEffect(() => {
        socketRef.current = io({ withCredentials: true });
        const socket = socketRef.current;
        socket.emit('joinRoom', resolvedChatId);
        const handleNewMessage = (message: Message) => { if(message.chatId === resolvedChatId) setMessages(prev => [...prev, message]) };
        socket.on('newMessage', handleNewMessage);
        return () => { socket.off('newMessage', handleNewMessage); socket.emit('leaveRoom', resolvedChatId); socket.disconnect() };
    }, [resolvedChatId]);
    
    useEffect(scrollToBottom, [messages]);
    
    const sendMediaMessage = useCallback(async (file: File) => {
        if (!socketRef.current) return;
        const formData = new FormData();
        formData.append('mediaFile', file);

        try {
            const { mediaUrl, type, originalName } = await api.uploadChatFile(formData);
            const messageData: Partial<Message> & { mediaMimetype: string } = {
                chatId: resolvedChatId,
                type: type.split('/')[0] as MessageType,
                mediaUrl,
                content: originalName,
                mediaMimetype: type,
            };
            socketRef.current.emit('sendMessage', messageData);
        } catch (error) { toast.error("File upload failed.") }
    }, [resolvedChatId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) sendMediaMessage(file);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            recordingChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (e) => recordingChunksRef.current.push(e.data);
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
                sendMediaMessage(new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' }));
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (err) { toast.error("Microphone access was denied.") }
    };
    
    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
        setIsRecording(false);
        clearInterval(recordingTimerRef.current);
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !socketRef.current) return;
        socketRef.current.emit('sendMessage', { chatId: resolvedChatId, content: newMessage.trim(), type: 'text' });
        setNewMessage('');
    };
    
    const chatHeaderName = isPrivateChat ? chatPartner.name : t('sidebar.globalChat');
    const chatHeaderDesc = isPrivateChat ? t('chat.activeNow') : t('chat.everyone');
    const headerAvatarUser = isPrivateChat ? chatPartner : { name: 'G', avatarUrl: '/favicon.svg' };

    if (isLoading) return <div className="flex-1 flex items-center justify-center">{t('chat.loading')}</div>;

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-800">
            <div className="h-16 flex-shrink-0 flex items-center p-4 bg-slate-900 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                    <Avatar user={headerAvatarUser} />
                    <div>
                        <h2 className="text-lg font-semibold text-white">{chatHeaderName}</h2>
                        <p className="text-xs text-slate-400">{chatHeaderDesc}</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6"><div className="flex flex-col gap-4">
                {messages.map(msg => (
                    <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === currentUser?.id} senderName={usersMap[msg.senderId]?.name || chatPartner.name || t('chat.unknownUser')} />
                ))}
                <div ref={messagesEndRef} />
            </div></div>

            <div className="p-4 bg-slate-900/50 border-t border-slate-700/50">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </button>
                    <div className="relative flex-1">
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={isRecording} placeholder={t('chat.typeMessage')}
                            className="w-full bg-slate-800 border border-slate-700 rounded-full py-3 px-5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:bg-slate-700" />
                        {isRecording && <div className="absolute inset-y-0 left-4 flex items-center text-red-500 text-sm font-mono"><span className="w-2.5 h-2.5 bg-red-500 rounded-full mr-2 animate-pulse"></span> {Math.floor(recordingTime/60)}:{(recordingTime%60).toString().padStart(2, '0')}</div>}
                    </div>
                    {newMessage.trim() === '' ? (
                         <button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
                             className={`p-3 text-white rounded-full transition-colors ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" /><path d="M5.5 8.5a.5.5 0 01.5.5v1a4 4 0 004 4h0a4 4 0 004-4v-1a.5.5 0 011 0v1a5 5 0 01-4.5 4.975V17h3a.5.5 0 010 1h-7a.5.5 0 010-1h3v-1.525A5 5 0 014.5 9.5v-1a.5.5 0 01.5-.5z" /></svg>
                         </button>
                    ) : (
                        <button type="submit" className="bg-indigo-600 rounded-full p-3 text-white hover:bg-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
};

export default ChatWindow;
