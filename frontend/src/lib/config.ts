export const config = {
  api: {
    baseUrl: (import.meta.env as any).VITE_API_URL || 'http://localhost:3001/api/v1',
    timeout: 10000,
  },
  app: {
    name: 'OpenSeller.ma',
    description: 'Plateforme de Dropshipping White-Label au Maroc',
    version: '1.0.0',
  },
  currency: {
    code: 'MAD',
    symbol: 'MAD',
    locale: 'fr-MA',
  },
  storage: {
    accessTokenKey: 'accessToken',
    refreshTokenKey: 'refreshToken',
    userKey: 'user',
    languageKey: 'language',
  },
  defaultLanguage: 'fr',
  supportedLanguages: ['fr', 'ar', 'en'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  commissionPercentage: 15,
  minPayoutAmount: 500,
  otpLength: 6,
  otpExpiryMinutes: 5,
};

export default config;
