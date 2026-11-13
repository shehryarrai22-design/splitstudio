import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserStorageStats } from '../types';
import { api, getStoredToken, setStoredToken } from '../api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  storageStats: UserStorageStats | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshStorage: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [storageStats, setStorageStats] = useState<UserStorageStats | null>(null);

  const refreshStorage = useCallback(async () => {
    try {
      const stats = await api.getUserStorage();
      setStorageStats(stats);
    } catch (e) {
      // storage fetch failed or not logged in
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setStorageStats(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      setUser(res.user);
      await refreshStorage();
    } catch (err) {
      console.warn('Session expired or invalid:', err);
      setStoredToken(null);
      setUser(null);
      setStorageStats(null);
    } finally {
      setLoading(false);
    }
  }, [refreshStorage]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setStoredToken(res.token);
    setUser(res.user);
    await refreshStorage();
  };

  const register = async (name: string, email: string, pass: string) => {
    const res = await api.register(name, email, pass);
    setStoredToken(res.token);
    setUser(res.user);
    await refreshStorage();
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    }
    setStoredToken(null);
    setUser(null);
    setStorageStats(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        storageStats,
        login,
        register,
        logout,
        refreshUser,
        refreshStorage,
      }}
    >
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
