

import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import type { Message } from '../types';
import toast from 'react-hot-toast';
import { useI18n } from '../hooks/useI18n';
import MediaViewerModal from './MediaViewerModal';
import AudioPlayer from './AudioPlayer';

interface SharedMediaViewerProps {
    chatId: string;
    isProfileContext?: boolean; 
}

const MediaGridItem: React.FC<{ message: Message, onClick: () => void }> = ({ message, onClick }) => {
    const secureMediaUrl = message.mediaUrl ? `/api/media/${message.mediaUrl}` : '';
    const isVideoCircle = message.type === 'video_circle';

    return (
        <div onClick={onClick} className={`relative aspect-square bg-slate-200 dark:bg-slate-700 group cursor-pointer overflow-hidden ${isVideoCircle ? 'rounded-full' : 'rounded-lg'}`}>
            {message.type.startsWith('video') ? (
                <>
                    <video src={secureMediaUrl} className={`w-full h-full object-cover ${isVideoCircle ? 'rounded-full' : ''}`} />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                    </div>
                </>
            ) : (
                <img src={secureMediaUrl} alt={message.content || 'Shared media'} className="w-full h-full object-cover" />
            )}
        </div>
    );
};

const SharedMediaViewer: React.FC<SharedMediaViewerProps> = ({ chatId, isProfileContext }) => {
    const { t } = useI18n();
    const [media, setMedia] = useState<Message[]>([]);
    const [activeTab, setActiveTab] = useState<'image' | 'video_circle' | 'file' | 'audio'>('image');
    const [loading, setLoading] = useState(true);
    const [mediaViewerState, setMediaViewerState] = useState<{items: Message[], startIndex: number} | null>(null);


    useEffect(() => {
        const fetchMedia = async () => {
            setLoading(true);
            try {
                const mediaMessages = await api.getChatMedia(chatId, 'all');
                setMedia(mediaMessages);
            } catch (error) {
                toast.error("Failed to load shared media.");
            } finally {
                setLoading(false);
            }
        };
        fetchMedia();
    }, [chatId]);
    
    const getFilteredMedia = () => {
        switch(activeTab) {
            case 'image': return media.filter(m => m.type === 'image' || m.type === 'video');
            case 'video_circle': return media.filter(m => m.type === 'video_circle');
            case 'file': return media.filter(m => m.type === 'file');
            case 'audio': return media.filter(m => m.type === 'audio');
            default: return [];
        }
    };

    const filteredMedia = getFilteredMedia();

    const handleMediaClick = (clickedMessage: Message) => {
        const mediaItemsForViewer = getFilteredMedia().filter(m => ['image', 'video', 'video_circle'].includes(m.type));
        const startIndex = mediaItemsForViewer.findIndex(m => m.id === clickedMessage.id);
        if (startIndex !== -1) {
            setMediaViewerState({ items: mediaItemsForViewer, startIndex });
        }
    };
    
    const TabButton: React.FC<{tabId: 'image' | 'video_circle' | 'file' | 'audio', label: string}> = ({ tabId, label }) => (
        <button 
            onClick={() => setActiveTab(tabId)} 
            className={`px-3 py-1 text-sm font-bold rounded-md transition-colors ${activeTab === tabId ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
        >
            {label}
        </button>
    );

    const renderContent = () => {
        if (loading) {
             return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>
        }
        if (filteredMedia.length === 0) {
            return <div className="flex justify-center items-center h-full text-slate-500 dark:text-slate-400">{t('media.noMediaInCategory')}</div>
        }
        
        if (activeTab === 'image' || activeTab === 'video_circle') {
            return (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {filteredMedia.map(msg => <MediaGridItem key={msg.id} message={msg} onClick={() => handleMediaClick(msg)} />)}
                </div>
            )
        }
        
        if (activeTab === 'audio') {
            return (
                <div className="space-y-2">
                    {filteredMedia.map(msg => {
                        const secureMediaUrl = msg.mediaUrl ? `/api/media/${msg.mediaUrl}` : '#';
                        return (
                            <div key={msg.id} className="flex items-center gap-3 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg">
                                <AudioPlayer src={secureMediaUrl} />
                            </div>
                        );
                    })}
                </div>
            );
        }

        return (
             <div className="space-y-2">
                {filteredMedia.map(msg => {
                    const secureMediaUrl = msg.mediaUrl ? `/api/media/${msg.mediaUrl}` : '#';
                    return (
                        <a key={msg.id} href={secureMediaUrl} download={msg.content || ''} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600/50 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500 dark:text-indigo-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2-2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{msg.content || 'File'}</p>
                        </a>
                    );
                })}
            </div>
        )
    };

    return (
        <div className="h-full flex flex-col">
            {mediaViewerState && <MediaViewerModal items={mediaViewerState.items} startIndex={mediaViewerState.startIndex} onClose={() => setMediaViewerState(null)} />}

            <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-900/50 rounded-lg p-1 mb-4 flex-shrink-0">
                <TabButton tabId="image" label={t('media.tabs.imagesAndVideos')} />
                <TabButton tabId="video_circle" label={t('media.tabs.videoMessages')} />
                <TabButton tabId="file" label={t('media.tabs.files')} />
                <TabButton tabId="audio" label={t('media.tabs.audio')} />
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
                {renderContent()}
            </div>
        </div>
    );
};

export default SharedMediaViewer;