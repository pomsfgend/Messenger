
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import type { User } from '../types';
import * as api from '../services/api';

type TwoFactorPrompt = { twoFactorRequired: true; userId: string };

interface AuthContextType {
  currentUser: User | null | undefined; // undefined: loading, null: not logged in
  login: (username: string, password: string) => Promise<User | TwoFactorPrompt>;
  googleLogin: (credential: string) => Promise<User | TwoFactorPrompt>;
  telegramLogin: (authData: any) => Promise<User | TwoFactorPrompt>;
  anonymousLogin: (username: string) => Promise<User>;
  phoneRequestCode: (phoneNumber: string, isRegistering: boolean) => Promise<{ message: string }>;
  phoneLogin: (phoneNumber: string, code: string) => Promise<User | TwoFactorPrompt>;
  loginWith2FA: (userId: string, code: string) => Promise<User>;
  logout: () => Promise<void>;
  register: (username: string, password: string, name: string) => Promise<User>;
  updateCurrentUser: (user: User | null) => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);

  const checkUserSession = useCallback(async () => {
      try {
        const user = await api.checkSession();
        setCurrentUser(user);
      } catch (error: any) {
        // CRITICAL FIX: Handle ban state without logging the user out.
        // This allows us to show a dedicated "You are banned" screen.
        if (error.data?.is_banned) {
            setCurrentUser({
                ...error.data,
                id: '', // Minimal data to show the ban screen
                username: '',
                createdAt: '',
                isEffectivelyBanned: true,
                is_banned: true, 
                ban_reason: error.data.ban_reason,
                ban_expires_at: error.data.ban_expires_at,
            });
        } else {
            setCurrentUser(null);
        }
      }
  }, []);
  
  const refreshSession = useCallback(async () => {
      await checkUserSession();
  }, [checkUserSession]);

  useEffect(() => {
    checkUserSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on initial mount

  const updateCurrentUser = (user: User | null) => {
      setCurrentUser(user);
  };
  
  const handleLoginResponse = (response: User | TwoFactorPrompt): User | TwoFactorPrompt => {
      if ('twoFactorRequired' in response && response.twoFactorRequired) {
          return response;
      }
      setCurrentUser(response as User);
      return response as User;
  }

  const login = useCallback(async (username: string, password: string): Promise<User | TwoFactorPrompt> => {
    const response = await api.login(username, password);
    return handleLoginResponse(response);
  }, []);
  
  const anonymousLogin = useCallback(async (username: string): Promise<User> => {
    const user = await api.anonymousLogin(username);
    setCurrentUser(user);
    return user;
  }, []);

  const googleLogin = useCallback(async (credential: string): Promise<User | TwoFactorPrompt> => {
    const response = await api.googleLogin(credential);
    return handleLoginResponse(response);
  }, []);
  
  const telegramLogin = useCallback(async (authData: any): Promise<User | TwoFactorPrompt> => {
    const response = await api.telegramLogin(authData);
    return handleLoginResponse(response);
  }, []);

  const phoneRequestCode = useCallback(async (phoneNumber: string, isRegistering: boolean): Promise<{ message: string }> => {
    return api.phoneRequestCode(phoneNumber, isRegistering);
  }, []);

  const phoneLogin = useCallback(async (phoneNumber: string, code: string): Promise<User | TwoFactorPrompt> => {
    const response = await api.phoneLogin(phoneNumber, code);
    return handleLoginResponse(response);
  }, []);
  
  const loginWith2FA = useCallback(async (userId: string, code: string): Promise<User> => {
    const user = await api.login2FAVerify(userId, code);
    setCurrentUser(user);
    return user;
  }, []);

  const register = useCallback(async (username: string, password: string, name: string): Promise<User> => {
    const newUser = await api.register(username, password, name);
    setCurrentUser(newUser);
    return newUser;
  }, []);
  
  const logout = useCallback(async () => {
    await api.logout();
    setCurrentUser(null);
  }, []);

  const value = { currentUser, login, googleLogin, telegramLogin, anonymousLogin, logout, register, updateCurrentUser, refreshSession, phoneRequestCode, phoneLogin, loginWith2FA };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};