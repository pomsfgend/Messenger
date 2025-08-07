
export interface User {
  id: string;
  uniqueId: string;
  username: string;
  password?: string; // Should not be sent to client
  name: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  dob?: string; // date of birth
  createdAt: string;
  avatarUrl?: string;
  profileSetup?: boolean;
  avatarFile?: File; // For client-side handling of new avatar uploads
}

export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'file';

export interface Message {
  id: string;
  chatId: string; // 'global' or a user ID for private chats
  senderId: string;
  content: string;
  timestamp: string;
  type: MessageType;
  mediaUrl?: string;
  isTyping?: boolean;
}

export interface ChatContact {
  id:string;
  name: string;
  type: 'global' | 'private';
  avatarUrl?: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
}
