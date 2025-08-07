

import React, { useEffect, RefObject, useState } from 'react';

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
    menuRef: RefObject<HTMLDivElement>;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({ menuRef, x, y, onClose, actions }) => {
    const [position, setPosition] = useState({ top: y, left: x });

    useEffect(() => {
        if (menuRef.current) {
            const menuWidth = menuRef.current.offsetWidth;
            const menuHeight = menuRef.current.offsetHeight;
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            let newX = x;
            let newY = y;
            
            // Adjust horizontally if it overflows right
            if (x + menuWidth > screenWidth) {
                newX = x - menuWidth;
            }
            
            // Adjust vertically if it overflows bottom
            if (y + menuHeight > screenHeight) {
                newY = y - menuHeight;
            }
            
            setPosition({ top: newY, left: newX });
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
            className="fixed bg-white dark:bg-slate-700 rounded-lg shadow-xl z-[150] text-left overflow-hidden ring-1 ring-black/5 animate-fade-in-up py-1"
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
            {validActions.map(({ label, action, isDestructive }) => (
                <button
                    key={label}
                    onClick={() => {
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