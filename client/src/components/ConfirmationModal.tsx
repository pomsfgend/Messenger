import React, { useRef } from 'react';
import { useI18n } from '../hooks/useI18n';
import { useDraggable } from '../hooks/useDraggable';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    isLoading = false
}) => {
    const { t } = useI18n();
    const modalRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLHeadingElement>(null);
    const { transform } = useDraggable(modalRef, handleRef, 'confirmation');
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div
                ref={modalRef}
                style={{ transform: `translate(${transform.x}px, ${transform.y}px)` }}
                className="soft-panel bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 animate-fade-in-up"
                onClick={e => e.stopPropagation()}
            >
                <h2 ref={handleRef} className="text-xl font-bold text-slate-800 dark:text-white cursor-move">{title}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
                <div className="flex justify-end gap-4 pt-4">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-400/50"
                    >
                        {isLoading ? t('common.deleting') : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;