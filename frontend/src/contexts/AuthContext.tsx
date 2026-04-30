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
  canImpersonate?: boolean;
  canManageProducts?: boolean;
  canManageLeads?: boolean;
  canManageOrders?: boolean;
  canManageInfluencerLinks?: boolean;
  canManageTickets?: boolean;
  avatarUrl?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: { email?: string; phone?: string; password: string }) => Promise<{ user?: AuthUser; requiresTwoFactor?: boolean; twoFactorToken?: string; requiresPasswordChange?: boolean; tempToken?: string; message?: string }>;
  login2FA: (data: { twoFactorToken: string; code: string }) => Promise<AuthUser>;
  forcePasswordChange: (data: { tempToken: string; newPassword: string }) => Promise<AuthUser>;
  googleAuth: (data: { credential: string; role?: string }) => Promise<{ user?: AuthUser; requiresTwoFactor?: boolean; twoFactorToken?: string; requiresPasswordChange?: boolean; tempToken?: string; message?: string }>;
  register: (data: { email?: string; phone?: string; password: string; fullName: string; role?: string }) => Promise<AuthUser>;
  registerInfluencer: (data: { email?: string; phone?: string; password: string; fullName: string; instagramUsername?: string; tiktokUsername?: string; facebookUsername?: string; xUsername?: string; youtubeUsername?: string; snapchatUsername?: string; }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  impersonate: (userId: number) => Promise<void>;
  revertImpersonation: () => Promise<void>;
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
    
    if (response.data.data?.requiresTwoFactor) {
      return { 
        requiresTwoFactor: true, 
        twoFactorToken: response.data.data.twoFactorToken,
        message: response.data.message
      };
    }

    if (response.data.data?.requiresPasswordChange) {
      return {
        requiresPasswordChange: true,
        tempToken: response.data.data.tempToken,
        message: response.data.message
      };
    }

    const { user, tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    // Fetch full user profile (includes emailVerified, brand.bankAccounts) so
    // the verification progress is correct immediately after login.
    try {
      const meRes = await authApi.me();
      setUser(meRes.data.data.user);
    } catch {
      setUser(user);
    }
    return { user };
  };

  const login2FA = async (data: { twoFactorToken: string; code: string }) => {
    const response = await authApi.login2FA(data);
    const { user, tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(user);
    return user;
  };

  const forcePasswordChange = async (data: { tempToken: string; newPassword: string }) => {
    const response = await authApi.forcePasswordChange(data);
    const { user, tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(user);
    return user;
  };

  const googleAuth = async (data: { credential: string; role?: string }) => {
    const response = await authApi.googleAuth(data);
    
    if (response.data.data?.requiresTwoFactor) {
      return { 
        requiresTwoFactor: true, 
        twoFactorToken: response.data.data.twoFactorToken,
        message: response.data.message
      };
    }

    if (response.data.data?.requiresPasswordChange) {
      return {
        requiresPasswordChange: true,
        tempToken: response.data.data.tempToken,
        message: response.data.message
      };
    }

    const { user, tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    try {
      const meRes = await authApi.me();
      setUser(meRes.data.data.user);
    } catch {
      setUser(user);
    }
    return { user };
  };

  const register = async (data: { email?: string; phone?: string; password: string; fullName: string; role?: string }) => {
    const response = await authApi.register(data);
    const { user, tokens } = response.data.data;
    
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(user);
    return user;
  };

  const registerInfluencer = async (data: { email?: string; phone?: string; password: string; fullName: string; instagramUsername?: string; tiktokUsername?: string; facebookUsername?: string; xUsername?: string; youtubeUsername?: string; snapchatUsername?: string; }) => {
    const response = await authApi.registerInfluencer(data);
    const { user, tokens } = response.data.data;
    
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('originalToken');
    localStorage.removeItem('originalRefreshToken');
    setUser(null);
  };

  const impersonate = async (userId: number) => {
    const response = await authApi.impersonate({ targetUserId: userId });
    const { user, tokens } = response.data.data;
    
    // Save current session before overriding
    const currentAccess = localStorage.getItem('accessToken');
    const currentRefresh = localStorage.getItem('refreshToken');
    if (currentAccess && !localStorage.getItem('originalToken')) {
      localStorage.setItem('originalToken', currentAccess);
      if (currentRefresh) localStorage.setItem('originalRefreshToken', currentRefresh);
    }
    
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(user);

    // Redirect to the appropriate dashboard based on role
    const dashboardRoutes: Record<string, string> = {
      'SUPER_ADMIN': '/admin',
      'FINANCE_ADMIN': '/admin',
      'SYSTEM_SUPPORT': '/admin',
      'VENDOR': '/dashboard',
      'INFLUENCER': '/influencer',
      'CALL_CENTER_AGENT': '/agent',
      'CONFIRMATION_AGENT': '/confirmation',
      'HELPER': '/helper',
      'GROSSELLER': '/grosseller'
    };

    const targetRoute = dashboardRoutes[user.role] || '/';
    
    // Reload to flush any cached state and initialize as the new user
    window.location.href = targetRoute;
  };

  const revertImpersonation = async () => {
    const originalToken = localStorage.getItem('originalToken');
    const originalRefreshToken = localStorage.getItem('originalRefreshToken');
    
    if (originalToken) {
      localStorage.setItem('accessToken', originalToken);
      if (originalRefreshToken) localStorage.setItem('refreshToken', originalRefreshToken);
      
      localStorage.removeItem('originalToken');
      localStorage.removeItem('originalRefreshToken');
      // Reload to switch back fully
      window.location.href = '/helper/users';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        login2FA,
        forcePasswordChange,
        googleAuth,
        register,
        registerInfluencer,
        logout,
        refreshUser,
        impersonate,
        revertImpersonation,
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
