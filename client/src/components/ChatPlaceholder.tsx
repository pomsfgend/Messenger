import React from 'react';
import { useI18n } from '../hooks/useI18n';

interface ChatPlaceholderProps {
    onToggleSidebar: () => void;
}

const ChatPlaceholder: React.FC<ChatPlaceholderProps> = ({ onToggleSidebar }) => {
    const { t } = useI18n();
    return (
        <div className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-slate-900">
             <header className="flex-shrink-0 flex items-center p-3 border-b border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md">
                 <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                </button>
             </header>
             <main className="flex-1 flex flex-col justify-center items-center text-center p-4">
                <div className="max-w-xs mx-auto">
                    <div className="w-24 h-24 text-slate-400 dark:text-slate-500 mx-auto">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.455.09-.934.09-1.425v-2.287a3.75 3.75 0 00-.616-2.023a4.501 4.501 0 01-1.354-3.284A8.25 8.25 0 0112 3.75a8.25 8.25 0 019 9z" />
                         </svg>
                    </div>
                    <p className="mt-4 text-slate-600 dark:text-slate-400 font-semibold">{t('chat.selectPrompt')}</p>
                </div>
            </main>
        </div>
    );
};

export default ChatPlaceholder;