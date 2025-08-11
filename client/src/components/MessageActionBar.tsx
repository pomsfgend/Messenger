import React from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../hooks/useI18n';
import { FaTrash, FaShare, FaTimes } from 'react-icons/fa';

interface MessageActionBarProps {
    selectedCount: number;
    onCancel: () => void;
    onDelete: () => void;
    onForward: () => void;
}

const MessageActionBar: React.FC<MessageActionBarProps> = ({
    selectedCount,
    onCancel,
    onDelete,
    onForward,
}) => {
    const { t } = useI18n();

    return (
        <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md z-20 flex items-center justify-between px-4 shadow-md"
        >
            <div className="flex items-center gap-4">
                <button onClick={onCancel} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                    <FaTimes className="text-xl" />
                </button>
                <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
                    {t('common.selectedCount', { count: selectedCount })}
                </span>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={onForward}
                    className="flex items-center gap-2 text-sm font-semibold p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                    title={t('chat.forward')}
                >
                    <FaShare className="text-lg" />
                </button>
                <button
                    onClick={onDelete}
                    className="flex items-center gap-2 text-sm font-semibold p-2 rounded-full text-red-500 hover:bg-red-500/10"
                    title={t('common.delete')}
                >
                    <FaTrash className="text-lg" />
                </button>
            </div>
        </motion.div>
    );
};

export default MessageActionBar;