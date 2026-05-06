import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = (import.meta.env as any).VITE_API_URL || 'http://localhost:3001/api/v1';
export const BACKEND_URL = API_URL.replace('/api/v1', '');

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
  avatarUrl?: string;
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
  forcePasswordChange: (data: { tempToken: string; newPassword: string }) =>
    api.post('/auth/force-password-change', data),
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
  disable2FA: () => api.post('/auth/2fa/disable'),
  impersonate: (data: { targetUserId: number }) =>
    api.post('/auth/impersonate', data),
  addBankAccount: (data: { bankName: string; ribAccount: string; iceNumber?: string }) =>
    api.post('/auth/bank-accounts', data),
  setDefaultBankAccount: (id: number) =>
    api.patch(`/auth/bank-accounts/${id}/default`),
  deleteBankAccount: (id: number) =>
    api.delete(`/auth/bank-accounts/${id}`),
  resendOtp: (data: { email?: string; phone?: string }) =>
    api.post('/auth/resend-otp', data),
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
  updateBranding: (id: string, data: { brandingLabelMockupUrl?: string; brandingLabelPrintUrl?: string }) =>
    api.patch(`/products/${id}/branding`, data),
};

export const leadsApi = {
  list: (params?: { status?: string; page?: number; limit?: number; search?: string; viewMode?: string; mode?: string }) =>
    api.get('/leads', { params }),
  create: (data: any) => api.post('/leads', data),
  import: (data: { leads: any[]; sourceMode?: string }) => api.post('/leads/import', data),
  importWithProduct: (data: { productId: number; leads: any[]; sourceMode?: string }) => api.post('/leads/import', data),
  getMyProducts: (params?: { mode?: string }) => api.get('/leads/my-products', { params }),
  update: (id: string, data: any) => api.patch(`/leads/${id}`, data),
  updateStatus: (id: string, data: { status: string; notes?: string }) =>
    api.patch(`/leads/${id}/status`, data),
  bulkUpdateStatus: (data: { ids: number[]; status: string }) =>
    api.patch('/leads/bulk-status', data),
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
  updatePaymentSituation: (id: string, data: { paymentSituation: string }) =>
    api.patch(`/leads/${id}/payment-situation`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
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
  getProductsWithParcels: () => api.get('/orders/products-with-parcels'),
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
  getVerifications: (filter?: string) => api.get('/admin/verifications', { params: { filter: filter || 'all' } }),
  verifyEmail: (uuid: string) => api.patch(`/admin/users/${uuid}/verify-email`),
  verifyKyc: (uuid: string, status: 'APPROVED' | 'REJECTED') =>
    api.patch(`/admin/users/${uuid}/verify-kyc`, { status }),
  verifyBank: (id: number, status: 'APPROVED' | 'REJECTED') =>
    api.patch(`/admin/bank-accounts/${id}/status`, { status }),
  users: (params?: { role?: string; status?: string; page?: number; limit?: number; search?: string }) =>
    api.get('/users', { params }),
  createUser: (data: any) => api.post('/users', data),
  updateUser: (uuid: string, data: any) => api.patch(`/users/${uuid}/admin-edit`, data),
  activateUser: (uuid: string) => api.patch(`/users/${uuid}/activate`),
  deactivateUser: (uuid: string) => api.patch(`/users/${uuid}/deactivate`),
  updateKycStatus: (uuid: string, status: string) => api.patch(`/users/${uuid}/kyc-status`, { status }),
  reset2FA: (uuid: string) => api.post(`/users/${uuid}/reset-2fa`),
  sendPasswordResetLink: (uuid: string) => api.post(`/users/${uuid}/send-password-reset`),
  approvePayout: (id: string, data?: { receiptUrl?: string }) =>
    api.patch(`/payouts/${id}/approve`, data),
  rejectPayout: (id: string) => api.patch(`/payouts/${id}/reject`),
  bulkApprovePayouts: (ids: number[]) => api.post('/payouts/bulk-approve', { ids }),
  bulkUpdatePayoutStatus: (ids: number[], status: string) => api.patch('/payouts/bulk-status', { ids, status }),
  getAffiliateClaims: (params?: { status?: string }) => api.get('/admin/affiliate-claims', { params }),
  updateAffiliateClaim: (id: number, data: { status: string; actionType?: string; cloneName?: string; cloneDescription?: string; clonePrice?: number; cloneImageUrls?: string[] }) =>
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
  // Agent-Influencer Assignments
  getInfluencers: () => api.get('/admin/influencers'),
  getAgentInfluencerAssignments: (agentId?: number) =>
    api.get('/admin/agent-influencer-assignments', { params: agentId ? { agentId } : {} }),
  setAgentInfluencerAssignments: (agentId: number, influencerIds: number[], autoAssign?: boolean) =>
    api.post('/admin/agent-influencer-assignments', { agentId, influencerIds, autoAssign }),
  removeAgentInfluencerAssignment: (agentId: number, influencerId: number) =>
    api.delete(`/admin/agent-influencer-assignments/${agentId}/${influencerId}`),
  // Helper-User Assignments
  getHelperUserAssignments: (helperId?: number) =>
    api.get('/admin/helper-user-assignments', { params: helperId ? { helperId } : {} }),
  setHelperUserAssignments: (helperId: number, targetUserIds: number[], autoAssign?: boolean) =>
    api.post('/admin/helper-user-assignments', { helperId, targetUserIds, autoAssign }),
  getPaymentMonitoring: () => api.get('/admin/payment-monitoring'),
  getUserPaymentMonitoring: (id: number) => api.get(`/admin/payment-monitoring/user/${id}`),
  bulkUpdatePaymentSituation: (data: { leadIds: number[]; situation: string }) => 
    api.patch('/admin/payment-monitoring/bulk-update', data),
  getInvoices: (params?: { page?: number; limit?: number; search?: string }) =>
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
  // Activity Logs
  getActivityLogs: (params?: { page?: number; limit?: number; userId?: number; action?: string }) => 
    api.get('/admin/audit-logs', { params }),
  // Call Center Inspector
  getCallCenterAgents: (params?: { startDate?: string; endDate?: string }) => api.get('/admin/call-center-agents', { params }),
  getCallCenterAgentLeads: (agentId: number, params?: { status?: string; search?: string; page?: number; limit?: number; startDate?: string; endDate?: string }) =>
    api.get('/admin/call-center-agents', { params: { agentId, ...params } }),
};

export const chatApi = {
  conversations: (params?: { status?: string; orderNumber?: string }) => api.get('/chat/conversations', { params }),
  getQueue: () => api.get('/chat/conversations/queue'),
  getConversation: (id: string) => api.get(`/chat/conversations/${id}`),
  createConversation: (data: { participantId?: string; type?: string; title?: string }) => api.post('/chat/conversations', data),
  autoOpenConversation: (params: { 
    orderId?: number; 
    supportRequestId?: number; 
    affiliateClaimId?: number;
    productId: number; 
    brandName?: string; 
    requestedQty?: number; 
    brandingLabelPrintUrl?: string;
    subject?: string;
    type?: string;
    description?: string;
  }) => api.post('/chat/conversations/auto-open', params),
  claimConversation: (id: string) => api.post(`/chat/conversations/${id}/claim`),
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
  getLinks: (params?: { start?: string; end?: string }) => api.get('/influencer/links', { params }),
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
  }) => api.post('/influencer/claims', data),
  getCustomers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/influencer/customers', { params }),
  getCampaigns: () => api.get('/influencer/campaigns'),
  createCampaign: (data: any) => api.post('/influencer/campaigns', data),
  updateCampaign: (id: number, data: any) => api.patch(`/influencer/campaigns/${id}`, data),
  deleteCampaign: (id: number) => api.delete(`/influencer/campaigns/${id}`),
  regenerateLink: (id: number) => api.patch(`/influencer/links/${id}/code`),
  updateLinkStatus: (id: number, isActive: boolean) => api.patch(`/influencer/links/${id}/status`, { isActive }),
  getDailyAnalytics: (params?: { days?: number; start?: string; end?: string; referralLinkId?: number }) => 
    api.get('/influencer/analytics/daily', { params }),
};

export const helperApi = {
  getAssignedLinks: () => api.get('/influencer/helper/links'),
  regenerateLink: (id: number) => api.patch(`/influencer/links/${id}/code`),
  updateLinkStatus: (id: number, isActive: boolean) => api.patch(`/influencer/links/${id}/status`, { isActive }),
  getLandingPage: (id: number) => api.get(`/influencer/links/${id}/landing-page`),
  updateLandingPage: (id: number, data: any) => api.put(`/influencer/links/${id}/landing-page`, data),
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

export const supportApi = {
  list: (params?: { status?: string; search?: string }) => api.get('/support', { params }),
  create: (data: { subject: string; type: string; description: string; productId?: number }) => api.post('/support', data),
};

export const invoiceApi = {
  list: (params?: { page?: number; limit?: number }) => api.get('/invoices', { params }),
  get: (id: number) => api.get(`/invoices/${id}`),
};

