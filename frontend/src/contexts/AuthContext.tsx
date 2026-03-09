import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../lib/api';

export interface AuthUser {
  uuid: string;
  email: string | null;
  phone: string | null;
  fullName?: string;
  role: string;
  roleName?: string;
  kycStatus: string;
  isActive: boolean;
  mode?: 'SELLER' | 'AFFILIATE';
  isInfluencer?: boolean;
  instagramUsername?: string;
  tiktokUsername?: string;
  facebookUsername?: string;
  xUsername?: string;
  youtubeUsername?: string;
  snapchatUsername?: string;
  referralCode?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: { email?: string; phone?: string; password: string }) => Promise<AuthUser>;
  register: (data: { email?: string; phone?: string; password: string; fullName: string; role?: string }) => Promise<void>;
  registerInfluencer: (data: { email?: string; phone?: string; password: string; fullName: string; instagramUsername?: string; tiktokUsername?: string; facebookUsername?: string; xUsername?: string; youtubeUsername?: string; snapchatUsername?: string; }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await authApi.me();
      setUser(response.data.data.user);
    } catch {
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (data: { email?: string; phone?: string; password: string }) => {
    const response = await authApi.login(data);
    const { user, tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(user);
    return user;
  };

  const register = async (data: { email?: string; phone?: string; password: string; fullName: string; role?: string }) => {
    const response = await authApi.register(data);
    const { user, tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(user);
  };

  const registerInfluencer = async (data: { email?: string; phone?: string; password: string; fullName: string; instagramUsername?: string; tiktokUsername?: string; facebookUsername?: string; xUsername?: string; youtubeUsername?: string; snapchatUsername?: string; }) => {
    const response = await authApi.registerInfluencer(data);
    const { user, tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        registerInfluencer,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
