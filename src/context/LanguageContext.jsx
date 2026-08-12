import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../translations/translations.js';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('sigma_app_language') || 'en';
    });

    useEffect(() => {
        localStorage.setItem('sigma_app_language', language);
    }, [language]);

    const toggleLanguage = () => {
        setLanguage(prev => (prev === 'en' ? 'mr' : 'en'));
    };

    const t = (key) => {
        const dict = translations[language] || translations.en;
        return dict[key] || translations.en[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
