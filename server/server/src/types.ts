
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file';
  mediaUrl?: string;
  mediaMimetype?: string;
}
