import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

const API_URL = (import.meta.env as any).VITE_API_URL || 'http://localhost:3001/api/v1';

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
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
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
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (data: { email?: string; phone?: string }) =>
    api.post('/auth/forgot-password', data),
  resetPassword: (data: { email?: string; phone?: string; otp: string; password: string }) =>
    api.post('/auth/reset-password', data),
  verifyOtp: (data: { email?: string; phone?: string; otp: string }) =>
    api.post('/auth/verify-otp', data),
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
};

export const leadsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/leads', { params }),
  create: (data: any) => api.post('/leads', data),
  import: (data: { brandId: string; leads: any[] }) => api.post('/leads/import', data),
  updateStatus: (id: string, data: { status: string; notes?: string }) =>
    api.patch(`/leads/${id}/status`, data),
  assign: (id: string, data: { agentId: string }) => api.post(`/leads/${id}/assign`, data),
};

export const ordersApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/orders', { params }),
  get: (id: string) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  updateStatus: (id: string, data: { status: string; notes?: string }) =>
    api.patch(`/orders/${id}/status`, data),
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

export const publicApi = {
  cities: () => api.get('/public/cities'),
  categories: () => api.get('/public/categories'),
  featuredProducts: () => api.get('/public/products/featured'),
  stats: () => api.get('/public/stats'),
};

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  users: (params?: { role?: string; status?: string; page?: number; limit?: number; search?: string }) =>
    api.get('/users', { params }),
  createUser: (data: any) => api.post('/users', data),
  updateUser: (uuid: string, data: any) => api.patch(`/users/${uuid}/admin-edit`, data),
  activateUser: (uuid: string) => api.patch(`/users/${uuid}/activate`),
  deactivateUser: (uuid: string) => api.patch(`/users/${uuid}/deactivate`),
  approveBrand: (id: string) => api.post(`/brands/${id}/approve`),
  rejectBrand: (id: string) => api.post(`/brands/${id}/reject`),
  approvePayout: (id: string, data?: { receiptUrl?: string }) =>
    api.patch(`/payouts/${id}/approve`, data),
  rejectPayout: (id: string) => api.patch(`/payouts/${id}/reject`),
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
    api.get('/fulfillment', { params }),
  fulfillRequest: (id: string, data: { actionType: string; productId?: number; quantity?: number }) =>
    api.post(`/fulfillment/${id}/fulfill`, data),
};
