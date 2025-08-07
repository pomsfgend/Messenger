

import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
    src: string;
}

const formatTime = (timeInSeconds: number) => {
    if (!isFinite(timeInSeconds) || timeInSeconds < 0) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isLoading, setIsLoading] = useState(true);


    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        
        // Reset state for new src
        setIsPlaying(false);
        setDuration(0);
        setCurrentTime(0);
        setIsLoading(true);

        const handleCanPlay = () => {
            setIsLoading(false);
            if (audio.duration && isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener("canplay", handleCanPlay);
        audio.addEventListener("durationchange", handleCanPlay); // Catches duration changes
        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("ended", onEnded);

        // Manually trigger load for the new src
        audio.load();

        return () => {
            audio.removeEventListener("canplay", handleCanPlay);
            audio.removeEventListener("durationchange", handleCanPlay);
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("ended", onEnded);
        };
    }, [src]);

    const togglePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current && !isLoading) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(err => console.error("Audio play failed:", err));
            }
        }
    };
    
    const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const seekPosition = (e.clientX - rect.left) / rect.width;
        if (audioRef.current && isFinite(duration) && duration > 0) {
            audioRef.current.currentTime = seekPosition * duration;
        }
    };

    const progress = duration > 0 && isFinite(duration) ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex items-center gap-3 w-64 p-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg">
            <audio ref={audioRef} src={src} preload="metadata" />
            <button onClick={togglePlayPause} disabled={isLoading} className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors disabled:bg-slate-400">
                {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                )}
            </button>
            <div className="flex-grow flex flex-col justify-center">
                 <div className="w-full h-1.5 bg-slate-300 dark:bg-slate-500 rounded-full cursor-pointer group" onClick={handleProgressSeek}>
                    <div 
                        className="h-full bg-indigo-500 rounded-full relative" 
                        style={{ width: `${progress}%` }}
                    >
                         <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 text-right">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </div>
            </div>
        </div>
    );
};

export default AudioPlayer;