
declare global {
    interface Window {
        Telegram?: any;
        onTelegramAuth: (user: any) => void;
        onTelegramAuthEnable2FA: (user: any) => void;
    }
}

// This empty export makes the file a module.
export {}