import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ChatContact } from '../types';
import { useI18n } from '../hooks/useI18n';

interface SidebarContextMenuProps {
    x: number;
    y: number;
    contact: ChatContact;
    onClose: () => void;
}

const SidebarContextMenu: React.FC<SidebarContextMenuProps> = ({ x, y, contact, onClose }) => {
    const { currentUser } = useAuth();
    const { t } = useI18n();
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: y, left: x });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);
    
    useEffect(() => {
        if (menuRef.current) {
            const menuWidth = menuRef.current.offsetWidth;
            const menuHeight = menuRef.current.offsetHeight;
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            let newX = x;
            let newY = y;
            
            if (x + menuWidth > screenWidth) newX = x - menuWidth;
            if (y + menuHeight > screenHeight) newY = y - menuHeight;
            
            setPosition({ top: newY, left: newX });
        }
    }, [x, y, menuRef]);

    const handleOpenInNewWindow = () => {
        if (!currentUser) return;
        const chatId = [currentUser.id, contact.id].sort().join('-');
        const url = `/app/chat-standalone/${chatId}`;
        const windowFeatures = 'width=800,height=700,menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes,status=no';
        window.open(url, `_blank_chat_${chatId}`, windowFeatures);
        onClose();
    };

    return (
        <div
            ref={menuRef}
            className="fixed bg-white dark:bg-slate-700 rounded-lg shadow-xl z-[150] overflow-hidden ring-1 ring-black/5 animate-fade-in-up py-1"
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
            <button
                onClick={handleOpenInNewWindow}
                className="block w-full text-left px-4 py-2 text-sm transition-colors text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
            >
                {t('contextMenu.openInNewWindow')}
            </button>
        </div>
    );
};

export default SidebarContextMenu;