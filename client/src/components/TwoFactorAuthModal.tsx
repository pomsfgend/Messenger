import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

interface TwoFactorAuthModalProps {
    userId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const TwoFactorAuthModal: React.FC<TwoFactorAuthModalProps> = ({ userId, onClose, onSuccess }) => {
    const { loginWith2FA } = useAuth();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const modalRef = useRef<HTMLFormElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const modalId = '2fa-login';
    const { transform } = useDraggable(modalRef, handleRef, modalId);
    const { size } = useResizable(modalRef, modalId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await loginWith2FA(userId, code);
            onSuccess();
        } catch (error) {
            toast.error("Неверный или истекший код подтверждения.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-4" onClick={onClose}>
            <form 
                ref={modalRef}
                onSubmit={handleSubmit} 
                className="soft-panel bg-slate-50 dark:bg-slate-800 w-full max-w-sm p-8 space-y-6 animate-fade-in-up" 
                onClick={e => e.stopPropagation()}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px)`,
                    width: size.width ? `${size.width}px` : 'min(90vw, 384px)',
                    height: size.height ? `${size.height}px` : 'auto',
                    minWidth: '320px',
                }}
            >
                <div ref={handleRef} className="text-center cursor-move">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Требуется подтверждение</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                        Мы отправили код подтверждения в ваш Telegram. Пожалуйста, введите его ниже.
                    </p>
                </div>
                
                <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={6}
                    className="w-full bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg p-4 text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="_ _ _ _ _ _"
                    autoFocus
                />

                <div className="flex flex-col sm:flex-row-reverse gap-4 pt-4">
                    <button type="submit" disabled={loading || code.length < 6} className="w-full btn-primary py-3">
                        {loading ? 'Проверка...' : 'Войти'}
                    </button>
                     <button type="button" onClick={onClose} className="w-full bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                        Отмена
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TwoFactorAuthModal;