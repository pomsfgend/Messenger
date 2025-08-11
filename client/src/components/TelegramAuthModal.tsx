import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as api from '../services/api';
import type { User } from '../types';
import { useNavigate } from 'react-router-dom';

export const TelegramAuthModal = () => {
    const { currentUser, updateCurrentUser } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'prompt' | 'loading' | 'success' | 'error'>('prompt');
    const [userName, setUserName] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const isTelegramWebApp = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData;
        if (isTelegramWebApp && currentUser === null) {
            setShowModal(true);
        }
    }, [currentUser]);

    const handleTelegramAuth = async () => {
        if (!window.Telegram?.WebApp?.initData) return;

        setIsLoading(true);
        setStatus('loading');
        try {
            const userData = await api.telegramWebAppLogin(window.Telegram.WebApp.initData);
            if (userData) {
                setUserName(userData.name || userData.username || '');
                updateCurrentUser(userData);
                setStatus('success');
                setTimeout(() => {
                    setShowModal(false);
                    navigate('/app', { replace: true });
                }, 2000);
            } else {
                throw new Error("User data not returned from API.");
            }
        } catch (error) {
            console.error('Telegram auth error:', error);
            setStatus('error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleClose = () => {
        setShowModal(false);
        navigate('/login', { replace: true });
    }

    if (!showModal) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[1000] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-6 shadow-2xl animate-fade-in-up">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394a.504.504 0 01-.742 0l-.213-.241-1.446-1.395-2.99 2.21c-.528.334-.958.168-1.085-.508l-1.97-9.28c-.238-.721.037-1.001.845-1.001l16.179.003c.748 0 .98.334.78 1.001z"/>
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Вход через Telegram</h2>
                </div>

                {status === 'loading' && (
                    <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        <p className="mt-3 text-gray-600 dark:text-gray-300">Проверяем данные...</p>
                    </div>
                )}
                
                {status === 'success' && (
                    <div className="text-center py-4">
                        <div className="text-green-500 mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Успешная авторизация!</h3>
                        <p className="text-gray-600 dark:text-gray-300 mt-2">Привет, {userName}!</p>
                        <p className="text-gray-500 text-sm mt-4">Перенаправляем вас...</p>
                    </div>
                )}

                {status === 'error' && (
                     <div className="text-center py-4">
                        <div className="text-red-500 mb-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Ошибка авторизации</h3>
                        <p className="text-gray-600 dark:text-gray-300 mt-2">Не удалось войти через Telegram. Пожалуйста, попробуйте обычный способ входа.</p>
                        <button onClick={handleClose} className="mt-4 bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg hover:bg-indigo-600 transition">
                            Продолжить
                        </button>
                    </div>
                )}

                {status === 'prompt' && (
                    <div className="flex flex-col gap-4">
                        <p className="text-center text-gray-600 dark:text-gray-300">
                            Продолжить, используя ваш аккаунт Telegram для входа или регистрации?
                        </p>
                        <button
                            onClick={handleTelegramAuth}
                            disabled={isLoading}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition"
                        >
                            Продолжить как пользователь Telegram
                        </button>
                        <button
                            onClick={handleClose}
                            className="border border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                        >
                            Войти другим способом
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
