import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

export const API_URL = (import.meta.env as any).VITE_API_URL || (import.meta.env.PROD && typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:3001/api/v1');
export const BACKEND_URL = API_URL.replace('/api/v1', '');
// API Client Definition - Synced with Studio V2

export const getFileUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${BACKEND_URL}${cleanUrl}`;
};

export interface User {
  id: number;
  uuid: string;
  email: string;
  fullName: string;
  role: string;
  canManageProducts?: boolean;
  canManageLeads?: boolean;
  canManageOrders?: boolean;
  canManageTickets?: boolean;
  canDisplayOnDashboard?: boolean;
  avatarUrl?: string;
  customDomain?: string | null;
  customDomainStatus?: string | null;
  [key: string]: any;
}

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  // Without a timeout a stalled request never settles, so callers that disable a
  // button in try/finally stay disabled forever and the UI looks frozen.
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // If helper is impersonating (assistance mode), block mutating actions
    const isImpersonating = !!localStorage.getItem('originalToken');
    const method = config.method?.toUpperCase();
    const url = config.url || '';

    if (isImpersonating && method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      // Allow logout, revert, and non-mutating routes if any (logout is the only one needed here)
      if (!url.includes('/auth/logout')) {
        toast.error("Lecture seule : Les modifications ne sont pas autorisées en mode assistance.");
        return Promise.reject(new Error("Lecture seule : Les modifications ne sont pas autorisées en mode assistance."));
      }
    }

    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const bypassToken = localStorage.getItem('maintenance_bypass');
    if (bypassToken && config.headers) {
      config.headers['x-maintenance-bypass'] = bypassToken;
    }

    // Add rich client telemetry headers for SOC Dashboard tracking
    if (config.headers && typeof window !== 'undefined') {
      config.headers['x-client-screen'] = `${window.screen.width}x${window.screen.height}`;
      config.headers['x-client-window'] = `${window.innerWidth}x${window.innerHeight}`;
      config.headers['x-client-cookies'] = navigator.cookieEnabled ? '1' : '0';
      config.headers['x-client-js'] = '1';
      config.headers['x-client-platform'] = navigator.platform;
      
      const ua = navigator.userAgent;
      let browserVersion = '';
      const match = ua.match(/(chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
      if (match.length > 2) browserVersion = match[2];
      config.headers['x-client-browser-version'] = browserVersion;
      
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      config.headers['x-client-device-type'] = isMobile ? 'Mobile' : 'Desktop';
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Handle Maintenance Mode
    if (error.response?.status === 503 && (error.response.data as any)?.maintenance) {
      if (window.location.pathname !== '/maintenance') {
        window.location.href = '/maintenance';
      }
      return Promise.reject(error);
    }

    // A vendor sub-account is refused by the permission matrix with a message
    // that explains exactly which grant is missing, or that the account is in
    // read-only mode. Surface it: the pages that fire these calls mostly log
    // and move on, so without this the button just appears to do nothing.
    if (error.response?.status === 403) {
      const message = (error.response.data as any)?.message;
      const method = error.config?.method?.toUpperCase();
      const isWrite = !!method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      if (isWrite && typeof message === 'string' && /sous-compte|vendeur|lecture seule/i.test(message)) {
        toast.error(message, { id: 'sub-account-denied' });
      }
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data: { email?: string; phone?: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: { email?: string; phone?: string; password: string; fullName: string; role?: string; [key: string]: any }) =>
    api.post('/auth/register', data),
  registerInfluencer: (data: any) =>
    api.post('/auth/register-influencer', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (data: { email?: string; phone?: string }) =>
    api.post('/auth/forgot-password', data),
  resetPassword: (data: { token: string; password: string }) =>
    api.post('/auth/reset-password', data),
  forcePasswordChange: (data: { tempToken: string; newPassword: string }) =>
    api.post('/auth/force-password-change', data),
  verifyResetToken: (token: string) =>
    api.get(`/auth/verify-reset-token/${token}`),
  verifyOtp: (data: { email?: string; phone?: string; otp: string }) =>
    api.post('/auth/verify-otp', data),
  verifyEmail: (data: { email: string; otp: string }) =>
    api.post('/auth/verify-email', data),
  googleAuth: (data: { credential: string; role?: string; language?: string; [key: string]: any }) =>
    api.post('/auth/google', data),
  login2FA: (data: { twoFactorToken: string; code: string }) =>
    api.post('/auth/login/2fa', data),
  setup2FA: () => api.post('/auth/2fa/setup'),
  verify2FA: (data: { code: string; secret?: string }) =>
    api.post('/auth/2fa/verify', data),
  disable2FA: () => api.post('/auth/2fa/disable'),
  updateLanguageSetting: (language: string) => api.put('/user/settings', { language }),
  impersonate: (data: { targetUserId: number }) =>
    api.post('/auth/impersonate', data),
  revertImpersonate: () =>
    api.post('/auth/revert-impersonate'),
  sendBankOtp: (data: { bankName: string; ribAccount: string; iceNumber?: string }) =>
    api.post('/auth/bank-accounts/send-otp', data),
  verifyBankOtp: (otp: string) =>
    api.post('/auth/bank-accounts/verify-otp', { otp }),
  setDefaultBankAccount: (id: number) =>
    api.patch(`/auth/bank-accounts/${id}/default`),
  deleteBankAccount: (id: number, password?: string) =>
    api.delete(`/auth/bank-accounts/${id}`, { data: { password } }),
  resendOtp: (data: { email?: string; phone?: string }) =>
    api.post('/auth/resend-otp', data),
  checkSubdomain: (name: string) =>
    api.get(`/auth/check-subdomain?name=${encodeURIComponent(name)}`),
  saveSubdomain: (subdomain: string) =>
    api.post('/auth/save-subdomain', { subdomain }),
  sendSubdomainOtp: (subdomain: string) =>
    api.post('/auth/subdomain/send-otp', { subdomain }),
  verifySubdomainOtp: (subdomain: string, otp: string) =>
    api.post('/auth/subdomain/verify-otp', { subdomain, otp }),
  extractKycData: async (file: File, type: 'recto' | 'verso' = 'recto') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    const response = await api.post('/auth/kyc/extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response;
  },
  submitKyc: (data: { 
    documents: { type: string; url: string; metadata?: any }[]; 
    cinNumber?: string; 
    birthDate?: string; 
    fullName?: string; 
    address?: string; 
    city?: string;
  }) => api.post('/auth/kyc', data),
};


export const productsApi = {
  list: (params?: { category?: string; search?: string; page?: number; limit?: number; status?: string; myProducts?: string; showInHomepage?: boolean | string }) =>
    api.get('/products', { params }),
  get: (id: string) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.patch(`/products/${id}`, data),
  updateStatus: (id: string, data: { status: string }) => api.patch(`/products/${id}/status`, data),
  customize: (id: string, data: any) => api.post(`/products/${id}/customize`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  cloneForUser: (id: string, data: { userId: number; newSku?: string; newName?: string }) =>
    api.post(`/products/${id}/clone`, data),
  updateBranding: (id: string, data: { brandingLabelMockupUrl?: string; brandingLabelPrintUrl?: string }) =>
    api.patch(`/products/${id}/branding`, data),
};

export const leadsApi = {
  /**
   * `status` filters on where the lead stands now; `historyStatus` (agents only)
   * filters on what the agent did to it, so a lead the cron handed back to the
   * pool is still listed under the outcome they recorded. `dateField` picks
   * which timestamp `dateFrom`/`dateTo` narrow — the status change or the lead's
   * arrival.
   */
  list: (params?: { status?: string; historyStatus?: string; page?: number; limit?: number; search?: string; viewMode?: string; mode?: string; vendorId?: string; productId?: string; isSuspicious?: boolean; city?: string; coliatyPackageCode?: string; accountId?: string; agentId?: string; source?: string; sourceMode?: string; paymentSituation?: string; hasOrder?: 'yes' | 'no'; dateFrom?: string; dateTo?: string; dateField?: 'createdAt' | 'updatedAt'; dateType?: 'createdAt' | 'updatedAt'; sort?: string; withStats?: string }) =>
    api.get('/leads', { params }),
  create: (data: any) => api.post('/leads', data),
  import: (data: { leads: any[]; sourceMode?: string }) => api.post('/leads/import', data),
  importWithProduct: (data: { productId: number; leads: any[]; sourceMode?: string }) => api.post('/leads/import', data),
  getMyProducts: (params?: { mode?: string }) => api.get('/leads/my-products', { params }),
  pushIntegrationLeads: (data: { source: string; mode: string; productId: number; orders: any[] }) =>
    api.post('/leads/push-integration-leads', data),
  update: (id: string, data: any) => api.patch(`/leads/${id}`, data),
  updateStatus: (id: string, data: { status: string; notes?: string; callbackAt?: string; requestedPriceMad?: number }) =>
    api.patch(`/leads/${id}/status`, data),
  respondPriceRequest: (id: number, action: 'APPROVE' | 'REJECT') =>
    api.post(`/leads/${id}/respond-price-request`, { action }),
  bulkUpdateStatus: (data: { ids: number[]; status: string }) =>
    api.patch('/leads/bulk-status', data),
  /** Admin-only. Skips leads already handed to Coliaty and reports them back. */
  bulkDelete: (ids: number[]) => api.post('/leads/bulk-delete', { ids }),
  assign: (id: string, data: { agentId: string }) => api.post(`/leads/${id}/assign`, data),
  available: (params?: {
    influencerId?: number;
    limit?: number | string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    /** Digits of a phone/WhatsApp number; matched on the last 9 server-side. */
    phone?: string;
    city?: string;
    productId?: number | string;
  }) => api.get('/leads/available', { params }),
  claim: (id: number) => api.post(`/leads/${id}/claim`),
  /**
   * Shape-over-time for the agent statistics page: the daily and hourly spread of
   * the agent's own actions plus a live feed of the last few. The totals it sits
   * next to still come from `list({ withStats: 'true' })` — same history rows,
   * same server-side tally, so the two panels can never disagree.
   */
  agentStatistics: (params?: {
    dateFrom?: string;
    dateTo?: string;
    /** 'updatedAt' scopes on the action's own time, 'createdAt' on the lead's arrival. */
    dateField?: 'updatedAt' | 'createdAt';
    dateType?: 'updatedAt' | 'createdAt';
    /** How many rows the activity feed carries. Server caps at 100. */
    recentLimit?: number;
  }) => api.get('/leads/agent-statistics', { params }),
  // Leads already held by an agent (any agent) within this agent's own scope.
  // The response never carries phone numbers — see /leads/assigned-all.
  assignedAll: (params?: {
    influencerId?: number;
    limit?: number | string;
    search?: string;
    city?: string;
    productId?: number | string;
    dateFrom?: string;
    dateTo?: string;
  }) => api.get('/leads/assigned-all', { params }),
  forceClaim: (id: number, data: { phone: string; reason?: string }) =>
    api.post(`/leads/${id}/force-claim`, data),
  // Abandoned carts (call-center recovery)
  abandonedCarts: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'all' | 'unsaved' | 'converted';
    phoneQuality?: 'all' | 'complete' | 'incomplete';
    dateFrom?: string;
    dateTo?: string;
  }) => api.get('/leads/abandoned-carts', { params }),
  convertCart: (id: string) => api.post(`/leads/abandoned-carts/${id}/convert`),
  detail: (id: number) => api.get(`/leads/${id}/detail`),
  timeline: (id: number) => api.get(`/leads/${id}/timeline`),
  sessions: (id: number) => api.get(`/leads/${id}/sessions`),
  recordContactClick: (id: number, channel: 'WHATSAPP' | 'CALL') =>
    api.post(`/leads/${id}/contact-click`, { channel }),
  pushToDelivery: (
    id: number,
    data: {
      productId?: number;
      quantity?: number;
      paymentMethod?: string;
      package_reciever?: string;
      package_phone?: string;
      package_city?: string;
      package_addresse?: string;
      package_price?: number;
      package_content?: string;
      package_no_open?: boolean;
      package_replacement?: boolean;
      package_old_tracking?: string;
      package_note?: string;
      productVariant?: string;
    }
  ) => api.post(`/leads/${id}/push-to-delivery`, data),
  livraison: (params?: {
    page?: number;
    /** A number, or 'all' / 'max' to pull the whole scope in one page. */
    limit?: number | string;
    search?: string;
    status?: string;
    paymentSituation?: string;
    city?: string;
    vendorId?: number | string;
    hasCode?: 'yes' | 'no';
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number | string;
    maxAmount?: number | string;
    productId?: number | string;
    /** A user id, or 'none' for parcels with no call-center agent assigned. */
    agentId?: number | string;
    tab?: 'all' | 'uninvoiced_returns';
    sort?: string;
  }) => api.get('/leads/livraison', { params }),
  getParcelHistory: (code: string) => api.get(`/leads/coliaty/parcel/${code}/history`),
  getColiatyCities: () => api.get('/leads/coliaty/cities'),
  updatePaymentSituation: (id: string, data: { paymentSituation: string }) =>
    api.patch(`/leads/${id}/payment-situation`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
  getHistoryByPhone: (phone: string) => api.get(`/leads/history-by-phone/${phone}`),
  getVendors: () => api.get('/leads/vendors'),
  getProductsByVendor: (vendorId: number) => api.get(`/leads/products-by-vendor/${vendorId}`),
};

export const ordersApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/orders', { params }),
  get: (id: string) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  updateStatus: (id: string, data: { 
    status: string; 
    notes?: string;
    actionType?: string;
    cloneName?: string;
    cloneDescription?: string;
    clonePrice?: number;
    cloneQuantity?: number;
    cloneImageUrls?: string[];
  }) => api.patch(`/orders/${id}/status`, data),
  revertToLead: (id: number) => api.post(`/orders/${id}/revert-to-lead`),
  changeDemand: (id: number, data: any) => api.post(`/orders/${id}/change-demand`, data),
  updateNormal: (id: number, data: any) => api.put(`/orders/${id}/update-normal`, data),
  getParcelLabel: (code: string) => api.get(`/orders/parcel/${code}/label`),
  /**
   * Merges many parcel labels into one PDF server-side. Printing a batch used to
   * mean one request per parcel, which got the server IP rate-limited by Coliaty.
   */
  getParcelLabelsBatch: (codes: string[]) =>
    api.post('/orders/parcels/labels/batch', { codes }, { timeout: 180000 }),
  getProductsWithParcels: () => api.get('/orders/products-with-parcels'),
  // Pickup Notes
  getPickupNoteDetail: (reference: string, refresh = false) =>
    api.get(`/orders/pickup-note/detail/${reference}`, { params: refresh ? { refresh: 1 } : undefined }),
  /** Live status of many pickup notes in a single round-trip. */
  getPickupNotesDetails: (references: string[], refresh = false) =>
    api.post('/orders/pickup-notes/details', { references, refresh }, { timeout: 120000 }),
  createPickupNote: () => api.post('/orders/pickup-note/create', {}),
  addParcelsToPickup: (data: { pickup_note_reference: string; parcel_codes: string[] }) =>
    api.post('/orders/pickup-note/add-parcels', data, { timeout: 120000 }),
  removeParcelsFromPickup: (data: { pickup_note_reference: string; parcel_codes: string[] }) =>
    api.post('/orders/pickup-note/remove-parcels', data),
  generatePickupLabels: (reference: string, refresh = false) =>
    api.get(`/orders/pickup-note/${reference}/generate-labels`, {
      params: refresh ? { refresh: 1 } : undefined,
      timeout: 120000,
    }),
  bulkDispatch: (data: { leadIds: number[] }) =>
    api.post('/orders/bulk-dispatch', data),
};

export const walletApi = {
  get: () => api.get('/wallet'),
  transactions: (params?: { type?: string; page?: number; limit?: number }) =>
    api.get('/wallet/transactions', { params }),
};

export const payoutsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/payouts', { params }),
  create: (data: { amountMad: number; bankName: string; ribAccount: string; iceNumber?: string }) =>
    api.post('/payouts', data),
  getHistory: (id: number) => api.get(`/payouts/${id}/history`),
  updateStatus: (id: number, status: string) => api.patch(`/payouts/${id}/status`, { status }),
};

// Call-center facturation: colis livrés -> facture -> solde -> retrait.
// The retrait itself goes through `payoutsApi` — an agent's withdrawal is an
// ordinary payout request, and lands in the same admin queue.
export const agentFacturationApi = {
  summary: () => api.get('/agent-facturation/summary'),
  billable: (params?: { page?: number; limit?: number; dateFrom?: string; dateTo?: string }) =>
    api.get('/agent-facturation/billable', { params }),
  generateInvoice: (data?: { leadIds?: number[]; dateFrom?: string; dateTo?: string }) =>
    api.post('/agent-facturation/invoices', data || {}),
  invoices: (params?: { page?: number; limit?: number }) =>
    api.get('/agent-facturation/invoices', { params }),
  invoice: (id: number) => api.get(`/agent-facturation/invoices/${id}`),
};

export const categoriesApi = {
  list: () => api.get('/categories'),
  create: (data: { nameAr: string; nameFr: string; nameEn?: string; slug: string; parentId?: number; imageUrl?: string }) =>
    api.post('/categories', data),
  update: (id: number, data: any) => api.patch(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
};

/**
 * The city catalogue backing every city picker: Coliaty's deliverable cities
 * plus the wider Moroccan localities that only appear in historical orders.
 */
export const citiesApi = {
  list: (params?: { deliverableOnly?: boolean }) => api.get('/cities', { params }),
  resolve: (name: string) => api.get('/cities/resolve', { params: { name } }),
  updateCoordinates: (id: number, data: { latitude: number; longitude: number }) =>
    api.patch(`/cities/${id}/coordinates`, data),
};

export const publicApi = {
  cities: () => api.get('/public/cities'),
  categories: () => api.get('/public/categories'),
  featuredProducts: () => api.get('/public/products/featured'),
  stats: () => api.get('/public/stats'),
  getReferralLinkData: (code: string) => api.get(`/influencer/links/${code}/public`),
  trackWhatsappClick: (code: string) => api.post(`/influencer/links/${code}/track-whatsapp`),
  submitReferralLead: (data: { referralCode: string; fullName: string; phone: string; city: string; address: string; productVariant?: string }) => api.post('/public/leads', data),
  submitContact: (data: { name: string; email: string; subject: string; message: string }) => api.post('/public/contact', data),
  checkBlock: (path: string) => api.get('/public/check-block', { params: { path } }),
  getProductsByAccounts: (accountIds: string) => api.get('/public/products-by-accounts', { params: { accountIds } }),
};

export const uploadApi = {
  video: (data: FormData, onProgress?: (progress: number) => void) => api.post('/upload/video', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000,
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
      }
    },
  }),
  cloudinaryVideo: (data: FormData, onProgress?: (progress: number) => void) => api.post('/upload/video', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000,
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
      }
    },
  }),
  image: (data: FormData) => api.post('/upload/image', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  audio: (data: FormData) => api.post('/upload/audio', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  productImages: (data: FormData, onProgress?: (progress: number) => void) =>
    api.post('/upload/product-images', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    }),
};

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  getVerifications: (params?: { filter?: string; page?: number; limit?: number; search?: string; role?: string }) => api.get('/admin/verifications', { params }),
  verifyEmail: (uuid: string, verified?: boolean) => api.patch(`/admin/users/${uuid}/verify-email`, { verified }),
  verifyKyc: (uuid: string, status: 'APPROVED' | 'REJECTED' | 'PENDING') =>
    api.patch(`/admin/users/${uuid}/verify-kyc`, { status }),
  verifyBank: (id: number, status: 'APPROVED' | 'REJECTED' | 'PENDING') =>
    api.patch(`/admin/bank-accounts/${id}/status`, { status }),
  verifyBankManually: (uuid: string, approved?: boolean) =>
    api.patch(`/admin/users/${uuid}/verify-bank`, { approved }),
  verifyUser: (uuid: string, isActive: boolean) => api.patch(`/admin/users/${uuid}/active`, { isActive }),
  verifyContract: (uuid: string, accepted?: boolean) => api.patch(`/admin/users/${uuid}/verify-contract`, { accepted }),
  updateUserSubdomain: (uuid: string, subdomain: string) => api.patch(`/admin/users/${uuid}/subdomain`, { subdomain }),
  clearUserSubdomain: (uuid: string) => api.patch(`/admin/users/${uuid}/subdomain`, { subdomain: null }),
  users: (params?: { role?: string; status?: string; page?: number; limit?: number; search?: string }) =>
    api.get('/users', { params }),
  getRoleCounts: () => api.get('/users/role-counts'),
  getUser: (uuid: string) => api.get(`/users/${uuid}`),
  createUser: (data: any) => api.post('/users', data),
  updateUser: (uuid: string, data: any) => api.patch(`/users/${uuid}/admin-edit`, data),
  activateUser: (uuid: string) => api.patch(`/users/${uuid}/activate`),
  deactivateUser: (uuid: string) => api.patch(`/users/${uuid}/deactivate`),
  deleteUser: (uuid: string) => api.delete(`/users/${uuid}`),
  updateKycStatus: (uuid: string, status: string) => api.patch(`/users/${uuid}/kyc-status`, { status }),
  reset2FA: (uuid: string) => api.post(`/users/${uuid}/reset-2fa`),
  sendPasswordResetLink: (uuid: string) => api.post(`/users/${uuid}/send-password-reset`),
  approvePayout: (id: string, data?: { receiptUrl?: string }) =>
    api.patch(`/payouts/${id}/approve`, data),
  rejectPayout: (id: string) => api.patch(`/payouts/${id}/reject`),
  bulkApprovePayouts: (ids: number[]) => api.post('/payouts/bulk-approve', { ids }),
  bulkUpdatePayoutStatus: (ids: number[], status: string) => api.patch('/payouts/bulk-status', { ids, status }),
  getAffiliateClaims: (params?: { status?: string }) => api.get('/admin/affiliate-claims', { params }),
  updateAffiliateClaim: (id: number, data: { status: string; actionType?: string; cloneName?: string; cloneDescription?: string; clonePrice?: number; cloneQuantity?: number; cloneImageUrls?: string[] }) =>
    api.patch(`/admin/affiliate-claims/${id}`, data),
  getSupportRequests: (params?: { status?: string; type?: string }) =>
    api.get('/admin/support-requests', { params }),
  updateSupportRequestStatus: (id: number, status: string) =>
    api.patch(`/admin/support-requests/${id}`, { status }),
  getConversations: (params?: { status?: string; type?: string; claimedByUserId?: number; orderNumber?: string }) =>
    api.get('/admin/conversations', { params }),
  // Campaigns
  getCampaigns: () => api.get('/admin/campaigns'),
  createCampaign: (data: any) => api.post('/admin/campaigns', data),
  updateCampaign: (id: number, data: any) => api.patch(`/admin/campaigns/${id}`, data),
  deleteCampaign: (id: number) => api.delete(`/admin/campaigns/${id}`),
  getCustomers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/admin/customers', { params }),
  getOrders: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/orders', { params }),
  // Agent-Influencer Assignments
  getInfluencers: () => api.get('/admin/influencers'),
  getAgentInfluencerAssignments: (agentId?: number) =>
    api.get('/admin/agent-influencer-assignments', { params: agentId ? { agentId } : {} }),
  setAgentInfluencerAssignments: (
    agentId: number,
    influencerIds: number[],
    autoAssign?: boolean,
    // Narrows an assigned account to a subset of its products. An account left
    // out of this list keeps the whole-account scope.
    productAssignments?: { influencerId: number; productIds: number[] }[]
  ) =>
    api.post('/admin/agent-influencer-assignments', {
      agentId,
      influencerIds,
      autoAssign,
      productAssignments,
    }),
  removeAgentInfluencerAssignment: (agentId: number, influencerId: number) =>
    api.delete(`/admin/agent-influencer-assignments/${agentId}/${influencerId}`),
  // Agent-Product Assignments
  getAgentProductAssignments: (agentId?: number) =>
    api.get('/admin/agent-product-assignments', { params: agentId ? { agentId } : {} }),
  getInfluencerProducts: (influencerId: number) =>
    api.get(`/admin/influencers/${influencerId}/products`),
  // Helper-User Assignments
  getHelperUserAssignments: (helperId?: number) =>
    api.get('/admin/helper-user-assignments', { params: helperId ? { helperId } : {} }),
  setHelperUserAssignments: (
    helperId: number,
    targetUserIds: number[],
    autoAssign?: boolean,
    autoAssignVendors?: boolean,
    autoAssignInfluencers?: boolean
  ) =>
    api.post('/admin/helper-user-assignments', {
      helperId,
      targetUserIds,
      autoAssign,
      autoAssignVendors,
      autoAssignInfluencers,
    }),
  getHelperAffiliateStats: () => api.get('/admin/helpers/affiliate-stats'),
  updateHelperAffiliateConfig: (id: number, data: { canManageAffiliateInvites?: boolean; helperCommissionPerDeliveredLead?: number }) =>
    api.patch(`/admin/helpers/${id}/affiliate-config`, data),
  getPaymentMonitoring: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/admin/payment-monitoring', { params }),
  getUserPaymentMonitoring: (id: number, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/admin/payment-monitoring/user/${id}`, { params }),
  bulkUpdatePaymentSituation: (data: { leadIds: number[]; situation: string }) => 
    api.patch('/admin/payment-monitoring/bulk-update', data),
  updateLeadPaymentFees: (id: number, data: { customPlatformFeeRate?: number | null; customShippingFee?: number | null }) => 
    api.patch(`/admin/payment-monitoring/lead/${id}`, data),
  getInvoices: (params?: { page?: number; limit?: number; search?: string; role?: string; userId?: string | number; startDate?: string; endDate?: string }) =>
    api.get('/admin/invoices', { params }),
  getInvoice: (id: number) => api.get(`/admin/invoices/${id}`),
  updateInvoiceStatus: (id: number, status: string) => api.patch(`/admin/invoices/${id}/status`, { status }),
  // Backups
  listBackups: (params?: { page?: number; limit?: number; search?: string; startDate?: string; endDate?: string }) => 
    api.get('/admin/backups', { params }),
  triggerBackup: () => api.post('/admin/backups/manual'),
  downloadBackupUrl: (filename: string) => `${BACKEND_URL}/api/v1/admin/backups/download/${filename}`,
  deleteBackup: (filename: string) => api.delete(`/admin/backups/${filename}`),
  restoreBackup: (filename: string) => api.post(`/admin/backups/restore/${filename}`),
  getBackupConfig: () => api.get('/admin/backups/config'),
  updateBackupConfig: (data: { interval: string; maxBackups: number; enabled: boolean; excludeSessionData: boolean }) => api.post('/admin/backups/config', data),
  // Activity Logs
  getActivityLogs: (params?: { page?: number; limit?: number; userId?: number; action?: string }) => 
    api.get('/admin/audit-logs', { params }),
  clearActivityLogs: () => api.delete('/admin/audit-logs'),
  // Call Center Inspector
  getCallCenterAgents: (params?: { startDate?: string; endDate?: string }) => api.get('/admin/call-center-agents', { params }),
  getCallCenterAgentLeads: (agentId: number, params?: { status?: string; search?: string; page?: number; limit?: number; startDate?: string; endDate?: string }) =>
    api.get('/admin/call-center-agents', { params: { agentId, ...params } }),
  getFinanceUsers: () => api.get('/admin/finance/users'),
  adjustWallet: (data: { userId: number; amount: number; type: 'CREDIT' | 'DEBIT'; description?: string }) => 
    api.post('/admin/wallet/adjust', data),
  getSheetCreditsUsers: () => api.get('/admin/sheet-credits/users'),
  adjustSheetCredits: (data: { userId: number; amount: number; type: 'CREDIT' | 'DEBIT'; description?: string }) =>
    api.post('/admin/sheet-credits/adjust', data),
  // Influencer Inspector
  getInfluencerInspector: () => api.get('/admin/influencer-inspector'),
  getSupportInspector: () => api.get('/admin/support-inspector'),
  getReferralLinks: () => api.get('/admin/referral-links'),
  deleteReferralLink: (id: number) => api.delete(`/admin/referral-links/${id}`),
  getContactMessages: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get('/admin/contact-messages', { params }),
  updateContactMessageStatus: (id: number, status: string) =>
    api.patch(`/admin/contact-messages/${id}/status`, { status }),
  deleteContactMessage: (id: number) =>
    api.delete(`/admin/contact-messages/${id}`),
  // Professional Emails
  getProfessionalEmails: () => api.get('/admin/professional-emails'),
  createProfessionalEmail: (data: { username: string; password?: string }) =>
    api.post('/admin/professional-emails', data),
  changeProfessionalEmailPassword: (data: { username: string; password?: string }) =>
    api.post('/admin/professional-emails/change-password', data),
  deleteProfessionalEmail: (username: string) =>
    api.delete(`/admin/professional-emails/${username}`),
};

export const chatApi = {
  conversations: (params?: { status?: string; orderNumber?: string }) => api.get('/chat/conversations', { params }),
  getQueue: () => api.get('/chat/conversations/queue'),
  getConversation: (id: string) => api.get(`/chat/conversations/${id}`),
  createConversation: (data: { participantId?: string; type?: string; title?: string; metadata?: any }) => api.post('/chat/conversations', data),
  autoOpenConversation: (params: { 
    orderId?: number; 
    supportRequestId?: number; 
    affiliateClaimId?: number;
    productId: number; 
    brandName?: string; 
    requestedQty?: number; 
    brandingLabelPrintUrl?: string;
    requestedLandingPageUrl?: string;
    subject?: string;
    type?: string;
    description?: string;
  }) => api.post('/chat/conversations/auto-open', params),
  claimConversation: (id: string) => api.post(`/chat/conversations/${id}/claim`),
  closeConversation: (id: string) => api.post(`/chat/conversations/${id}/close`),
  openConversation: (id: string) => api.post(`/chat/conversations/${id}/open`),
  messages: (conversationId: string, params?: { page?: number; limit?: number }) => api.get(`/chat/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId: string, data: { content: string; messageType?: string; attachmentUrl?: string }) => api.post(`/chat/conversations/${conversationId}/messages`, data),
  markAsRead: (conversationId: string) => api.patch(`/chat/conversations/${conversationId}/read`),
  getConversationLogs: (id: string) => api.get(`/chat/conversations/${id}/logs`),
};

export const inventoryApi = {
  purchased: (params?: { page?: number; limit?: number }) =>
    api.get('/inventory/purchased', { params }),
  claimed: (params?: { page?: number; limit?: number }) =>
    api.get('/inventory/claimed', { params }),
};

export const fulfillmentApi = {
  createRequest: (data: { type: string; subject: string; description: string; productId?: number }) =>
    api.post('/fulfillment', data),
  listRequests: (params?: { status?: string; type?: string; page?: number; limit?: number }) =>
    api.get('/fulfillment/my-requests', { params }),
  adminListRequests: (params?: { status?: string; type?: string; page?: number; limit?: number }) =>
    api.get('/fulfillment', { params }),
  fulfillRequest: (id: string, data: { actionType: string; productId?: number; quantity?: number; cloneName?: string; cloneDescription?: string; clonePrice?: number; cloneImageUrls?: string[] }) =>
    api.post(`/fulfillment/${id}/fulfill`, data),
  rejectRequest: (id: string) =>
    api.patch(`/fulfillment/${id}/reject`),
};

/** Vendor sub-accounts. VENDOR-only: a sub-account cannot reach any of these. */
export const vendorSubAccountsApi = {
  list: () => api.get('/vendor/sub-accounts'),
  /** The vendor's own catalogue — what the product picker offers. */
  assignableProducts: () => api.get('/vendor/sub-accounts/assignable-products'),
  create: (data: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    subAllowedModes?: 'BOTH' | 'SELLER' | 'AFFILIATE';
    subReadOnly?: boolean;
    subAccessExpiresAt?: string | null;
    permissions?: Record<string, boolean>;
    /** Empty = the whole catalogue. See lib/subAccountPermissions.ts. */
    productIds?: number[];
  }) => api.post('/vendor/sub-accounts', data),
  update: (uuid: string, data: {
    fullName?: string;
    phone?: string;
    subAllowedModes?: 'BOTH' | 'SELLER' | 'AFFILIATE';
    subReadOnly?: boolean;
    subAccessExpiresAt?: string | null;
    permissions?: Record<string, boolean>;
    productIds?: number[];
  }) => api.patch(`/vendor/sub-accounts/${uuid}`, data),
  setStatus: (uuid: string, isActive: boolean) =>
    api.patch(`/vendor/sub-accounts/${uuid}/status`, { isActive }),
  setPassword: (uuid: string, password: string) =>
    api.post(`/vendor/sub-accounts/${uuid}/password`, { password }),
  remove: (uuid: string) => api.delete(`/vendor/sub-accounts/${uuid}`),
};

export const dashboardApi = {
  sellerAffiliate: (params?: any) => api.get('/dashboard/seller-affiliate', { params }),
  // The traffic cards only: the dashboard payload is loaded once and filtered in
  // the browser, but click counts have to be re-read per window.
  sellerAffiliateTraffic: (params?: { start?: string; end?: string; referralLinkId?: string | number }) =>
    api.get('/dashboard/seller-affiliate/traffic', { params }),
  switchMode: (mode: 'SELLER' | 'AFFILIATE') => api.patch('/dashboard/seller-affiliate/switch-mode', { mode }),
  grosseller: () => api.get('/dashboard/grosseller'),
  agent: () => api.get('/dashboard/agent'),
  confirmation: () => api.get('/dashboard/confirmation'),
  influencer: (params?: any) => api.get('/dashboard/influencer', { params }),
  admin: () => api.get('/dashboard/admin'),
};

export const influencerApi = {
  enable: () => api.post('/influencer/enable'),
  createLink: (productId: number, customName?: string) => api.post('/influencer/links', { productId, customName }),
  checkLinkNameUnique: (name: string) => api.get('/influencer/links/check-unique', { params: { name } }),
  getLinks: (params?: { start?: string; end?: string; mode?: string }) => api.get('/influencer/links', { params }),
  getLinkStats: (code: string) => api.get(`/influencer/links/${code}/stats`),
  trackConversion: (code: string, orderId: number) => api.post('/influencer/track-conversion', { code, orderId }),
  getCommissions: () => api.get('/influencer/commissions'),
  getProfile: () => api.get('/influencer/profile'),
  getClaims: () => api.get('/influencer/claims'),
  pushLeadToCallCenter: (id: number) => api.post(`/influencer/leads/${id}/push-callcenter`),
  pushLeadsToCallCenterBulk: (leadIds: number[]) => api.post('/influencer/leads/push-callcenter/bulk', { leadIds }),
  deleteLead: (id: number) => api.delete(`/influencer/leads/${id}`),
  deleteLeadsBulk: (leadIds: number[]) => api.post('/influencer/leads/delete/bulk', { leadIds }),
  claimProduct: (data: { 
    productId: number; 
    brandingLabelPrintUrl?: string; 
    brandName?: string; 
    requestedQty?: number; 
    requestedLandingPageUrl?: string;
    userMode?: string;
  }) => api.post('/influencer/claims', data),
  getCustomers: (params?: { page?: number; limit?: number; search?: string; all?: boolean; summary?: boolean; mode?: string }) =>
    api.get('/influencer/customers', { params }),
  // Full status history behind one customers-list row — the slim list only
  // carries statusChangedAt/hasHistory; the history modal loads the rest here.
  // Takes whichever id the row has: an order that was never a lead has history
  // of its own.
  getCustomerHistory: (params: { leadId?: number; orderId?: number; mode?: string }) =>
    api.get('/influencer/customers/history', { params }),
  getCampaigns: () => api.get('/influencer/campaigns'),
  createCampaign: (data: any) => api.post('/influencer/campaigns', data),
  updateCampaign: (id: number, data: any) => api.patch(`/influencer/campaigns/${id}`, data),
  deleteCampaign: (id: number) => api.delete(`/influencer/campaigns/${id}`),
  sendRegenOtp: (id: number) => api.post(`/influencer/links/${id}/send-regen-otp`),
  verifyRegenOtp: (id: number, otp: string) => api.post(`/influencer/links/${id}/verify-regen-otp`, { otp }),
  updateLinkStatus: (id: number, isActive: boolean, status?: string) => api.patch(`/influencer/links/${id}/status`, { isActive, status }),
  getDailyAnalytics: (params?: { days?: number | 'all'; start?: string; end?: string; referralLinkId?: number; mode?: string }) => 
    api.get('/influencer/analytics/daily', { params }),
};

export const helperApi = {
  getAssignedLinks: () => api.get('/influencer/helper/links'),
  sendRegenOtp: (id: number) => api.post(`/influencer/links/${id}/send-regen-otp`),
  verifyRegenOtp: (id: number, otp: string) => api.post(`/influencer/links/${id}/verify-regen-otp`, { otp }),
  updateLinkStatus: (id: number, isActive: boolean, status?: string) => api.patch(`/influencer/links/${id}/status`, { isActive, status }),
  getLandingPage: (id: number) => api.get(`/influencer/links/${id}/landing-page`),
  updateLandingPage: (id: number, data: any) => api.put(`/influencer/links/${id}/landing-page`, data),
  verifyReturnCode: (code: string) => api.post('/leads/verify-return', { code }),
  bulkScanReturns: (orderIds: number[]) => api.post('/leads/bulk-scan-returns', { orderIds }),
  scanReturn: (code: string) => api.post('/leads/scan-return', { code }),
};

export const marketplaceApi = {
  products: (params?: { view?: 'REGULAR' | 'AFFILIATE' | 'INFLUENCER'; category?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/public/marketplace/products', { params }),
  stats: () => api.get('/public/marketplace/stats'),
};
export const announcementApi = {
  getAdminAnnouncements: () => api.get('/announcements'),
  createAnnouncement: (data: any) => api.post('/announcements', data),
  updateAnnouncement: (id: number, data: any) => api.patch(`/announcements/${id}`, data),
  toggleAnnouncement: (id: number, isActive: boolean) => api.patch(`/announcements/${id}/toggle`, { isActive }),
  deleteAnnouncement: (id: number) => api.delete(`/announcements/${id}`),
  getMyAnnouncements: () => api.get('/announcements/my-announcements'),
};

export const securityApi = {
  overview: () => api.get('/admin/security/overview'),
  getServerPerformance: () => api.get('/admin/security/server-performance'),
  blockIP: (ip: string) => api.post('/admin/security/block-ip', { ip }),
  unblockIP: (ip: string) => api.delete('/admin/security/block-ip', { data: { ip } }),
  clearThreat: (ip?: string) => api.delete('/admin/security/clear-threat', { data: { ip } }),
  getSettings: () => api.get('/admin/security/settings'),
  updateSettings: (data: any) => api.put('/admin/security/settings', data),

  // Session Inventory
  getSessions: () => api.get('/admin/security/sessions'),
  terminateSession: (socketId: string) => api.delete(`/admin/security/sessions/${socketId}`),
  blockGlobalSession: (socketId: string) => api.post(`/admin/security/sessions/${socketId}/block-global`),
  banUserAccount: (userUuid: string) => api.post(`/admin/security/users/${userUuid}/ban`),
  blockUserAgent: (userAgent: string) => api.post('/admin/security/block-useragent', { userAgent }),
  batchBan: (data: {
    socketId?: string;
    userUuid?: string;
    publicIp?: string;
    currentPage?: string;
    userAgent?: string;
    options: {
      banIp?: boolean;
      banCurrentPage?: boolean;
      banGlobal?: boolean;
      banAccount?: boolean;
      banUserAgent?: boolean;
    };
  }) => api.post('/admin/security/batch-ban', data),
  getBlockedSessions: () => api.get('/admin/security/sessions/blocks'),
  unblockSession: (key: string) => api.delete(`/admin/security/sessions/blocks/${encodeURIComponent(key)}`),
  unblockAllSessions: () => api.delete('/admin/security/sessions/blocks/all'),

  // Incidents
  getIncidents: () => api.get('/admin/security/incidents'),
  createIncident: (data: { title: string; severity: 'INFO' | 'WARNING' | 'CRITICAL'; recommendedSteps?: string }) =>
    api.post('/admin/security/incidents', data),
  updateIncident: (id: string, data: { status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE'; assignedAdminId?: number }) =>
    api.put(`/admin/security/incidents/${id}`, data),

  // Alert Rules
  getAlertRules: () => api.get('/admin/security/rules/alert'),
  createAlertRule: (data: { name: string; eventType: string; condition: string; threshold: number; action: string }) =>
    api.post('/admin/security/rules/alert', data),
  toggleAlertRule: (id: string, isActive: boolean) =>
    api.put(`/admin/security/rules/alert/${id}`, { isActive }),
  deleteAlertRule: (id: string) =>
    api.delete(`/admin/security/rules/alert/${id}`),

  // Playbooks
  getPlaybooks: () => api.get('/admin/security/playbooks'),
  updatePlaybookStep: (id: string, steps: any[]) =>
    api.post(`/admin/security/playbooks/${id}/step`, { steps }),

  // Compliance
  getCompliance: () => api.get('/admin/security/compliance'),
  verifyCompliance: (id: string, data: { status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL'; evidenceLink?: string }) =>
    api.post(`/admin/security/compliance/verify/${id}`, data),
  exportCompliancePdf: () =>
    api.get('/admin/security/compliance/export-pdf', { responseType: 'blob' }),

  // GDPR Requests
  getGdprRequests: () => api.get('/admin/security/gdpr/requests'),
  createGdprRequest: (data: { requesterEmail: string; requestType: 'RIGHT_TO_ERASURE' | 'ACCESS_REQUEST' }) =>
    api.post('/admin/security/gdpr/requests', data),
  updateGdprRequest: (id: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED') =>
    api.put(`/admin/security/gdpr/requests/${id}`, { status }),

  // Pentest findings
  getPentest: () => api.get('/admin/security/pentest'),
  createPentest: (data: { title: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; owner: string }) =>
    api.post('/admin/security/pentest', data),

  // CVE vulnerability database
  getVulns: () => api.get('/admin/security/vulns'),

  // Immutable Audit Chain Logs
  getAuditLogs: () => api.get('/admin/security/audit/logs'),
  verifyAuditChain: () => api.get('/admin/security/audit/verify'),

  // Global Threat Heatmap & Advanced Analytics
  getAnalytics: () => api.get('/admin/security/analytics'),

  // Database Infrastructure Stats
  getDatabaseStats: () => api.get('/admin/security/database-stats'),
};

/**
 * The maintenance flag is read twice on first paint — once by MaintenanceGuard
 * and once by AuthContext — and the guard re-reads it on every navigation.
 * Unshared that is two identical requests before the page's own data call, and
 * because the client sends credentials each one also costs a CORS preflight
 * whenever the API is not same-origin.
 *
 * Concurrent callers share one promise and the result is held for a short
 * window, so a mount or a burst of navigation collapses to a single request.
 * The window is deliberately short: this flag decides whether the platform is
 * reachable at all, so it must not go stale for long.
 *
 * A rejection is never cached — one network blip would otherwise disable the
 * check for the rest of the window.
 */
let maintenanceInFlight: Promise<any> | null = null;
let maintenanceFetchedAt = 0;
const MAINTENANCE_TTL_MS = 15_000;

const getMaintenanceStatus = () => {
  const fresh =
    maintenanceInFlight && Date.now() - maintenanceFetchedAt < MAINTENANCE_TTL_MS;

  if (!fresh) {
    maintenanceFetchedAt = Date.now();
    maintenanceInFlight = api.get('/settings/maintenance').catch((err) => {
      maintenanceInFlight = null;
      maintenanceFetchedAt = 0;
      throw err;
    });
  }

  return maintenanceInFlight!;
};

export const settingsApi = {
  getMaintenanceStatus,
  verifyMaintenanceBypass: (password: string) => api.post('/settings/maintenance/verify', { password }),
  getAdminMaintenanceSettings: () => api.get('/settings/maintenance/admin'),
  updateMaintenanceSettings: (data: { enabled: boolean; secret: string; registrationBlocked: boolean; influencerRegistrationBlocked: boolean; showIdentityVerification?: boolean; showBankVerification?: boolean; showContractVerification?: boolean }) => api.put('/settings/maintenance', data),
  getCacheVersion: () => api.get('/public/version'),
  refreshCache: () => api.post('/admin/cache-refresh'),
  resetRankLevels: () => api.post('/admin/reset-rank-levels'),
};

export const webhooksApi = {
  getLogs: (params?: { page?: number; limit?: number; provider?: string; status?: string }) =>
    api.get('/webhooks/logs', { params }),
  clearLogs: () => api.delete('/webhooks/logs'),
  simulateColiaty: (data: any) => api.post('/webhooks/coliaty', data),
};

export const supportApi = {
  list: (params?: { status?: string; search?: string }) => api.get('/support', { params }),
  create: (data: { subject: string; type: string; description: string; productId?: number }) => api.post('/support', data),
};

export const invoiceApi = {
  list: (params?: { page?: number; limit?: number }) => api.get('/invoices', { params }),
  stats: () => api.get('/invoices/stats'),
  get: (id: number) => api.get(`/invoices/${id}`),
};

export const notificationsApi = {
  list: (params?: { page?: number; limit?: number }) => api.get('/notifications', { params }),
  markRead: (id: number) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  delete: (id: number) => api.delete(`/notifications/${id}`),
  deleteAll: () => api.delete('/notifications'),
};

export const userPixelApi = {
  list: (platform?: string) => api.get('/user-pixels', { params: { platform } }),
  create: (data: { name: string; type: string; pixelId: string; platform?: string; targetIds?: string[]; conversionEvent?: string }) => api.post('/user-pixels', data),
  delete: (id: number) => api.delete(`/user-pixels/${id}`),
  verify: (pixelId: string) => api.post('/user-pixels/verify', { pixelId }),
};

export const domainApi = {
  connect: (domain: string) => api.post('/domain/connect', { domain }),
  refresh: () => api.post('/domain/refresh'),
  disconnect: () => api.delete('/domain/disconnect'),
};

export const customProductsApi = {
  createRequest: (data: { name: string; category: string; productLink?: string | null; quantity: number; description: string; imageUrl?: string | null; userType?: string | null }) =>
    api.post('/custom-products', data),
  listRequests: (params?: { status?: string }) =>
    api.get('/custom-products', { params }),
  updateStatus: (id: number, status: 'APPROVED' | 'REJECTED' | 'PENDING') =>
    api.patch(`/custom-products/${id}/status`, { status }),
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export const youcanApi = {
  getStatus: () => api.get('/youcan/status'),
  syncNow: () => api.post('/youcan/sync'),
  toggleSync: (active: boolean) => api.post('/youcan/toggle-sync', { active }),
  disconnect: () => api.post('/youcan/disconnect'),
  exchangeToken: (code: string) => api.post('/youcan/token', { code }),
  getOrders: (params?: any) => api.get('/youcan/orders', { params }),
  getCustomers: (params?: any) => api.get('/youcan/customers', { params }),
};

export const shopifyApi = {
  getStatus: () => api.get('/shopify/status'),
  syncNow: () => api.post('/shopify/sync'),
  exchangeToken: (data: { code: string; shop: string }) => api.post('/shopify/token', data),
  saveToken: (data: { storeDomain: string; accessToken?: string }) => api.post('/shopify/save-token', data),
  toggleSync: (active: boolean) => api.post('/shopify/toggle-sync', { active }),
  disconnect: () => api.post('/shopify/disconnect'),
  getOrders: (params?: any) => api.get('/shopify/orders', { params }),
};

export const wooCommerceApi = {
  getStatus: () => api.get('/woocommerce/status'),
  getAuthorizeUrl: (storeUrl: string) => api.post('/woocommerce/authorize-url', { storeUrl }),
  saveKeys: (data: { storeUrl: string; consumerKey: string; consumerSecret: string }) => api.post('/woocommerce/save-keys', data),
  toggleSync: (active: boolean) => api.post('/woocommerce/toggle-sync', { active }),
  disconnect: () => api.post('/woocommerce/disconnect'),
  getOrders: (params?: any) => api.get('/woocommerce/orders', { params }),
  syncNow: () => api.post('/woocommerce/sync'),
};

export const googleSheetsApi = {
  getStatus: () => api.get('/google-sheets/status'),
  connect: (sheetUrl: string) => api.post('/google-sheets/connect', { sheetUrl }),
  toggleSync: (active: boolean) => api.post('/google-sheets/toggle-sync', { active }),
  disconnect: () => api.post('/google-sheets/disconnect'),
  getOrders: (params?: any) => api.get('/google-sheets/orders', { params }),
  syncNow: () => api.post('/google-sheets/sync-now'),
  rotateToken: () => api.post('/google-sheets/rotate-token'),

  // ── Outbound: leads pushed INTO the seller's own sheet ───────────────────
  // Distinct from everything above, which pulls orders OUT of a sheet.
  getOutboundStatus: () => api.get('/google-sheets/outbound/status'),
  connectOutbound: (data: { sheetUrl: string; tab?: string }) =>
    api.post('/google-sheets/outbound/connect', data),
  disconnectOutbound: () => api.post('/google-sheets/outbound/disconnect'),
  toggleOutbound: (data: { active?: boolean; auto?: boolean }) =>
    api.post('/google-sheets/outbound/toggle', data),
  testOutbound: () => api.post('/google-sheets/outbound/test'),
  // Writes the formatted header template at the top of the seller's tab. Free.
  setupSheetHeader: () => api.post('/google-sheets/outbound/setup-header'),
  getOutboundJobs: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/google-sheets/outbound/jobs', { params }),
  pushLeadsToSheet: (leadIds: number[]) =>
    api.post('/google-sheets/outbound/push', { leadIds }),
  // Which of these leads already have a row in the seller's sheet — drives the
  // little sheet badge in the leads table.
  getSheetSentStatus: (leadIds: number[]) =>
    api.post('/google-sheets/outbound/sent-status', { leadIds }),
  // Re-reads the sheet itself and reconciles it with what we think we sent: a
  // seller deleting rows by hand is invisible to us until we look again.
  recheckSheet: () => api.post('/google-sheets/outbound/reconcile'),
};

export const sheetCreditsApi = {
  me: () => api.get('/sheet-credits/me'),
  transactions: (params?: { page?: number; limit?: number }) =>
    api.get('/sheet-credits/transactions', { params }),
};

export const eventApi = {
  getStatus: () => api.get('/event/status'),
  register: (data: any) => api.post('/event/register', data),
  getAdminRegistrations: () => api.get('/event/admin/registrations'),
  toggleAdminStatus: (enabled: boolean) => api.put('/event/admin/status', { enabled }),
  deleteAdminRegistration: (id: number) => api.delete(`/event/admin/registrations/${id}`),
};


