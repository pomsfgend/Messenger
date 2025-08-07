import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

const translations = {
  en: {
    // Toasts
    "toast.loginSuccess": "Logged in successfully!",
    "toast.registerSuccess": "Registration successful!",
    "toast.profileUpdateSuccess": "Profile updated successfully!",
    "toast.profileUpdateError": "Failed to update profile.",
    "toast.profileUpdatePrompt": "Welcome! Please update your display name and unique ID in your profile.",
    "toast.telegramSuccess": "Telegram auth data received! See console for details.",
    "toast.telegramInfo": "Note: A backend is required to complete Telegram login.",
    // Login Page
    "login.welcome": "Welcome Back!",
    "login.signInPrompt": "Sign in to continue to Web Messenger",
    "login.username": "Username",
    "login.password": "Password",
    "login.signIn": "Sign In",
    "login.signingIn": "Signing In...",
    "login.or": "Or",
    "login.telegram": "Sign In with Telegram",
    "login.noAccount": "Don't have an account?",
    "login.signUp": "Sign up",
    "login.usernameRequired": "Please enter username and password.",
    "login.invalidCredentials": "Invalid username or password",
    "login.guestUsername": "Guest Username",
    "login.guestUsernameRequired": "Please enter a guest username.",
    "login.guestSignIn": "Enter as Guest",
    // Register Page
    "register.createAccount": "Create Account",
    "register.joinPrompt": "Join Web Messenger today!",
    "register.loginUsername": "Login Username",
    "register.password": "Password",
    "register.confirmPassword": "Confirm Password",
    "register.creatingAccount": "Creating Account...",
    "register.signUp": "Sign Up",
    "register.allFieldsRequired": "Username and password are required.",
    "register.passwordsDoNotMatch": "Passwords do not match.",
    "register.usernameExists": "Username already exists",
    "register.hasAccount": "Already have an account?",
    "register.signIn": "Sign in",
    // Sidebar
    "sidebar.searchPlaceholder": "Search by unique ID...",
    "sidebar.userNotFound": "User not found",
    "sidebar.globalChat": "Global Chat",
    "sidebar.globalChatDesc": "Public discussion room",
    "sidebar.dm": "Direct message",
    "sidebar.settings": "Settings",
    "sidebar.logout": "Logout",
    // Chat Window
    "chat.selectPrompt": "Select a chat to start messaging",
    "chat.loading": "Loading chat...",
    "chat.loadError": "Failed to load chat data.",
    "chat.everyone": "Everyone in the chat",
    "chat.activeNow": "Active now",
    "chat.typeMessage": "Type a message...",
    "chat.you": "You",
    "chat.unknownUser": "Unknown User",
    // Profile Page
    "profile.title": "Your Profile",
    "profile.subtitle": "Manage your account details.",
    "profile.displayName": "Display Name",
    "profile.uniqueId": "Unique ID",
    "profile.uniqueIdTaken": "Unique ID is already taken.",
    "profile.gender": "Gender",
    "profile.dob": "Date of Birth",
    "profile.gender.pnts": "Prefer not to say",
    "profile.gender.male": "Male",
    "profile.gender.female": "Female",
    "profile.gender.other": "Other",
    "profile.backToChat": "Back to Chat",
    "profile.save": "Save Changes",
    "profile.saving": "Saving...",
    "profile.actions": "Account Actions",
    "profile.actionsSubtitle": "Need to change your login credentials?",
    "profile.changePassword": "Change Password",
    "profile.logout": "Log Out",
  },
  ru: {
    // Toasts
    "toast.loginSuccess": "Вход выполнен успешно!",
    "toast.registerSuccess": "Регистрация прошла успешно!",
    "toast.profileUpdateSuccess": "Профиль успешно обновлен!",
    "toast.profileUpdateError": "Не удалось обновить профиль.",
    "toast.profileUpdatePrompt": "Добро пожаловать! Пожалуйста, укажите ваше имя и уникальный ID в профиле.",
    "toast.telegramSuccess": "Данные от Telegram получены! Подробности в консоли.",
    "toast.telegramInfo": "Примечание: Для завершения входа через Telegram требуется бэкенд.",
    // Login Page
    "login.welcome": "С возвращением!",
    "login.signInPrompt": "Войдите, чтобы продолжить в Web Messenger",
    "login.username": "Имя пользователя",
    "login.password": "Пароль",
    "login.signIn": "Войти",
    "login.signingIn": "Вход...",
    "login.or": "Или",
    "login.telegram": "Войти через Telegram",
    "login.noAccount": "Нет аккаунта?",
    "login.signUp": "Зарегистрироваться",
    "login.usernameRequired": "Пожалуйста, введите имя пользователя и пароль.",
    "login.invalidCredentials": "Неверное имя пользователя или пароль",
    "login.guestUsername": "Имя гостя",
    "login.guestUsernameRequired": "Пожалуйста, введите имя гостя.",
    "login.guestSignIn": "Войти как гость",
    // Register Page
    "register.createAccount": "Создать аккаунт",
    "register.joinPrompt": "Присоединяйтесь к Web Messenger сегодня!",
    "register.loginUsername": "Имя пользователя для входа",
    "register.password": "Пароль",
    "register.confirmPassword": "Подтвердите пароль",
    "register.creatingAccount": "Создание аккаунта...",
    "register.signUp": "Зарегистрироваться",
    "register.allFieldsRequired": "Требуется имя пользователя и пароль.",
    "register.passwordsDoNotMatch": "Пароли не совпадают.",
    "register.usernameExists": "Имя пользователя уже занято",
    "register.hasAccount": "Уже есть аккаунт?",
    "register.signIn": "Войти",
    // Sidebar
    "sidebar.searchPlaceholder": "Поиск по уникальному ID...",
    "sidebar.userNotFound": "Пользователь не найден",
    "sidebar.globalChat": "Общий чат",
    "sidebar.globalChatDesc": "Публичная комната для обсуждений",
    "sidebar.dm": "Личное сообщение",
    "sidebar.settings": "Настройки",
    "sidebar.logout": "Выйти",
    // Chat Window
    "chat.selectPrompt": "Выберите чат, чтобы начать общение",
    "chat.loading": "Загрузка чата...",
    "chat.loadError": "Не удалось загрузить данные чата.",
    "chat.everyone": "Все в чате",
    "chat.activeNow": "В сети",
    "chat.typeMessage": "Введите сообщение...",
    "chat.you": "Вы",
    "chat.unknownUser": "Неизвестный пользователь",
    // Profile Page
    "profile.title": "Ваш профиль",
    "profile.subtitle": "Управляйте данными своего аккаунта.",
    "profile.displayName": "Отображаемое имя",
    "profile.uniqueId": "Уникальный ID",
    "profile.uniqueIdTaken": "Этот уникальный ID уже занят.",
    "profile.gender": "Пол",
    "profile.dob": "Дата рождения",
    "profile.gender.pnts": "Предпочитаю не указывать",
    "profile.gender.male": "Мужской",
    "profile.gender.female": "Женский",
    "profile.gender.other": "Другой",
    "profile.backToChat": "Вернуться в чат",
    "profile.save": "Сохранить изменения",
    "profile.saving": "Сохранение...",
    "profile.actions": "Действия с аккаунтом",
    "profile.actionsSubtitle": "Хотите изменить свои данные для входа?",
    "profile.changePassword": "Изменить пароль",
    "profile.logout": "Выйти",
  }
};

type Language = 'en' | 'ru';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const savedLang = localStorage.getItem('messenger_language');
    return (savedLang === 'en' || savedLang === 'ru') ? savedLang : 'ru';
  });

  useEffect(() => {
    localStorage.setItem('messenger_language', language);
  }, [language]);
  
  const t = useCallback((key: keyof typeof translations.en): string => {
    return translations[language][key] || translations.en[key];
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