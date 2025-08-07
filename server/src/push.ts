import webpush from 'web-push';
import { config } from './config';

export const initializePush = () => {
    if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) {
        console.warn("⚠️ WARNING: VAPID keys not found in config.ts. Push notifications will be disabled.");
        return false;
    }
    
    webpush.setVapidDetails(
        'mailto:admin@bulkhead.example.com',
        config.VAPID_PUBLIC_KEY,
        config.VAPID_PRIVATE_KEY
    );
    console.log("✅ Web Push notifications initialized.");
    return true;
}

export const push = webpush;
