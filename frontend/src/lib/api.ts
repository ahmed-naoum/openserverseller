import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = (import.meta.env as any).VITE_API_URL || 'http://localhost:3001/api/v1';
export const BACKEND_URL = API_URL.replace('/api/v1', '');

export interface User {
  id: number;
  uuid: string;
  email: string;
  fullName: string;
  role: string;
  [key: string]: any;
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const bypassToken = localStorage.getItem('maintenance_bypass');
    if (bypassToken && config.headers) {
      config.headers['x-maintenance-bypass'] = bypassToken;
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
  register: (data: { email?: string; phone?: string; password: string; fullName: string; role?: string }) =>
    api.post('/auth/register', data),
  registerInfluencer: (data: { email?: string; phone?: string; password: string; fullName: string; instagramUsername?: string; tiktokUsername?: string; facebookUsername?: string; }) =>
    api.post('/auth/register-influencer', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (data: { email?: string; phone?: string }) =>
    api.post('/auth/forgot-password', data),
  resetPassword: (data: { token: string; password: string }) =>
    api.post('/auth/reset-password', data),
  verifyResetToken: (token: string) =>
    api.get(`/auth/verify-reset-token/${token}`),
  verifyOtp: (data: { email?: string; phone?: string; otp: string }) =>
    api.post('/auth/verify-otp', data),
  googleAuth: (data: { credential: string; role?: string }) =>
    api.post('/auth/google', data),
  login2FA: (data: { twoFactorToken: string; code: string }) =>
    api.post('/auth/login/2fa', data),
  setup2FA: () => api.post('/auth/2fa/setup'),
  verify2FA: (data: { code: string; secret?: string }) =>
    api.post('/auth/2fa/verify', data),
};

export const brandsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/brands', { params }),
  get: (slug: string) => api.get(`/brands/${slug}`),
  create: (data: any) => api.post('/brands', data),
  update: (id: string, data: any) => api.patch(`/brands/${id}`, data),
  submit: (id: string) => api.post(`/brands/${id}/submit`),
  addBankAccount: (id: string, data: any) => api.post(`/brands/${id}/bank-account`, data),
};

export const productsApi = {
  list: (params?: { category?: string; search?: string; page?: number; limit?: number; status?: string; myProducts?: string }) =>
    api.get('/products', { params }),
  get: (id: string) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.patch(`/products/${id}`, data),
  updateStatus: (id: string, data: { status: string }) => api.patch(`/products/${id}/status`, data),
  customize: (id: string, data: any) => api.post(`/products/${id}/customize`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  cloneForUser: (id: string, data: { userId: number; newSku?: string; newName?: string }) =>
    api.post(`/products/${id}/clone`, data),
};

export const leadsApi = {
  list: (params?: { status?: string; page?: number; limit?: number; search?: string; viewMode?: string }) =>
    api.get('/leads', { params }),
  create: (data: any) => api.post('/leads', data),
  import: (data: { brandId: string; leads: any[] }) => api.post('/leads/import', data),
  importWithProduct: (data: { productId: number; leads: any[] }) => api.post('/leads/import', data),
  getMyProducts: () => api.get('/leads/my-products'),
  updateStatus: (id: string, data: { status: string; notes?: string }) =>
    api.patch(`/leads/${id}/status`, data),
  assign: (id: string, data: { agentId: string }) => api.post(`/leads/${id}/assign`, data),
  available: (params?: { influencerId?: number }) => api.get('/leads/available', { params }),
  claim: (id: number) => api.post(`/leads/${id}/claim`),
  detail: (id: number) => api.get(`/leads/${id}/detail`),
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
    }
  ) => api.post(`/leads/${id}/push-to-delivery`, data),
  livraison: (params?: { page?: number; limit?: number }) =>
    api.get('/leads/livraison', { params }),
  getParcelHistory: (code: string) => api.get(`/leads/coliaty/parcel/${code}/history`),
  getColiatyCities: () => api.get('/leads/coliaty/cities'),
  delete: (id: string) => api.delete(`/leads/${id}`),
};

export const ordersApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/orders', { params }),
  get: (id: string) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  updateStatus: (id: string, data: { status: string; notes?: string }) =>
    api.patch(`/orders/${id}/status`, data),
  revertToLead: (id: number) => api.post(`/orders/${id}/revert-to-lead`),
  changeDemand: (id: number, data: any) => api.post(`/orders/${id}/change-demand`, data),
  updateNormal: (id: number, data: any) => api.put(`/orders/${id}/update-normal`, data),
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
};

export const categoriesApi = {
  list: () => api.get('/categories'),
  create: (data: { nameAr: string; nameFr: string; nameEn?: string; slug: string; parentId?: number; imageUrl?: string }) =>
    api.post('/categories', data),
  update: (id: number, data: any) => api.patch(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
};

export const publicApi = {
  cities: () => api.get('/public/cities'),
  categories: () => api.get('/public/categories'),
  featuredProducts: () => api.get('/public/products/featured'),
  stats: () => api.get('/public/stats'),
  getReferralLinkData: (code: string) => api.get(`/influencer/links/${code}/public`),
  submitReferralLead: (data: { referralCode: string; fullName: string; phone: string; city: string; address: string }) => api.post('/public/leads', data),
};

export const uploadApi = {
  image: (data: FormData) => api.post('/upload/image', data, {
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
  users: (params?: { role?: string; status?: string; page?: number; limit?: number; search?: string }) =>
    api.get('/users', { params }),
  createUser: (data: any) => api.post('/users', data),
  updateUser: (uuid: string, data: any) => api.patch(`/users/${uuid}/admin-edit`, data),
  activateUser: (uuid: string) => api.patch(`/users/${uuid}/activate`),
  deactivateUser: (uuid: string) => api.patch(`/users/${uuid}/deactivate`),
  updateKycStatus: (uuid: string, status: string) => api.patch(`/users/${uuid}/kyc-status`, { status }),
  reset2FA: (uuid: string) => api.post(`/users/${uuid}/reset-2fa`),
  sendPasswordResetLink: (uuid: string) => api.post(`/users/${uuid}/send-password-reset`),
  approveBrand: (id: string) => api.post(`/brands/${id}/approve`),
  rejectBrand: (id: string) => api.post(`/brands/${id}/reject`),
  approvePayout: (id: string, data?: { receiptUrl?: string }) =>
    api.patch(`/payouts/${id}/approve`, data),
  rejectPayout: (id: string) => api.patch(`/payouts/${id}/reject`),
  getAffiliateClaims: (params?: { status?: string }) => api.get('/admin/affiliate-claims', { params }),
  updateAffiliateClaim: (id: number, data: { status: string; actionType?: string; cloneName?: string; cloneDescription?: string; clonePrice?: number; cloneImageUrls?: string[] }) => 
    api.patch(`/admin/affiliate-claims/${id}`, data),
  // Campaigns
  getCampaigns: () => api.get('/admin/campaigns'),
  createCampaign: (data: any) => api.post('/admin/campaigns', data),
  updateCampaign: (id: number, data: any) => api.patch(`/admin/campaigns/${id}`, data),
  deleteCampaign: (id: number) => api.delete(`/admin/campaigns/${id}`),
  getCustomers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/admin/customers', { params }),
  // Agent-Influencer Assignments
  getInfluencers: () => api.get('/admin/influencers'),
  getAgentInfluencerAssignments: (agentId?: number) =>
    api.get('/admin/agent-influencer-assignments', { params: agentId ? { agentId } : {} }),
  setAgentInfluencerAssignments: (agentId: number, influencerIds: number[]) =>
    api.post('/admin/agent-influencer-assignments', { agentId, influencerIds }),
  removeAgentInfluencerAssignment: (agentId: number, influencerId: number) =>
    api.delete(`/admin/agent-influencer-assignments/${agentId}/${influencerId}`),
};

export const chatApi = {
  conversations: (params?: { status?: string }) => api.get('/chat/conversations', { params }),
  getConversation: (id: string) => api.get(`/chat/conversations/${id}`),
  createConversation: (data: { participantId?: string; type?: string; title?: string }) => api.post('/chat/conversations', data),
  messages: (conversationId: string, params?: { page?: number; limit?: number }) => api.get(`/chat/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId: string, data: { content: string; messageType?: string; attachmentUrl?: string }) => api.post(`/chat/conversations/${conversationId}/messages`, data),
  markAsRead: (conversationId: string) => api.patch(`/chat/conversations/${conversationId}/read`),
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

export const dashboardApi = {
  sellerAffiliate: () => api.get('/dashboard/seller-affiliate'),
  switchMode: (mode: 'SELLER' | 'AFFILIATE') => api.patch('/dashboard/seller-affiliate/switch-mode', { mode }),
  grosseller: () => api.get('/dashboard/grosseller'),
  agent: () => api.get('/dashboard/agent'),
  confirmation: () => api.get('/dashboard/confirmation'),
  influencer: () => api.get('/dashboard/influencer'),
  admin: () => api.get('/dashboard/admin'),
};

export const influencerApi = {
  enable: () => api.post('/influencer/enable'),
  createLink: (productId: number) => api.post('/influencer/links', { productId }),
  getLinks: () => api.get('/influencer/links'),
  getLinkStats: (code: string) => api.get(`/influencer/links/${code}/stats`),
  trackConversion: (code: string, orderId: number) => api.post('/influencer/track-conversion', { code, orderId }),
  getCommissions: () => api.get('/influencer/commissions'),
  getProfile: () => api.get('/influencer/profile'),
  getClaims: () => api.get('/influencer/claims'),
  claimProduct: (productId: number) => api.post('/influencer/claims', { productId }),
  getCustomers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/influencer/customers', { params }),
  deleteLead: (id: number) => api.delete(`/influencer/leads/${id}`),
  pushLeadToCallCenter: (id: number) => api.post(`/influencer/leads/${id}/push-callcenter`),
  getCampaigns: () => api.get('/influencer/campaigns'),
  createCampaign: (data: any) => api.post('/influencer/campaigns', data),
  updateCampaign: (id: number, data: any) => api.patch(`/influencer/campaigns/${id}`, data),
  deleteCampaign: (id: number) => api.delete(`/influencer/campaigns/${id}`),
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
  blockIP: (ip: string) => api.post('/admin/security/block-ip', { ip }),
  unblockIP: (ip: string) => api.delete('/admin/security/block-ip', { data: { ip } }),
  clearThreat: (ip?: string) => api.delete('/admin/security/clear-threat', { data: { ip } }),
};

export const settingsApi = {
  getMaintenanceStatus: () => api.get('/settings/maintenance'),
  verifyMaintenanceBypass: (password: string) => api.post('/settings/maintenance/verify', { password }),
  getAdminMaintenanceSettings: () => api.get('/settings/maintenance/admin'),
  updateMaintenanceSettings: (data: { enabled: boolean; secret: string }) => api.put('/settings/maintenance', data),
};

export const webhooksApi = {
  getLogs: (params?: { page?: number; limit?: number; provider?: string; status?: string }) =>
    api.get('/webhooks/logs', { params }),
  clearLogs: () => api.delete('/webhooks/logs'),
};
