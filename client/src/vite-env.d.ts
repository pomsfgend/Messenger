/// <reference types="vite/client" />

declare global {
    interface Window {
        Telegram?: {
            WebApp?: any;
        };
        onTelegramAuth: (user: any) => void;
        onTelegramAuthEnable2FA: (user: any) => void;
    }
}

// This empty export makes the file a module.
export {}
