
import React, { useState, useEffect } from 'react';
import type { User, ChatContact } from '../types';

interface AvatarProps {
    user: Partial<User & ChatContact>;
    size?: 'small' | 'large' | 'default';
}

const Avatar: React.FC<AvatarProps> = ({ user, size = 'default' }) => {
    const name = user.name || '?';
    const avatarUrl = user.avatarUrl;
    
    const [imageError, setImageError] = useState(false);

    // If avatarUrl changes, we should reset the error state.
    useEffect(() => {
        setImageError(false);
    }, [avatarUrl]);

    const getAvatarSrc = () => {
        if (!avatarUrl) return null;
        if (avatarUrl.startsWith('blob:') || avatarUrl.startsWith('http')) {
            return avatarUrl;
        }
        // Sanitize to prevent double prefixes
        const filename = avatarUrl.split('/').pop();
        return `/api/media/${filename}`;
    };

    const avatarSrc = getAvatarSrc();
    const isVideo = avatarSrc && (avatarSrc.toLowerCase().endsWith('.mp4') || avatarSrc.toLowerCase().endsWith('.webm'));

    const sizeClasses = {
        small: 'w-8 h-8 text-sm',
        default: 'w-10 h-10 text-base',
        large: 'w-32 h-32 text-5xl',
    }[size];
    
    const onlineIndicatorSize = {
        small: 'w-2 h-2',
        default: 'w-2.5 h-2.5',
        large: 'w-5 h-5',
    }[size];
    
    const onlineIndicatorPosition = {
        small: 'bottom-0 right-0',
        default: 'bottom-0 right-0',
        large: 'bottom-2 right-2',
    }[size];

    const renderInitials = () => {
        const words = name.split(' ').filter(Boolean);
        if (words.length > 1) {
            return `${words[0][0]}${words[1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div className={`relative flex-shrink-0 ${sizeClasses}`}>
            {avatarSrc && !imageError ? (
                isVideo ? (
                    <video
                        src={avatarSrc}
                        onError={() => setImageError(true)}
                        className="w-full h-full rounded-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                        key={avatarSrc} // Add key to force re-render on src change
                    />
                ) : (
                    <img
                        src={avatarSrc}
                        alt={`${name}'s avatar`}
                        onError={() => setImageError(true)}
                        className="w-full h-full rounded-full object-cover"
                    />
                )
            ) : (
                <div 
                    className="w-full h-full rounded-full flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: user.profile_color || 'rgb(var(--color-accent-primary))' }}
                >
                    {renderInitials()}
                </div>
            )}
            {user.isOnline && (
                <span 
                    className={`absolute border-2 border-white dark:border-slate-800 rounded-full bg-green-500 ${onlineIndicatorSize} ${onlineIndicatorPosition}`}
                    title="Online"
                />
            )}
        </div>
    );
};

export default Avatar;