import React, { useEffect, useRef, useState } from 'react';

export interface Action {
    label: string;
    action: () => void;
    isDestructive?: boolean;
}

interface MessageContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    actions: (Action | false | undefined)[];
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({ x, y, onClose, actions }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: y, left: x, opacity: 0 });

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
            
            if (x + menuWidth > screenWidth - 10) {
                newX = x - menuWidth;
            }
            
            if (y + menuHeight > screenHeight - 10) {
                newY = y - menuHeight;
            }

            if (newX < 10) newX = 10;
            if (newY < 10) newY = 10;
            
            setPosition({ top: newY, left: newX, opacity: 1 });
        }
    }, [x, y, menuRef]);

    const validActions = actions.filter(Boolean) as Action[];

    if (validActions.length === 0) {
        onClose();
        return null;
    }

    return (
        <div
            ref={menuRef}
            className="fixed bg-white dark:bg-slate-700 rounded-lg shadow-xl z-[150] text-left overflow-hidden ring-1 ring-black/5 animate-fade-in-up py-1 transition-opacity"
            style={{ top: `${position.top}px`, left: `${position.left}px`, opacity: position.opacity }}
        >
            {validActions.map(({ label, action, isDestructive }) => (
                <button
                    key={label}
                    onClick={(e) => {
                        e.stopPropagation();
                        action();
                        onClose();
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                        isDestructive 
                        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20' 
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600'
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
};

export default MessageContextMenu;
