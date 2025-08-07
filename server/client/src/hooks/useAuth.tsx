
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import type { User } from '../types';
import * as api from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isInitialLoad: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  register: (username: string, password: string) => Promise<User>;
  anonymousLogin: (username: string) => Promise<User>;
  updateCurrentUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const checkUserSession = useCallback(async () => {
      try {
        const user = await api.checkSession();
        setCurrentUser(user);
      } catch (error) {
        setCurrentUser(null);
      } finally {
        setLoading(false);
        if (isInitialLoad) setIsInitialLoad(false);
      }
  }, [isInitialLoad]);

  useEffect(() => {
    checkUserSession();
  }, [checkUserSession]);

  const login = useCallback(async (username: string, password: string): Promise<User> => {
    const user = await api.login(username, password);
    setCurrentUser(user);
    return user;
  }, []);

  const register = useCallback(async (username: string, password: string): Promise<User> => {
    const newUser = await api.register(username, password);
    setCurrentUser(newUser);
    return newUser;
  }, []);

  const anonymousLogin = useCallback(async (username: string): Promise<User> => {
    const user = await api.anonymousLogin(username);
    setCurrentUser(user);
    return user;
  }, []);
  
  const logout = useCallback(async () => {
    await api.logout();
    setCurrentUser(null);
  }, []);
  
  // Directly update the current user state, useful for profile updates or Telegram login
  const updateCurrentUser = useCallback((updatedUser: Partial<User>) => {
    setCurrentUser(prevUser => prevUser ? { ...prevUser, ...updatedUser } : null);
  }, []);

  const value = { currentUser, loading, isInitialLoad, login, logout, register, anonymousLogin, updateCurrentUser };

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
