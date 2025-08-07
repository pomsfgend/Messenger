
import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { translations, TranslationKey as TKey } from '../i18n';

type Language = 'en' | 'ru';
export type TranslationKey = TKey;


interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, options?: { [key: string]: string | number }) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const savedLang = localStorage.getItem('messenger_language');
    // Default to Russian if no valid language is saved, as requested.
    return (savedLang === 'en' || savedLang === 'ru') ? savedLang : 'ru';
  });

  useEffect(() => {
    localStorage.setItem('messenger_language', language);
    document.documentElement.lang = language;
  }, [language]);
  
  const t = useCallback((key: TranslationKey, options?: { [key: string]: string | number }): string => {
    let translation: string = translations[language][key] || translations.en[key] || key;
    if (options) {
        Object.keys(options).forEach(optionKey => {
            translation = translation.replace(`{{${optionKey}}}`, String(options[optionKey]));
        });
    }
    return translation;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};