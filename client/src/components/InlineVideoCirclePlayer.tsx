
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface InlineVideoCirclePlayerProps {
    src: string;
    onPlaybackChange: (isScaled: boolean) => void;
    isOwn: boolean;
}

const InlineVideoCirclePlayer: React.FC<InlineVideoCirclePlayerProps> = ({ src, onPlaybackChange, isOwn }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playbackState, setPlaybackState] = useState<'preview' | 'playing' | 'paused'>('preview');
    const progress = useMotionValue(0);

    const handlePlaybackStateChange = useCallback((newState: 'preview' | 'playing' | 'paused') => {
        setPlaybackState(newState);
        const isScaled = newState !== 'preview';
        onPlaybackChange(isScaled);
    }, [onPlaybackChange]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        
        const handleEnded = () => {
            if (!video.loop) { // Main playback finished
                progress.set(0); // Reset progress for the next play
                video.muted = true;
                video.loop = true;
                video.play();
                handlePlaybackStateChange('preview');
            }
        };

        video.addEventListener('ended', handleEnded);
        return () => {
            video.removeEventListener('ended', handleEnded);
        };
    }, [handlePlaybackStateChange, progress]);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video || !isFinite(video.duration)) return;

        switch (playbackState) {
            case 'preview':
                video.pause();
                video.loop = false;
                video.muted = false;
                video.currentTime = 0;
                video.play().catch(err => console.error("Video play failed:", err));
                progress.set(0);
                animate(progress, 1, { duration: video.duration, ease: "linear" });
                handlePlaybackStateChange('playing');
                break;
            case 'playing':
                video.pause();
                progress.stop();
                handlePlaybackStateChange('paused');
                break;
            case 'paused':
                video.play().catch(err => console.error("Video play failed:", err));
                const remainingTime = video.duration - video.currentTime;
                animate(progress, 1, { duration: remainingTime, ease: "linear" });
                handlePlaybackStateChange('playing');
                break;
        }
    };
    
    const isScaled = playbackState !== 'preview';

    const radius = 48;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = useTransform(progress, (p: number) => circumference - p * circumference);

    const divVariants = {
        scaled: { 
            width: '15rem', // 240px
            height: '15rem',
            transition: { type: 'spring' as const, stiffness: 400, damping: 30 }
        },
        normal: { 
            width: '12rem', // 192px
            height: '12rem',
            transition: { type: 'spring' as const, stiffness: 400, damping: 30 }
        }
    };

    return (
        <motion.div 
            className="relative group rounded-full cursor-pointer shadow-lg"
            onClick={togglePlay}
            onContextMenu={(e) => e.preventDefault()}
            animate={isScaled ? divVariants.scaled : divVariants.normal}
        >
            <video 
                ref={videoRef}
                key={src}
                src={src} 
                playsInline 
                autoPlay
                muted
                loop
                className="w-full h-full object-cover rounded-full" 
            />
            {playbackState === 'preview' && (
                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity pointer-events-none opacity-0 group-hover:opacity-100 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
             <svg className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300 ${isScaled ? 'opacity-100' : 'opacity-0'}`} viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background track */}
                <circle
                    r={radius}
                    cx="50"
                    cy="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.2}
                    className="text-white/30"
                />
                {/* Progress indicator */}
                <motion.circle 
                    r={radius}
                    cx="50"
                    cy="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.2}
                    className="text-white"
                    strokeDasharray={circumference}
                    style={{ strokeDashoffset }}
                />
            </svg>
        </motion.div>
    );
};

export default InlineVideoCirclePlayer;
