import React, { useRef, useState, useEffect } from 'react';
import type { Message, User, ReactionMap } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import Avatar from './Avatar';
import InlineVideoCirclePlayer from './InlineVideoCirclePlayer';
import { useSocket } from '../hooks/useSocket';
import AudioPlayer from './AudioPlayer';
import { formatTime } from '../helpers/time';

const MediaPlaceholder: React.FC<{ type: Message['type'] }> = ({ type }) => {
    const icon = {
        image: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>,
        video: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
        file: <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    }[type] || <div />;

    return (
        <div className="p-2 w-64 aspect-[16/10] bg-slate-200 dark:bg-slate-600 rounded-lg animate-pulse flex items-center justify-center">
            {icon}
        </div>
    );
};


const MediaMessage: React.FC<{ message: Message; onMediaClick: () => void; isVisible: boolean, uploadProgress?: number | null, onCancelUpload?: () => void; }> = ({ message, onMediaClick, isVisible, uploadProgress, onCancelUpload }) => {
    const { mediaUrl = '', type } = message;
    
    const secureMediaUrl = ((): string => {
        if (!mediaUrl || !isVisible) return '';
        if (mediaUrl.startsWith('http') || mediaUrl.startsWith('blob:')) return mediaUrl;
        const filename = mediaUrl.split('/').pop();
        return `/api/media/${filename}`;
    })();
        
    const [hasError, setHasError] = React.useState(false);
    const { t } = useI18n();
    const isUploading = typeof uploadProgress === 'number';

    React.useEffect(() => { setHasError(false) }, [secureMediaUrl]);

    if ((hasError && isVisible) || message.isDeleted) {
        return <div className="p-3 text-slate-500 dark:text-slate-300 text-xs italic">{t('chat.fileNotFound')}</div>
    }
    
    if (!isVisible && !isUploading) {
        return <MediaPlaceholder type={type} />;
    }
    
    if (!message.mediaUrl && !isUploading) {
        return <div className="p-3 text-red-500 dark:text-red-400 text-xs italic">{t('toast.uploadError')}</div>
    }
    
    const mediaContent = () => {
        switch(type) {
            case 'image': 
                return (
                    <div className="w-64 aspect-[16/10] rounded-lg overflow-hidden cursor-pointer" onClick={onMediaClick} onContextMenu={(e) => e.preventDefault()}>
                        <img key={secureMediaUrl} src={secureMediaUrl} alt="User-uploaded content" loading="lazy" onError={() => setHasError(true)} className="w-full h-full object-cover" />
                    </div>
                );
            case 'video': 
                return (
                    <div key={secureMediaUrl} className="relative w-64 aspect-[16/10] rounded-lg overflow-hidden cursor-pointer" onClick={onMediaClick} onContextMenu={(e) => e.preventDefault()}>
                        <video key={secureMediaUrl} src={secureMediaUrl} controls={false} preload="metadata" onError={() => setHasError(true)} className="w-full h-full block object-cover" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                        </div>
                    </div>
                );
            case 'audio': 
                return <div className="p-2"><AudioPlayer src={secureMediaUrl} /></div>;
            default: 
                return (
                     <a key={secureMediaUrl} href={secureMediaUrl} download={message.content || ''} className="m-2 flex items-center gap-3 bg-slate-500/20 dark:bg-slate-600/30 p-3 rounded-lg hover:bg-slate-500/30 dark:hover:bg-slate-600/50 transition-colors max-w-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500 dark:text-indigo-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2-2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                        <p className="text-sm font-medium truncate">{message.content || 'File'}</p>
                    </a>
                );
        }
    }

    return (
        <div className="relative">
            {mediaContent()}
            {isUploading && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white font-bold rounded-lg">
                <p className="text-lg">{`${Math.round(uploadProgress!)}%`}</p>
                <p className="text-sm">{t('chat.uploading')}</p>
                <button 
                  onClick={onCancelUpload} 
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full hover:bg-red-500/80 transition-colors"
                  title={t('common.cancel')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
        </div>
    );
}

const escapeHtml = (text: string) => {
    const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
};

const parseMarkdown = (text: string) => {
    const escapedText = escapeHtml(text);
    return escapedText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/~(.*?)~/g, '<s>$1</s>');
};

const EMOJI_MAP: Record<string, string> = {
  '10': '👍', '11': '👎', '12': '😄', '13': '🎉', '14': '😞', '15': '😠',
  '21': '❤️', '22': '🔥', '23': '👏', '24': '🤔', '25': '🤯', '26': '💩'
};

const ReactionPalette: React.FC<{ onSelect: (emoji: string) => void; isOwn: boolean; }> = ({ onSelect, isOwn }) => {
    const reactions = ['10', '21', '12', '24', '14', '26'];
    const positionClass = isOwn ? 'right-0' : 'left-0';
    return (
        <div className={`absolute -top-10 ${positionClass} bg-white dark:bg-slate-800 rounded-full shadow-lg p-1 flex gap-1 z-10 animate-fade-in-up`}>
            {reactions.map(r => (
                 <button 
                    key={r} 
                    onClick={(e) => { e.stopPropagation(); onSelect(r); }}
                    className="text-2xl p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-transform transform hover:scale-125"
                >{EMOJI_MAP[r]}</button>
            ))}
        </div>
    )
};

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    sender?: User | null;
    isPrivateChat?: boolean;
    uploadProgress?: number | null;
    onCancelUpload?: () => void;
    onViewProfile: (user: User) => void;
    onContextMenu: (event: React.MouseEvent, message: Message) => void;
    onMediaClick: (message: Message) => void;
    onToggleSelect: (messageId: string) => void;
    selectionMode: boolean;
    isSelected: boolean;
    isReacting: boolean;
    onReactionHandled: () => void;
    isTemporarilyDeleted: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
    message, isOwn, sender, isPrivateChat, uploadProgress, onCancelUpload, onViewProfile, onContextMenu, onMediaClick, onToggleSelect,
    selectionMode, isSelected, isReacting, onReactionHandled, isTemporarilyDeleted
}) => {
    const { currentUser } = useAuth();
    const { t } = useI18n();
    const { socket } = useSocket();
    const messageRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isCirclePlaying, setIsCirclePlaying] = useState(false);
    
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );
        if (messageRef.current) {
            observer.observe(messageRef.current);
        }
        return () => observer.disconnect();
    }, []);

    const handleReaction = (reaction: string) => {
        if (!socket) return;
        socket.emit('reactToMessage', { messageId: message.id, reaction });
        onReactionHandled();
    };
    
    if (isTemporarilyDeleted) {
         return (
             <div ref={messageRef} className={`flex items-end gap-3 justify-center`}>
                <div className="p-3 italic text-slate-500 dark:text-slate-400 text-sm w-64">
                    <p>{t('chat.messageDeleted')}</p>
                    <div className="h-0.5 bg-slate-300 dark:bg-slate-600 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-red-500 animate-deleted-message"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (message.isDeleted) {
        return null;
    }
    
    const hasReactions = message.reactions && Object.keys(message.reactions).length > 0;
    const isVideoCircle = message.type === 'video_circle';

    const secureMediaUrl = ((): string => {
        if (!message.mediaUrl) return '';
        if (message.mediaUrl.startsWith('http') || message.mediaUrl.startsWith('blob:')) return message.mediaUrl;
        const filename = message.mediaUrl.split('/').pop();
        return `/api/media/${filename}`;
    })();
    
    const bubbleRootClasses = [
        'flex w-full',
        isOwn ? 'justify-end' : 'justify-start'
    ].join(' ');

    const bubbleInnerClasses = [
        'flex items-end gap-3 group',
        selectionMode ? 'cursor-pointer' : '',
    ].filter(Boolean).join(' ');


    if (isVideoCircle) {
        return (
            <div className={bubbleRootClasses}>
                <div
                    ref={messageRef}
                    id={message.id}
                    onContextMenu={(e) => !selectionMode && onContextMenu(e, message)}
                    onClick={() => selectionMode && onToggleSelect(message.id)}
                    className={bubbleInnerClasses}
                >
                     {!isOwn && <Avatar user={sender || {}} size="small" />}
                     <div className={`relative ${isOwn ? 'items-end' : 'items-start'} flex flex-col min-w-0`}>
                        <div className="flex items-center gap-2 relative">
                             {selectionMode && (
                                <div className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 border-[rgb(var(--color-accent-primary))] bg-white dark:bg-slate-800 ${isOwn ? 'order-last' : ''} mx-1`}>
                                    {isSelected && <div className="w-3 h-3 bg-[rgb(var(--color-accent-primary))] rounded-full"></div>}
                                </div>
                            )}
                            <div className="relative">
                                {isVisible && <InlineVideoCirclePlayer key={secureMediaUrl} src={secureMediaUrl} onPlaybackChange={setIsCirclePlaying} isOwn={isOwn} />}
                                 {isReacting && <ReactionPalette onSelect={handleReaction} isOwn={isOwn} />}
                            </div>
                        </div>
                        {hasReactions && (
                             <div className={`flex gap-1 mt-1 p-1 rounded-full bg-slate-200/50 dark:bg-slate-900/50 ${isOwn ? 'mr-1' : 'ml-1'}`}>
                                 {Object.entries(message.reactions!).map(([emoji, userIds]) => {
                                    const reactorIds = userIds as string[];
                                    if (reactorIds.length === 0) return null;
                                    const displayEmoji = EMOJI_MAP[emoji] || emoji;
                                    return (
                                        <button 
                                            key={emoji} 
                                            onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                                            className={`px-2 py-0.5 rounded-full text-xs transition-colors ${reactorIds.includes(currentUser!.id) ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-slate-700'}`}
                                        >
                                            {displayEmoji} {reactorIds.length}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 px-2">
                             {formatTime(message.timestamp)}
                        </p>
                     </div>
                </div>
            </div>
        );
    }
    
    let bubbleStyle: React.CSSProperties = {};
    let bubbleClasses = 'flex flex-col max-w-sm sm:max-w-md md:max-w-lg overflow-hidden';
    let textColorClass = 'text-slate-800 dark:text-slate-200';

    if (isOwn) {
        const ownColor = currentUser?.message_color;
        if (ownColor) {
            bubbleStyle = { backgroundColor: ownColor };
            textColorClass = 'text-white'; 
        } else {
            bubbleClasses += ' bg-gradient-to-br from-[rgb(var(--color-accent-primary))] to-[rgb(var(--color-accent-secondary))]';
            textColorClass = 'text-white';
        }
    } else {
        const senderColor = sender?.message_color;
        if (senderColor) {
            bubbleStyle = { backgroundColor: senderColor };
            textColorClass = 'text-white'; 
        } else {
            bubbleClasses += ' bg-white dark:bg-slate-700 shadow-md';
        }
    }
    
    if ((message.mediaUrl || typeof uploadProgress === 'number') && !message.content) {
         bubbleClasses += ' rounded-2xl';
    } else {
        bubbleClasses += isOwn ? ' rounded-l-2xl rounded-t-2xl rounded-br-lg' : ' rounded-r-2xl rounded-t-2xl rounded-bl-lg';
    }


    return (
        <div className={bubbleRootClasses}>
            <div 
                ref={messageRef}
                id={message.id}
                onContextMenu={(e) => !selectionMode && onContextMenu(e, message)}
                onClick={() => selectionMode && onToggleSelect(message.id)}
                className={bubbleInnerClasses}
            >
                {!isOwn && (
                    <div className="cursor-pointer" onClick={() => !selectionMode && sender && onViewProfile(sender)}>
                        <Avatar user={sender || {}} size="small" />
                    </div>
                )}
                <div className={`relative ${isOwn ? 'items-end' : 'items-start'} flex flex-col min-w-0`}>
                    <div className="flex items-center gap-2 relative">
                        {selectionMode && (
                             <div className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 border-[rgb(var(--color-accent-primary))] bg-white dark:bg-slate-800 ${isOwn ? 'order-last' : ''} mx-1`}>
                                 {isSelected && <div className="w-3 h-3 bg-[rgb(var(--color-accent-primary))] rounded-full"></div>}
                             </div>
                        )}
                        
                        <div 
                            className={bubbleClasses}
                            style={bubbleStyle}
                        >
                            {isReacting && <ReactionPalette onSelect={handleReaction} isOwn={isOwn} />}

                            {message.forwardedInfo && (
                                 <div className={`px-3 pt-3 text-xs font-semibold ${textColorClass} opacity-80`}>
                                    {t('chat.forwardedFrom', { name: message.forwardedInfo.originalSenderName })}
                                </div>
                            )}

                            {!isOwn && sender && !isPrivateChat && (
                                <p 
                                    className="font-bold text-sm mb-1 cursor-pointer px-3 pt-3" 
                                    style={{ color: sender.profile_color || 'rgb(var(--color-accent-primary))'}}
                                    onClick={() => sender && onViewProfile(sender)}
                                >{sender.name}</p>
                            )}
                            
                            {(message.mediaUrl || typeof uploadProgress === 'number') && (
                                 <MediaMessage message={{...message, mediaUrl: secureMediaUrl}} onMediaClick={() => onMediaClick(message)} isVisible={isVisible} uploadProgress={uploadProgress} onCancelUpload={onCancelUpload} />
                            )}
                            
                            {message.content && message.type !== 'audio' && (
                                 <div 
                                    className={`text-sm break-words whitespace-pre-wrap ${textColorClass} px-3 ${(message.mediaUrl || typeof uploadProgress === 'number' || message.forwardedInfo) ? 'pt-2 pb-3' : 'py-3'}`}
                                    dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
                                />
                            )}
                        </div>
                    </div>

                     {hasReactions && (
                        <div className={`flex gap-1 mt-1 p-1 rounded-full bg-slate-200/50 dark:bg-slate-900/50 ${isOwn ? 'mr-1' : 'ml-1'}`}>
                            {Object.entries(message.reactions!).map(([emoji, userIds]) => {
                                const reactorIds = userIds as string[];
                                if (reactorIds.length === 0) return null;
                                const displayEmoji = EMOJI_MAP[emoji] || emoji;
                                return (
                                    <button 
                                        key={emoji} 
                                        onClick={() => handleReaction(emoji)}
                                        className={`px-2 py-0.5 rounded-full text-xs transition-colors ${reactorIds.includes(currentUser!.id) ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-slate-700'}`}
                                    >
                                        {displayEmoji} {reactorIds.length}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-1 px-2">
                         {message.isEdited && <span className="mr-1">{t('chat.edited')}</span>}
                         <span>{formatTime(message.timestamp)}</span>
                         {isOwn && (
                             <span className={`read-receipt read-receipt-own ${message.readBy && message.readBy.length > 0 ? 'read' : ''}`}>
                                {message.readBy && message.readBy.length > 0 ? '✓✓' : '✓'}
                             </span>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(MessageBubble);