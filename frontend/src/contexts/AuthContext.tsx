import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, settingsApi } from '../lib/api';
import { VENDOR_HELPER_BASE } from '../lib/dashboardBase';
import { clearSessionStorage, endSession, leaveIfSessionBound, onSessionEnded } from '../lib/session';

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

  // Vendor sub-accounts (role VENDOR_HELPER). `vendorId` is the account whose
  // data this session reads and writes — the parent vendor for a sub-account,
  // and the user themselves for everyone else.
  vendorId?: number;
  isVendorHelper?: boolean;
  parentVendorId?: number;
  parentVendorName?: string | null;
  subAllowedModes?: 'BOTH' | 'SELLER' | 'AFFILIATE';
  subReadOnly?: boolean;
  subAccessExpiresAt?: string | null;
  subCanViewDashboard?: boolean;
  subCanViewLeads?: boolean;
  subCanEditLeads?: boolean;
  subCanCreateLeads?: boolean;
  subCanViewInventory?: boolean;
  subCanManageLinks?: boolean;
  subCanViewWallet?: boolean;
  subCanViewInvoices?: boolean;
  subCanViewIntegrations?: boolean;
  subCanViewMarketplace?: boolean;
  subCanViewAbandonedCarts?: boolean;
  subCanManageSupport?: boolean;
  subCanUseChat?: boolean;
  subCanManagePixels?: boolean;
  subCanManageDomains?: boolean;
  subCanDeleteLeads?: boolean;
  subCanPushToCallCenter?: boolean;
  subCanRespondPriceRequests?: boolean;
  subCanImportIntegrationLeads?: boolean;
  subCanClaimProducts?: boolean;
  subCanEditProducts?: boolean;
  subCanRequestCustomProduct?: boolean;
  subCanCreateLinks?: boolean;
  subCanUseLinkBuilder?: boolean;
  subCanRegenerateLinks?: boolean;
  subCanViewTransactions?: boolean;
  subCanViewPayouts?: boolean;
  subCanViewCommissions?: boolean;
  subCanDownloadInvoices?: boolean;
  subCanViewPixels?: boolean;
  subCanCreateTickets?: boolean;
  subCanSendMessages?: boolean;
  subCanManageConversations?: boolean;
  subCanRefreshDomain?: boolean;

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

/**
 * What a signed-out visitor gets instead of a request.
 *
 * Nothing public reads these — the only consumers are RoleGuard, the profile
 * verification banners and the admin screens, all of them behind a login. But
 * RoleGuard waits on a non-null value before it will redirect, so a guest who
 * lands on a dashboard URL must still be handed something, or it stalls on its
 * loading state instead of bouncing them to /login.
 *
 * Same shape as the error fallback below, for the same reason: assume the
 * verification steps exist rather than silently hiding them.
 */
const GUEST_PLATFORM_SETTINGS = {
  showIdentityVerification: true,
  showBankVerification: true,
  showContractVerification: true
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [platformSettings, setPlatformSettings] = useState<any>(null);

  const refreshPlatformSettings = async () => {
    try {
      const res = await settingsApi.getMaintenanceStatus();
      setPlatformSettings(res.data?.data || {});
    } catch {
      setPlatformSettings(GUEST_PLATFORM_SETTINGS);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.me();
      setUser(response.data.data.user);
    } catch (error: any) {
      // Only an outright rejection of the token ends the session. Any failure
      // used to clear it, which now costs more than it did: dropping the access
      // token signs the user out of every other tab too, and a 500 or a dropped
      // connection is not a reason to do that.
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        setUser(null);
        clearSessionStorage();
      }
    }
  };

  /**
   * The session ended somewhere else — another tab signed out, or a request in
   * this one came back with a token the server no longer accepts.
   *
   * The tokens are already gone by the time this runs (localStorage is shared);
   * what is left is this tab's React tree, still painting a signed-in dashboard.
   * Drop the user so the guards take over, and hard-navigate away when the page
   * on screen needed the session.
   */
  useEffect(() => onSessionEnded(({ reason }) => {
    setUser(null);
    setIsLoading(false);
    leaveIfSessionBound(reason);
  }), []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    // A signed-out visitor made this request on every page load — including the
    // public offer pages, where nothing reads the answer — and it ran before
    // the page's own data fetch. Seeding the defaults removes the round trip
    // entirely rather than merely moving it later.
    if (!token) {
      setPlatformSettings(GUEST_PLATFORM_SETTINGS);
      setIsLoading(false);
      return;
    }

    refreshPlatformSettings().finally(() => {
      refreshUser().finally(() => setIsLoading(false));
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
    // Fetch full user profile & platform settings so verification progress is correct immediately
    try {
      const [meRes] = await Promise.all([
        authApi.me(),
        refreshPlatformSettings()
      ]);
      setUser(meRes.data.data.user);
    } catch {
      setUser(user);
    }
    return { user };
  };

  // Both of these mirror login(): the login response carries a trimmed user
  // object, while /auth/me is what returns verification progress and — for a
  // vendor sub-account — its permission flags. Skipping the refetch lands a
  // sub-account on its dashboard with every subCan* undefined and an empty
  // sidebar.
  const login2FA = async (data: { twoFactorToken: string; code: string }) => {
    const response = await authApi.login2FA(data);
    const { user, tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    try {
      const [meRes] = await Promise.all([
        authApi.me(),
        refreshPlatformSettings()
      ]);
      setUser(meRes.data.data.user);
      return meRes.data.data.user;
    } catch {
      setUser(user);
      return user;
    }
  };

  const forcePasswordChange = async (data: { tempToken: string; newPassword: string }) => {
    const response = await authApi.forcePasswordChange(data);
    const { user, tokens } = response.data.data;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    try {
      const [meRes] = await Promise.all([
        authApi.me(),
        refreshPlatformSettings()
      ]);
      setUser(meRes.data.data.user);
      return meRes.data.data.user;
    } catch {
      setUser(user);
      return user;
    }
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
      const [meRes] = await Promise.all([
        authApi.me(),
        refreshPlatformSettings()
      ]);
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
    try {
      await refreshPlatformSettings();
    } catch {}
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
    try {
      await refreshPlatformSettings();
    } catch {}
    setUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    // Clears the tokens AND tells every other tab of this browser to do the
    // same, so a dashboard left open in a second tab stops rendering a session
    // that no longer exists instead of failing on its next click.
    endSession('logout');
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
      'VENDOR_HELPER': VENDOR_HELPER_BASE,
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
      } else if (originalUserRole === 'VENDOR_HELPER') {
        window.location.href = VENDOR_HELPER_BASE;
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
