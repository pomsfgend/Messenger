
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'video_circle';

export type ReactionMap = {
    [emoji: string]: string[]; // emoji -> array of user IDs
};

export interface User {
  id: string;
  username: string;
  name?: string;
  uniqueId?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  dob?: string;
  createdAt: string;
  telegramId?: string; // Corrected to camelCase
  phoneNumber?: string; // Corrected to camelCase
  is_anonymous?: boolean;
  avatarUrl?: string;
  profileSetup?: boolean;
  role?: 'user' | 'admin' | 'moderator';
  is_banned?: boolean;
  ban_reason?: string;
  ban_expires_at?: string;
  google_id?: string | null;
  lastSeen?: string | null;
  isOnline?: boolean;
  mute_expires_at?: string | null;
  mute_reason?: string;
  profile_color?: string;
  message_color?: string;
  description?: string;
  profile_emoji?: string;
  profile_emoji_density?: number;
  profile_emoji_rotation?: number;
  privacy_show_phone?: boolean;
  privacy_show_telegram?: boolean;
  privacy_show_dob?: boolean;
  privacy_show_description?: boolean;
  privacy_show_last_seen?: boolean;
  privacy_show_typing?: boolean;
  isEffectivelyBanned?: boolean; // Client-side flag for rendering ban screen
  is_2fa_enabled?: boolean;
}

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
  tempId?: string;
  forwardedInfo?: {
    originalSenderName: string;
  },
  readBy?: string[];
}

export interface ChatContact extends User { // Extend User to inherit all its properties
  type: 'private' | 'global';
  lastMessageContent?: string;
  lastMessageSenderId?: string;
  lastMessageTimestamp?: string;
  lastMessageType?: MessageType;
  lastMessageIsDeleted?: boolean;
  is_muted?: boolean;
  unreadCount?: number;
}

export interface AvatarData {
    id: string;
    userId: string;
    filename: string;
    createdAt: string;
    mimetype?: string;
}