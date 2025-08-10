import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Message } from '../types';
import VideoPlayer from './VideoPlayer';
import { useI18n } from '../hooks/useI18n';
import { processVideoCircleForDownload } from '../utils/mediaProcessor';
import toast from 'react-hot-toast';

interface MediaViewerModalProps {
    items: Message[];
    startIndex: number;
    onClose: () => void;
}

const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ items, startIndex, onClose }) => {
    const { t } = useI18n();
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const mediaContainerRef = useRef<HTMLDivElement>(null);
    const currentItem = items[currentIndex];

    const showNext = useCallback(() => {
        setCurrentIndex(prev => (prev + 1) % items.length);
    }, [items.length]);

    const showPrev = useCallback(() => {
        setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
    }, [items.length]);
    
    const toggleFullscreen = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        const elem = mediaContainerRef.current;
        if (!elem) return;

        try {
            if (!document.fullscreenElement) {
                elem.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        } catch (err: any) {
             console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        }
    };
    
    const handleDownload = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentItem || !currentItem.mediaUrl) return;

        const secureUrl = `/api/media/${currentItem.mediaUrl}`;

        if (currentItem.type === 'video_circle') {
            setIsProcessing(true);
            setProgress(0);
            try {
                await processVideoCircleForDownload(secureUrl, setProgress);
            } catch (error) {
                // Error toast is handled within the processor for fallback case.
                console.error(error);
            } finally {
                setIsProcessing(false);
            }
        } else {
            // Standard download for other media types
            const a = document.createElement('a');
            a.href = secureUrl;
            a.download = currentItem.content || `media-${Date.now()}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }, [currentItem]);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') showNext();
            if (e.key === 'ArrowLeft') showPrev();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showNext, showPrev, onClose]);

    if (!currentItem) return null;
    
    const secureMediaUrl = `/api/media/${currentItem.mediaUrl}`;
    const isVideoCircle = currentItem.type === 'video_circle';

    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex flex-col items-center justify-center animate-fade-in" onClick={onClose}>
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/50 to-transparent flex items-center justify-between p-4 text-white z-10" onClick={e => e.stopPropagation()}>
                <div className="font-semibold">{`${currentIndex + 1} / ${items.length}`}</div>
                <div className="flex items-center gap-4">
                    <button onClick={handleDownload} disabled={isProcessing} title={t('common.download')} className="p-2 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                    <button onClick={toggleFullscreen} title={t('media.fullscreen')} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" /></svg>
                    </button>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="w-full h-full flex items-center justify-center p-4" onClick={e => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
                <div ref={mediaContainerRef} className="w-full h-full flex items-center justify-center">
                    {currentItem.type.startsWith('video') ? (
                         <div className={`relative flex items-center justify-center ${isVideoCircle ? 'w-[90vmin] h-[90vmin]' : 'w-full h-full'}`}>
                            <VideoPlayer src={secureMediaUrl} isCircle={isVideoCircle} />
                        </div>
                    ) : (
                        <img src={secureMediaUrl} alt={currentItem.content || 'Shared media'} className="max-w-full max-h-full object-contain" />
                    )}
                </div>
            </div>
            
             {isProcessing && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/80 p-3 rounded-lg text-white text-sm flex flex-col items-center">
                    <p>Обработка видео... {progress}%</p>
                    <div className="w-40 h-1.5 bg-slate-600 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}></div>
                    </div>
                </div>
            )}


            {/* Navigation */}
            <button onClick={(e) => { e.stopPropagation(); showPrev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); showNext(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>
    );
};

export default MediaViewerModal;
