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
            className="p-2 rounded-full bg-slate-700/50 hover:bg-slate-700 transition-all duration-300 text-sm font-bold w-10 h-10 flex items-center justify-center text-white shadow-lg backdrop-blur-sm transform hover:scale-110"
            title={language === 'en' ? "Сменить на русский" : "Switch to English"}
        >
            {language.toUpperCase()}
        </button>
    )
};

export default LanguageSwitcher;
