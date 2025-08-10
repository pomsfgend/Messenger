// WARNING: Hardcoding configuration is not recommended for production environments.
// This is done to simplify setup as requested by the user.
import crypto from 'crypto';

export const config = {
    JWT_SECRET: "142356124_gemVFFhgjjj",
    GOOGLE_CLIENT_ID: "329920739796-t5ql5j0mgcjoq3at9hk7umh3efjoib35.apps.googleusercontent.com",
    ADMIN_IDS: ["romadanilov2000"],
    TELEGRAM_BOT_TOKEN: "8138920373:AAEbcoXG_scfnoqQCqsskkIduJJ1k5FZHj8",
    TELEGRAM_GATEWAY_TOKEN: "AAECIAAArgRG8oaO7PZjS2gcteImfmNmq-_IhpgitDyqHw",
    VAPID_PUBLIC_KEY: "BOeHOKUcqQOFxj4JoJOdIhuUIEerEiyZhlbJuRuCT9XKDASRpz5dhDV-4AID3X9bY5vZXObnfiEsQD5Uo1DprQs",
    VAPID_PRIVATE_KEY: "8BW9TZKg6uhymVjzW9wgKNv4kirl51tPdYXC_Q9C8Pg",
    FFMPEG_PATH: "C:/Users/g2g/Desktop/мессенджер/ffmpeg-master-latest-win64-gpl-shared/bin/ffmpeg.exe",
    FFPROBE_PATH: "C:/Users/g2g/Desktop/мессенджер/ffmpeg-master-latest-win64-gpl-shared/bin/ffprobe.exe",
    PORT: 5173,
    USE_HTTPS: process.env.USE_HTTPS === 'true', 
    
    TURN_PUBLIC_IP: "46.187.124.166", 
    TURN_USERNAME: "bulkhead",
    TURN_PASSWORD: crypto.randomBytes(16).toString('hex')
};