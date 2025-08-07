
import type { User, Message } from '../types';

const fetchApi = async (url: string, options: RequestInit = {}) => {
  const isFormData = options.body instanceof FormData;

  const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      throw new Error(response.statusText || 'An unknown network error occurred');
    }
    throw new Error(errorData.message || 'An error occurred');
  }

  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
      return null;
  }
  return response.json();
};

// --- User API ---
export const getMyChats = (): Promise<User[]> => fetchApi('/api/users/me/chats');
export const getUserByUniqueId = (uniqueId: string): Promise<User | undefined> => fetchApi(`/api/users/search?uniqueId=${uniqueId}`);

export const updateUser = (formData: FormData): Promise<User> => fetchApi('/api/users/me', {
  method: 'PUT',
  body: formData,
});

// --- Auth API ---
export const login = (username: string, password: string): Promise<User> => fetchApi('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username, password }),
});
export const register = (username: string, password: string): Promise<User> => fetchApi('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ username, password }),
});
export const anonymousLogin = (username: string): Promise<User> => fetchApi('/api/auth/anonymous-login', {
    method: 'POST',
    body: JSON.stringify({ username }),
});
export const logout = (): Promise<void> => fetchApi('/api/auth/logout', {
  method: 'POST',
});
export const checkSession = (): Promise<User> => fetchApi('/api/auth/me');

// --- Message API ---
export const getMessages = (chatId: string): Promise<Message[]> => fetchApi(`/api/messages/${chatId}`);

export const uploadChatFile = (formData: FormData): Promise<{ mediaUrl: string, type: string, originalName: string }> => fetchApi('/api/messages/upload', {
    method: 'POST',
    body: formData,
});
