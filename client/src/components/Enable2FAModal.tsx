import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { clientConfig } from '../config';
import * as api from '../services/api';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

interface Enable2FAModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const Enable2FAModal: React.FC<Enable2FAModalProps> = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [code, setCode] = useState('');
    const [telegramUser, setTelegramUser] = useState<{ id: string } | null>(null);
    const telegramContainerRef = useRef<HTMLDivElement>(null);

    const modalRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLHeadingElement>(null);
    const modalId = 'enable-2fa';
    const { transform } = useDraggable(modalRef, handleRef, modalId);
    const { size } = useResizable(modalRef, handleRef, modalId);

    const handleTelegramAuth = useCallback(async (user: any) => {
        setLoading(true);
        try {
            const res = await api.enable2FARequest(user);
            setTelegramUser({ id: res.telegramId });
            setStep(2);
            toast.success("Код подтверждения отправлен в ваш Telegram!");
        } catch (error) {
            toast.error("Не удалось отправить код. Попробуйте еще раз.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        window.onTelegramAuthEnable2FA = handleTelegramAuth;
        const telegramBotUsername = clientConfig.TELEGRAM_BOT_USERNAME;
        if (telegramBotUsername && telegramContainerRef.current && step === 1) {
            const script = document.createElement('script');
            script.src = 'https://telegram.org/js/telegram-widget.js?22';
            script.async = true;
            script.setAttribute('data-telegram-login', telegramBotUsername);
            script.setAttribute('data-size', "large");
            script.setAttribute('data-radius', "12");
            script.setAttribute('data-onauth', "onTelegramAuthEnable2FA(user)");
            script.setAttribute('data-request-access', "write");

            telegramContainerRef.current.innerHTML = '';
            telegramContainerRef.current.appendChild(script);
        }
    }, [step, handleTelegramAuth]);

    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!telegramUser) return;
        setLoading(true);
        try {
            await api.enable2FAVerify(code, telegramUser.id);
            toast.success("Двухфакторная аутентификация успешно включена!");
            onSuccess();
        } catch (error) {
            toast.error("Неверный или истекший код.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-4" onClick={onClose}>
            <div 
                ref={modalRef}
                className="soft-panel bg-slate-50 dark:bg-slate-800 w-full max-w-md p-6 space-y-4 animate-fade-in-up" 
                onClick={e => e.stopPropagation()}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px)`,
                    width: size.width ? `${size.width}px` : 'min(90vw, 512px)',
                    height: size.height ? `${size.height}px` : 'auto',
                    minWidth: '320px',
                }}
            >
                <h2 ref={handleRef} className="text-xl font-bold text-slate-800 dark:text-white cursor-move">Включить двухфакторную аутентификацию</h2>
                
                {step === 1 && (
                    <div className="text-center space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Шаг 1: Войдите через Telegram, чтобы привязать свой аккаунт. Мы отправим код подтверждения в ваш Telegram.
                        </p>
                        <div ref={telegramContainerRef} className="min-h-[52px] w-full flex items-center justify-center">
                            {loading && <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <form onSubmit={handleVerifySubmit} className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Шаг 2: Введите 6-значный код, который мы отправили вам в Telegram.
                        </p>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            maxLength={6}
                            className="w-full bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-center text-lg tracking-[0.5em] font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="_ _ _ _ _ _"
                        />
                         <div className="flex justify-end gap-4 pt-4">
                            <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">Отмена</button>
                            <button type="submit" disabled={loading || code.length < 6} className="btn-primary py-2 px-6">
                                {loading ? 'Проверка...' : 'Подтвердить'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Enable2FAModal;