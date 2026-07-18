import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, settingsApi } from '../lib/api';

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
  canScanReturns?: boolean;
  canDisplayOnDashboard?: boolean;
  avatarUrl?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  platformSettings: {
    showIdentityVerification?: boolean;
    showBankVerification?: boolean;
    showContractVerification?: boolean;
    enabled?: boolean;
    registrationBlocked?: boolean;
    influencerRegistrationBlocked?: boolean;
  } | null;
  refreshPlatformSettings: () => Promise<void>;
  login: (data: { email?: string; phone?: string; password: string }) => Promise<{ user?: AuthUser; requiresTwoFactor?: boolean; twoFactorToken?: string; requiresPasswordChange?: boolean; tempToken?: string; message?: string }>;
  login2FA: (data: { twoFactorToken: string; code: string }) => Promise<AuthUser>;
  forcePasswordChange: (data: { tempToken: string; newPassword: string }) => Promise<AuthUser>;
  googleAuth: (data: { credential: string; role?: string; [key: string]: any }) => Promise<any>;
  register: (data: { email?: string; phone?: string; password: string; fullName: string; role?: string; cguAccepted?: boolean; turnstileToken?: string; [key: string]: any }) => Promise<AuthUser>;
  registerInfluencer: (data: any) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  impersonate: (userId: number) => Promise<void>;
  revertImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [platformSettings, setPlatformSettings] = useState<any>(null);

  const refreshPlatformSettings = async () => {
    try {
      const res = await settingsApi.getMaintenanceStatus();
      setPlatformSettings(res.data?.data || {});
    } catch {
      setPlatformSettings({
        showIdentityVerification: true,
        showBankVerification: true,
        showContractVerification: true
      });
    }
  };

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
    refreshPlatformSettings().finally(() => {
      if (token) {
        refreshUser().finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });
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

  const googleAuth = async (data: { credential: string; role?: string; [key: string]: any }) => {
    const guestLang = localStorage.getItem('guest_lang');
    const response = await authApi.googleAuth({
      ...data,
      ...(guestLang ? { language: guestLang } : {})
    });
    
    if (response.data.data?.status === 'needs_completion') {
      return response.data.data;
    }
    
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

  const register = async (data: { email?: string; phone?: string; password: string; fullName: string; role?: string; cguAccepted?: boolean; turnstileToken?: string; [key: string]: any }) => {
    const guestLang = localStorage.getItem('guest_lang');
    const response = await authApi.register({
      ...data,
      ...(guestLang ? { language: guestLang } : {})
    });
    const { user, tokens } = response.data.data;
    
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(user);
    return user;
  };

  const registerInfluencer = async (data: any) => {
    const guestLang = localStorage.getItem('guest_lang');
    const response = await authApi.registerInfluencer({
      ...data,
      ...(guestLang ? { language: guestLang } : {})
    });
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
    const { user: targetUser, tokens } = response.data.data;
    
    // Save current session before overriding
    const currentAccess = localStorage.getItem('accessToken');
    const currentRefresh = localStorage.getItem('refreshToken');
    if (currentAccess && !localStorage.getItem('originalToken')) {
      localStorage.setItem('originalToken', currentAccess);
      if (currentRefresh) localStorage.setItem('originalRefreshToken', currentRefresh);
      
      // Save original user info so we can display custom back buttons/redirects
      if (user) {
        localStorage.setItem('originalUserRole', user.role || user.roleName || '');
        localStorage.setItem('originalUserFullName', user.fullName || '');
      }
    }
    
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    setUser(targetUser);

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

    const targetRoute = dashboardRoutes[targetUser.role] || '/';
    
    // Reload to flush any cached state and initialize as the new user
    window.location.href = targetRoute;
  };

  const revertImpersonation = async () => {
    const originalToken = localStorage.getItem('originalToken');
    const originalRefreshToken = localStorage.getItem('originalRefreshToken');
    const originalUserRole = localStorage.getItem('originalUserRole');
    
    if (originalToken) {
      localStorage.setItem('accessToken', originalToken);
      if (originalRefreshToken) localStorage.setItem('refreshToken', originalRefreshToken);
      
      localStorage.removeItem('originalToken');
      localStorage.removeItem('originalRefreshToken');
      localStorage.removeItem('originalUserRole');
      localStorage.removeItem('originalUserFullName');
      
      // Redirect back to the screen we impersonated from
      if (originalUserRole === 'SUPER_ADMIN' || originalUserRole === 'FINANCE_ADMIN' || originalUserRole === 'SYSTEM_SUPPORT') {
        window.location.href = '/admin/users';
      } else if (originalUserRole === 'HELPER') {
        window.location.href = '/helper/users';
      } else {
        window.location.href = '/';
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        platformSettings,
        refreshPlatformSettings,
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
