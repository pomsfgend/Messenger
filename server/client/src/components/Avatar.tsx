
import React, { useState, useEffect } from 'react';
import type { User, ChatContact } from '../types';

interface AvatarProps {
    user: Partial<User & ChatContact>;
    size?: 'small' | 'large' | 'default';
    forcePreview?: boolean; // Used for ProfilePage preview
}

const Avatar: React.FC<AvatarProps> = ({ user, size = 'default', forcePreview = false }) => {
    const name = user.name || '?';
    const rawAvatarUrl = user.avatarUrl;
    
    const [avatarSrc, setAvatarSrc] = useState<string | undefined | null>(null);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        setImageError(false);
        if (rawAvatarUrl) {
            if (rawAvatarUrl.startsWith('blob:') || forcePreview) {
                // It's a local preview URL, use it directly
                setAvatarSrc(rawAvatarUrl);
            } else {
                // It's a server filename, construct the secure URL and bust cache
                const secureUrl = `/api/media/${rawAvatarUrl}?v=${Date.now()}`;
                setAvatarSrc(secureUrl);
            }
        } else {
            setAvatarSrc(null);
        }
    }, [rawAvatarUrl, forcePreview]);

    const sizeClasses = {
        small: 'w-8 h-8 text-sm',
        default: 'w-10 h-10 text-base',
        large: 'w-24 h-24 text-4xl',
    }[size];

    if (avatarSrc && !imageError) {
        return (
            <img 
                src={avatarSrc} 
                alt={name}
                className={`${sizeClasses} rounded-full flex-shrink-0 object-cover bg-slate-700`}
                onError={() => setImageError(true)}
            />
        );
    }
    
    // Fallback to initials
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const color = `hsl(${hash % 360}, 50%, 40%)`;
    
    return (
        <div className={`${sizeClasses} rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold`} style={{ backgroundColor: color }}>
            {name.charAt(0).toUpperCase()}
        </div>
    );
};

export default Avatar;
