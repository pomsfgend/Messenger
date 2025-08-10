import type { User, Message, ChatContact, MessageType } from '../types';
import { AvatarData } from '../types';

const fetchApi = async (url: string, options: RequestInit = {}) => {
  const isFormData = options.body instanceof FormData;
  const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };
  const response = await fetch(url, { ...options, headers: { ...defaultHeaders, ...options.headers } });
  if (!response.ok) {
    let errorData;
    try { 
        errorData = await response.json();
        const err = new Error(errorData.message || 'An error occurred');
        (err as any).data = errorData;
        throw err;
    } 
    catch (e) { 
        if (e instanceof Error) throw e;
        throw new Error(response.statusText || 'An unknown network error occurred') 
    }
  }
  // Handle 202 Accepted for 2FA flow
  if (response.status === 202) {
      return response.json();
  }
  if (response.status === 204 || response.headers.get('Content-Length') === '0') return null;
  return response.json();
};

// --- Landing Page Stats API ---
export interface AppStats {
    dailySessions: number;
    leaks: number;
    uptime: string;
    thirdPartyShares: number;
}
export const getStats = (): Promise<AppStats> => fetchApi('/api/stats');


// --- User API ---
export const getMyChats = (): Promise<ChatContact[]> => fetchApi('/api/users/me/chats');
export const getUserByUniqueId = (uniqueId: string): Promise<User | undefined> => fetchApi(`/api/users/search?uniqueId=${uniqueId}`);
export const searchUsers = (query: string): Promise<User[]> => fetchApi(`/api/users/search?q=${encodeURIComponent(query)}`);
export const updateUser = (userData: Partial<User>): Promise<User> => fetchApi('/api/users/me', { method: 'PUT', body: JSON.stringify(userData) });
export const updateUserPrivacy = (settings: Partial<User>): Promise<User> => fetchApi('/api/users/me/privacy', { method: 'PUT', body: JSON.stringify(settings) });
export const getProfileByUniqueId = (uniqueId: string): Promise<User> => fetchApi(`/api/users/profile/${uniqueId}`);
export const deleteMyAccount = (): Promise<{ message: string }> => fetchApi('/api/users/me', { method: 'DELETE' });
export const getOnlineUsers = (): Promise<Pick<User, 'id' | 'name' | 'avatarUrl' | 'uniqueId' | 'profile_color' | 'message_color'>[]> => fetchApi('/api/users/online');
export const updateChatState = (chatId: string, state: { is_muted: boolean }): Promise<{ message: string }> => fetchApi(`/api/users/me/chats/${chatId}/state`, { method: 'PUT', body: JSON.stringify(state) });
export const leaveChat = (chatId: string): Promise<{ message: string }> => fetchApi(`/api/users/me/chats/${chatId}/leave`, { method: 'POST' });

// --- Avatar API (New & Overhauled) ---
export const uploadAvatar = (formData: FormData): Promise<AvatarData> => fetchApi('/api/users/me/avatar', { method: 'POST', body: formData });
export const getMyAvatars = (): Promise<AvatarData[]> => fetchApi('/api/users/me/avatars');
export const setPrimaryAvatar = (avatarId: string): Promise<{ message: string, avatarUrl: string }> => fetchApi(`/api/users/me/avatar/${avatarId}`, { method: 'PUT' });
export const deleteAvatar = (avatarId: string): Promise<{ message: string }> => fetchApi(`/api/users/me/avatar/${avatarId}`, { method: 'DELETE' });

// --- Auth API ---
export const login = (username: string, password: string): Promise<User> => fetchApi('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
export const anonymousLogin = (username: string): Promise<User> => fetchApi('/api/auth/anonymous-login', { method: 'POST', body: JSON.stringify({ username }) });
export const register = (username: string, password: string, name: string): Promise<User> => fetchApi('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, name }) });
export const googleLogin = (credential: string): Promise<User> => fetchApi('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
export const telegramLogin = (authData: any): Promise<User> => fetchApi('/api/auth/telegram-login', { method: 'POST', body: JSON.stringify(authData) });
export const telegramWebAppLogin = (initData: string): Promise<User> => fetchApi('/api/auth/telegram-webapp-login', { method: 'POST', body: JSON.stringify({ initData }) });
export const logout = (): Promise<void> => fetchApi('/api/auth/logout', { method: 'POST' });
export const checkSession = (): Promise<User> => fetchApi('/api/auth/me');
export const changePassword = (currentPassword: string, newPassword: string): Promise<{message: string}> => fetchApi('/api/users/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) });
export const phoneRequestCode = (phoneNumber: string, isRegistering: boolean): Promise<{ message: string }> => fetchApi('/api/auth/phone-request-code', { method: 'POST', body: JSON.stringify({ phoneNumber, isRegistering }) });
export const phoneVerifyCode = (phoneNumber: string, code: string): Promise<{ message: string }> => fetchApi('/api/auth/phone-verify-code', { method: 'POST', body: JSON.stringify({ phoneNumber, code }) });
export const phoneRegister = (phoneNumber: string, username: string, password: string):Promise<User> => fetchApi('/api/auth/phone-register', { method: 'POST', body: JSON.stringify({ phoneNumber, username, password })});
export const phoneLogin = (phoneNumber: string, code: string): Promise<User> => fetchApi('/api/auth/phone-login', { method: 'POST', body: JSON.stringify({ phoneNumber, code }) });
export const magicLinkLogin = (token: string): Promise<User> => fetchApi('/api/auth/magic-link-login', { method: 'POST', body: JSON.stringify({ token }) });
// --- 2FA API ---
export const enable2FARequest = (telegramAuthData: any): Promise<{ message: string, telegramId: string }> => fetchApi('/api/auth/2fa/enable-request', { method: 'POST', body: JSON.stringify(telegramAuthData) });
export const enable2FAVerify = (code: string, telegramId: string): Promise<{ message: string }> => fetchApi('/api/auth/2fa/enable-verify', { method: 'POST', body: JSON.stringify({ code, telegramId }) });
export const disable2FA = (): Promise<{ message: string }> => fetchApi('/api/auth/2fa/disable', { method: 'POST' });
export const login2FAVerify = (userId: string, code: string): Promise<User> => fetchApi('/api/auth/2fa/login-verify', { method: 'POST', body: JSON.stringify({ userId, code }) });

// --- Message API ---
export const getMessages = (chatId: string, limit?: number, before?: string): Promise<{ messages: Message[], users: Record<string, User>, hasMore: boolean }> => {
    let url = `/api/messages/${chatId}?`;
    if (limit) url += `limit=${limit}&`;
    if (before) url += `before=${encodeURIComponent(before)}&`;
    return fetchApi(url);
};

export const uploadChatFile = (
  formData: FormData, 
  onProgress?: (progress: number) => void
): { 
    promise: Promise<{ mediaUrl: string, type: string, originalName: string }>,
    cancel: () => void 
} => {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<{ mediaUrl: string, type: string, originalName: string }>((resolve, reject) => {
    xhr.open('POST', '/api/messages/upload', true);
    xhr.withCredentials = true; // Send cookies

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (onProgress) onProgress(100); // Ensure it completes to 100
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let errorData;
        try {
            errorData = JSON.parse(xhr.responseText);
            const err = new Error(errorData.message || 'An error occurred');
            (err as any).data = errorData;
            reject(err);
        } catch (e) {
            reject(new Error(xhr.statusText || 'An unknown network error occurred'));
        }
      }
    };
    
    xhr.onabort = () => {
        reject(new Error('Upload was cancelled'));
    }

    xhr.onerror = () => {
      reject(new Error('Network error during upload.'));
    };
    
    xhr.ontimeout = () => {
        reject(new Error('Upload timed out.'));
    };

    xhr.send(formData);
  });
  
  return {
      promise,
      cancel: () => xhr.abort()
  }
};

export const editMessage = (messageId: string, payload: { content: string, mediaUrl?: string, mediaMimetype?: string, type?: MessageType }): Promise<{ message: string }> => fetchApi(`/api/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteMessage = (messageId: string): Promise<{ message: string }> => fetchApi(`/api/messages/${messageId}`, { method: 'DELETE' });
export const reactToMessage = (messageId: string, reaction: string): Promise<{ message: string }> => fetchApi(`/api/messages/${messageId}/react`, { method: 'POST', body: JSON.stringify({ reaction }) });
export const getChatMedia = (chatId: string, type?: MessageType | 'all' | 'image' | 'file' | 'audio'): Promise<Message[]> => {
    let url = `/api/messages/${chatId}/media`;
    if (type && type !== 'all') {
        url += `?type=${type}`;
    }
    return fetchApi(url);
};
export const bulkDeleteMessages = (messageIds: string[]): Promise<{ message: string }> => fetchApi('/api/messages/bulk-delete', { method: 'POST', body: JSON.stringify({ messageIds }) });
export const forwardMessage = (messageId: string, targetChatIds: string[], hideSender: boolean): Promise<{ message: string }> => fetchApi('/api/messages/forward', { method: 'POST', body: JSON.stringify({ messageId, targetChatIds, hideSender }) });


// --- Admin API ---
export const adminGetAllUsers = (): Promise<User[]> => fetchApi('/api/admin/users');
export const adminUpdateUserRole = (userId: string, role: string): Promise<{ message: string }> => fetchApi(`/api/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
export const adminUpdateUserBanStatus = (userId: string, is_banned: boolean, ban_reason?: string, ban_duration_hours?: number): Promise<{ message: string }> => fetchApi(`/api/admin/users/${userId}/ban`, { method: 'PUT', body: JSON.stringify({ is_banned, ban_reason, ban_duration_hours }) });
export const adminUpdateUserMuteStatus = (userId: string, is_muted: boolean, mute_reason?: string, mute_duration_hours?: number): Promise<{ message: string }> => fetchApi(`/api/admin/users/${userId}/mute`, { method: 'PUT', body: JSON.stringify({ is_muted, mute_reason, mute_duration_hours }) });
export const adminDeleteUser = (userId: string): Promise<{ message: string }> => fetchApi(`/api/admin/users/${userId}`, { method: 'DELETE' });

// --- Notification API ---
export const getVapidPublicKey = (): Promise<{ publicKey: string }> => fetchApi('/api/notifications/vapid-public-key');
export const subscribeToPush = (subscription: PushSubscription): Promise<{ message: string }> => fetchApi('/api/notifications/subscribe', { method: 'POST', body: JSON.stringify(subscription) });

// --- WebRTC API ---
export const getTurnCredentials = (): Promise<RTCIceServer[]> => fetchApi('/api/turn-creds');