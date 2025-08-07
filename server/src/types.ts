
import 'multer';

export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'video_circle';

export type ReactionMap = {
    [emoji: string]: string[]; // emoji -> array of user IDs
};

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: MessageType;
  mediaUrl?: string;
  mediaMimetype?: string;
  isEdited: boolean;
  isDeleted: boolean;
  reactions?: ReactionMap;
  tempId?: string; // Used for optimistic UI updates
  forwardedInfo?: {
    originalSenderName: string;
  }
}

export interface User {
    id: string;
    username: string;
    name?: string;
    uniqueId?: string;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    dob?: string;
    createdAt: string;
    telegram_id?: string;
    telegramId?: string;
    phone_number?: string;
    phoneNumber?: string;
    is_anonymous: number;
    isAnonymous?: boolean;
    avatar_url?: string;
    avatarUrl?: string;
    profile_setup: number;
    profileSetup?: boolean;
    role: 'user' | 'admin' | 'moderator';
    google_id?: string;
    googleId?: string;
    is_banned: number;
    isBanned?: boolean;
    ban_reason?: string;
    banReason?: string;
    ban_expires_at?: string;
    banExpiresAt?: string;
    mute_expires_at?: string;
    muteExpiresAt?: string;
    mute_reason?: string;
    muteReason?: string;
    last_seen?: string | null;
    lastSeen?: string | null;
    profile_color?: string;
    message_color?: string;
    description?: string;
    profile_emoji?: string;
    profile_emoji_density?: number;
    profile_emoji_rotation?: number;
    privacy_show_phone: number;
    privacy_show_telegram: number;
    privacy_show_dob: number;
    privacy_show_description: number;
    privacy_show_last_seen: number;
    privacy_show_typing: number;
    lastMessageContent?: string;
    lastMessageSenderId?: string;
    lastMessageTimestamp?: string;
    lastMessageType?: MessageType;
    lastMessageIsDeleted?: boolean;
}

export interface AvatarData {
    id: string;
    userId: string;
    filename: string;
    createdAt: string;
    mimetype?: string;
}

// Declaration merging for Express's Request object
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
    }
  }
}