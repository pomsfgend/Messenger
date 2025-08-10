import crypto from 'crypto';
import { config } from '../config';

/**
 * Verifies the data received from the Telegram Web App.
 * @param initData The `initData` string from `window.Telegram.WebApp.initData`.
 * @returns The parsed user data if verification is successful, otherwise null.
 */
export const verifyTelegramWebAppData = (initData: string) => {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        const dataToCheck: string[] = [];
        
        // Collect all parameters except 'hash' for validation string
        params.forEach((val, key) => {
            if (key !== 'hash') {
                dataToCheck.push(`${key}=${val}`);
            }
        });
        
        // Sort alphabetically as required by Telegram
        dataToCheck.sort();
        const dataString = dataToCheck.join('\n');
        
        // Create the secret key from the bot token
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(config.TELEGRAM_BOT_TOKEN);
        
        // Calculate the hash of the data string
        const calculatedHash = crypto
            .createHmac('sha256', secretKey.digest())
            .update(dataString)
            .digest('hex');
        
        // Compare with the hash from Telegram
        if (calculatedHash !== hash) {
            console.warn("Telegram Web App data verification failed: hash mismatch.");
            return null;
        }
        
        const userData = JSON.parse(params.get('user') || '{}');
        return {
            id: userData.id,
            first_name: userData.first_name,
            last_name: userData.last_name,
            username: userData.username,
            photo_url: userData.photo_url
        };
    } catch (error) {
        console.error('Telegram Web App data verification error:', error);
        return null;
    }
};
