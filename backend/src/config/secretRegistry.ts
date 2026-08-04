/**
 * Declarative registry of every environment value the application reads.
 *
 * This is the single source of truth for the admin "Variables & Secrets" screen.
 * Only keys listed here can be written to the database — the admin API never
 * accepts an arbitrary key, so a compromised admin session cannot inject
 * something like NODE_OPTIONS or PATH into the running process.
 *
 * Bootstrap keys are declared too (so the UI can show them as read-only), but
 * they can never be stored in the database:
 *   - DATABASE_URL   : needed to reach the database that holds the others
 *   - ENCRYPTION_KEY : needed to decrypt the others
 *   - JWT_SECRET     : needed by auth middleware independently of the database
 *   - NODE_ENV/PORT  : consumed by the process at boot; a DB value would be ignored
 */

export type SecretCategory =
  | 'core'
  | 'delivery'
  | 'ecommerce'
  | 'media'
  | 'email'
  | 'messaging'
  | 'security'
  | 'cloudflare'
  | 'oauth'
  | 'signature'
  | 'business'
  | 'ops';

export interface SecretDefinition {
  key: string;
  /** French label shown in the admin dashboard. */
  label: string;
  category: SecretCategory;
  /** Masked in API responses and write-only in the UI. */
  secret: boolean;
  /** Cannot be stored in the database — .env only. */
  bootstrap?: boolean;
  description?: string;
}

export const SECRET_CATEGORY_LABELS: Record<SecretCategory, string> = {
  core: 'Application',
  delivery: 'Livraison',
  ecommerce: 'Intégrations e-commerce',
  media: 'Médias & Upload',
  email: 'Email (SMTP / IMAP)',
  messaging: 'Messagerie & SMS',
  security: 'Sécurité',
  cloudflare: 'Cloudflare',
  oauth: 'Authentification externe',
  signature: 'Signature électronique',
  business: 'Règles métier',
  ops: 'Exploitation',
};

export const SECRET_REGISTRY: SecretDefinition[] = [
  // ── Bootstrap (.env only, read-only in the UI) ─────────────────────────────
  {
    key: 'DATABASE_URL',
    label: 'URL de la base de données',
    category: 'core',
    secret: true,
    bootstrap: true,
    description: 'Requis pour lire cette table — doit rester dans .env.',
  },
  {
    key: 'ENCRYPTION_KEY',
    label: 'Clé de chiffrement',
    category: 'core',
    secret: true,
    bootstrap: true,
    description:
      'Chiffre les RIB bancaires et les valeurs de cette page. La modifier rend les données existantes illisibles.',
  },
  {
    key: 'JWT_SECRET',
    label: 'Secret JWT',
    category: 'core',
    secret: true,
    bootstrap: true,
    description: 'La modifier déconnecte immédiatement tous les utilisateurs.',
  },
  { key: 'NODE_ENV', label: 'Environnement', category: 'core', secret: false, bootstrap: true },
  { key: 'PORT', label: 'Port du serveur', category: 'core', secret: false, bootstrap: true },

  // ── Application ───────────────────────────────────────────────────────────
  { key: 'SITE_NAME', label: 'Nom du site', category: 'core', secret: false },
  { key: 'API_PREFIX', label: 'Préfixe API', category: 'core', secret: false },
  { key: 'API_BASE_URL', label: 'URL de base de l’API', category: 'core', secret: false },
  { key: 'FRONTEND_URL', label: 'URL du frontend', category: 'core', secret: false },
  { key: 'REDIS_URL', label: 'URL Redis', category: 'core', secret: true },
  { key: 'JWT_EXPIRES_IN', label: 'Durée de validité du JWT', category: 'core', secret: false },
  {
    key: 'JWT_REFRESH_EXPIRES_IN',
    label: 'Durée du refresh token',
    category: 'core',
    secret: false,
  },

  // ── Livraison ─────────────────────────────────────────────────────────────
  { key: 'COLIATY_PUBLIC_KEY', label: 'Coliaty — Clé publique', category: 'delivery', secret: true },
  { key: 'COLIATY_SECRET_KEY', label: 'Coliaty — Clé secrète', category: 'delivery', secret: true },
  { key: 'COLIATY_BASE_URL', label: 'Coliaty — URL de base', category: 'delivery', secret: false },

  // ── Intégrations e-commerce ───────────────────────────────────────────────
  { key: 'YOUCAN_CLIENT_ID', label: 'YouCan — Client ID', category: 'ecommerce', secret: false },
  {
    key: 'YOUCAN_CLIENT_SECRET',
    label: 'YouCan — Client Secret',
    category: 'ecommerce',
    secret: true,
  },
  { key: 'YOUCAN_API_URL', label: 'YouCan — URL API', category: 'ecommerce', secret: false },
  { key: 'YOUCAN_AUTH_URL', label: 'YouCan — URL d’autorisation', category: 'ecommerce', secret: false },
  { key: 'YOUCAN_TOKEN_URL', label: 'YouCan — URL de token', category: 'ecommerce', secret: false },
  { key: 'SHOPIFY_CLIENT_ID', label: 'Shopify — Client ID', category: 'ecommerce', secret: false },
  {
    key: 'SHOPIFY_CLIENT_SECRET',
    label: 'Shopify — Client Secret',
    category: 'ecommerce',
    secret: true,
  },
  { key: 'SHOPIFY_API_KEY', label: 'Shopify — Clé API', category: 'ecommerce', secret: true },
  { key: 'SHOPIFY_API_SECRET', label: 'Shopify — Secret API', category: 'ecommerce', secret: true },
  {
    key: 'GOOGLE_SHEETS_API_KEY',
    label: 'Google Sheets — Clé API',
    category: 'ecommerce',
    secret: true,
  },
  {
    key: 'GOOGLE_SHEETS_READER_URL',
    label: 'Google Sheets — URL du lecteur',
    category: 'ecommerce',
    secret: false,
  },

  // ── Médias ────────────────────────────────────────────────────────────────
  { key: 'CLOUDINARY_CLOUD_NAME', label: 'Cloudinary — Cloud Name', category: 'media', secret: false },
  { key: 'CLOUDINARY_API_KEY', label: 'Cloudinary — Clé API', category: 'media', secret: true },
  { key: 'CLOUDINARY_API_SECRET', label: 'Cloudinary — Secret API', category: 'media', secret: true },

  // ── Email ─────────────────────────────────────────────────────────────────
  { key: 'SMTP_HOST', label: 'SMTP — Hôte', category: 'email', secret: false },
  { key: 'SMTP_PORT', label: 'SMTP — Port', category: 'email', secret: false },
  { key: 'SMTP_SECURE', label: 'SMTP — TLS (true/false)', category: 'email', secret: false },
  { key: 'SMTP_USER', label: 'SMTP — Utilisateur', category: 'email', secret: false },
  { key: 'SMTP_PASS', label: 'SMTP — Mot de passe', category: 'email', secret: true },
  { key: 'SMTP_FROM_EMAIL', label: 'SMTP — Adresse d’expédition', category: 'email', secret: false },
  { key: 'EMAIL_FROM', label: 'Adresse expéditeur', category: 'email', secret: false },
  { key: 'IMAP_HOST', label: 'IMAP — Hôte', category: 'email', secret: false },
  { key: 'IMAP_PORT', label: 'IMAP — Port', category: 'email', secret: false },
  { key: 'IMAP_USER', label: 'IMAP — Utilisateur', category: 'email', secret: false },
  { key: 'IMAP_PASS', label: 'IMAP — Mot de passe', category: 'email', secret: true },
  {
    key: 'ADMIN_NOTIFICATION_EMAIL',
    label: 'Email de notification admin',
    category: 'email',
    secret: false,
  },

  // ── Messagerie & SMS ──────────────────────────────────────────────────────
  { key: 'TWILIO_ACCOUNT_SID', label: 'Twilio — Account SID', category: 'messaging', secret: true },
  { key: 'TWILIO_AUTH_TOKEN', label: 'Twilio — Auth Token', category: 'messaging', secret: true },
  {
    key: 'TWILIO_PHONE_NUMBER',
    label: 'Twilio — Numéro de téléphone',
    category: 'messaging',
    secret: false,
  },
  {
    key: 'WHATSAPP_ACCESS_TOKEN',
    label: 'WhatsApp — Access Token',
    category: 'messaging',
    secret: true,
  },
  {
    key: 'WHATSAPP_PHONE_NUMBER_ID',
    label: 'WhatsApp — Phone Number ID',
    category: 'messaging',
    secret: false,
  },
  {
    key: 'WHATSAPP_VERIFY_TOKEN',
    label: 'WhatsApp — Verify Token',
    category: 'messaging',
    secret: true,
  },
  { key: 'IG_USERNAME', label: 'Instagram — Identifiant', category: 'messaging', secret: false },
  { key: 'IG_PASSWORD', label: 'Instagram — Mot de passe', category: 'messaging', secret: true },

  // ── Sécurité ──────────────────────────────────────────────────────────────
  {
    key: 'TURNSTILE_SECRET_KEY',
    label: 'Cloudflare Turnstile — Clé secrète',
    category: 'security',
    secret: true,
  },
  { key: 'BCRYPT_SALT_ROUNDS', label: 'Rounds bcrypt', category: 'security', secret: false },
  {
    key: 'RATE_LIMIT_WINDOW_MS',
    label: 'Fenêtre de rate limit (ms)',
    category: 'security',
    secret: false,
  },
  {
    key: 'RATE_LIMIT_MAX_REQUESTS',
    label: 'Requêtes max par fenêtre',
    category: 'security',
    secret: false,
  },
  {
    key: 'SECURITY_ENABLE_IP_BLOCKING',
    label: 'Blocage IP activé',
    category: 'security',
    secret: false,
  },
  {
    key: 'SECURITY_ENABLE_AUDIT_LOG',
    label: 'Journal d’audit activé',
    category: 'security',
    secret: false,
  },
  {
    key: 'SECURITY_ENABLE_SANITIZATION',
    label: 'Assainissement des entrées activé',
    category: 'security',
    secret: false,
  },
  { key: 'SECURITY_BLOCKED_IPS', label: 'IP bloquées', category: 'security', secret: false },
  {
    key: 'SECURITY_WHITELISTED_IPS',
    label: 'IP en liste blanche',
    category: 'security',
    secret: false,
  },

  // ── Cloudflare ────────────────────────────────────────────────────────────
  { key: 'CLOUDFLARE_API_TOKEN', label: 'Cloudflare — Token API', category: 'cloudflare', secret: true },
  { key: 'CLOUDFLARE_ZONE_ID', label: 'Cloudflare — Zone ID', category: 'cloudflare', secret: true },
  {
    key: 'CLOUDFLARE_FALLBACK_ORIGIN',
    label: 'Cloudflare — Origine de repli',
    category: 'cloudflare',
    secret: false,
  },

  // ── OAuth ─────────────────────────────────────────────────────────────────
  { key: 'GOOGLE_CLIENT_ID', label: 'Google — Client ID', category: 'oauth', secret: false },
  { key: 'GOOGLE_CLIENT_SECRET', label: 'Google — Client Secret', category: 'oauth', secret: true },
  { key: 'GOOGLE_CALLBACK_URL', label: 'Google — URL de callback', category: 'oauth', secret: false },
  {
    key: 'GOOGLE_OAUTH_ACCESS_TOKEN',
    label: 'Google — Access Token',
    category: 'oauth',
    secret: true,
  },

  // ── Signature électronique ────────────────────────────────────────────────
  { key: 'DAMANESIGN_API_URL', label: 'DamaneSign — URL API', category: 'signature', secret: false },
  { key: 'DAMANESIGN_API_KEY', label: 'DamaneSign — Clé API', category: 'signature', secret: true },

  // ── Règles métier ─────────────────────────────────────────────────────────
  {
    key: 'PLATFORM_COMMISSION_PERCENTAGE',
    label: 'Commission plateforme (%)',
    category: 'business',
    secret: false,
  },
  {
    key: 'MIN_PAYOUT_AMOUNT_MAD',
    label: 'Montant minimum de retrait (MAD)',
    category: 'business',
    secret: false,
  },
  { key: 'OTP_LENGTH', label: 'Longueur du code OTP', category: 'business', secret: false },
  {
    key: 'OTP_EXPIRY_MINUTES',
    label: 'Expiration de l’OTP (minutes)',
    category: 'business',
    secret: false,
  },

  // ── Exploitation ──────────────────────────────────────────────────────────
  { key: 'PG_DUMP_PATH', label: 'Chemin pg_dump', category: 'ops', secret: false },
  { key: 'PG_RESTORE_PATH', label: 'Chemin pg_restore', category: 'ops', secret: false },
  {
    key: 'GITHUB_WEBHOOK_SECRET',
    label: 'GitHub — Secret du webhook',
    category: 'ops',
    secret: true,
    description:
      "Secret partagé avec GitHub pour signer les webhooks de déploiement. Tant qu'il est vide, le webhook refuse toutes les requêtes.",
  },
  {
    key: 'EXTERNAL_LOG_STREAM_URL',
    label: 'Flux de logs externe — URL',
    category: 'ops',
    secret: false,
  },
  {
    key: 'EXTERNAL_LOG_STREAM_API_KEY',
    label: 'Flux de logs externe — Clé API',
    category: 'ops',
    secret: true,
  },
];

const BY_KEY = new Map(SECRET_REGISTRY.map((d) => [d.key, d]));

export function getDefinition(key: string): SecretDefinition | undefined {
  return BY_KEY.get(key);
}

/** True when the key may be written to the database by an admin. */
export function isManagedKey(key: string): boolean {
  const def = BY_KEY.get(key);
  return !!def && !def.bootstrap;
}

export const BOOTSTRAP_KEYS = SECRET_REGISTRY.filter((d) => d.bootstrap).map((d) => d.key);
