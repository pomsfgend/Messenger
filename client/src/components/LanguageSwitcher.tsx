
import React from 'react';
import { useI18n } from '../hooks/useI18n';

const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useI18n();
    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'ru' : 'en');
    };
    return (
         <button 
            onClick={toggleLanguage} 
            className="p-2 rounded-full hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors w-9 h-9 flex items-center justify-center"
            title={language === 'en' ? "Сменить на русский" : "Switch to English"}
        >
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{language.toUpperCase()}</span>
        </button>
    )
};

export default LanguageSwitcher;