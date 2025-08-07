
import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../hooks/useI18n';

interface VideoPlayerProps {
    src: string;
    isCircle?: boolean;
}

const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, isCircle = false }) => {
    const { t } = useI18n();
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            setProgress((video.currentTime / video.duration) * 100);
        };
        const handleLoadedMetadata = () => setDuration(video.duration);

        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current?.paused) {
            videoRef.current?.play();
        } else {
            videoRef.current?.pause();
        }
    };

    const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const seekTime = ((e.clientX - rect.left) / rect.width) * duration;
        video.currentTime = seekTime;
    };


    return (
        <div ref={containerRef} className={`relative w-full h-full group bg-black flex items-center justify-center ${isCircle ? 'aspect-square' : ''}`}>
            <video 
                ref={videoRef} 
                src={src} 
                className={`w-full h-full ${isCircle ? 'rounded-full object-cover' : 'object-contain'}`}
                onClick={togglePlay} 
            />

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" onClick={e => e.stopPropagation()}>
                {/* Progress Bar */}
                <div className="w-full h-1 bg-white/30 cursor-pointer rounded-full" onClick={handleProgressSeek}>
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
                </div>
                {/* Controls */}
                <div className="flex items-center justify-between text-white mt-2">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="p-2">
                             {isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                            )}
                        </button>
                        <span className="text-xs font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
                    </div>
                    {/* Fullscreen button removed as per request. The main viewer has one. */}
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;