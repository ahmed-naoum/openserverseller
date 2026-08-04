import { prisma } from '../lib/prisma.js';
import { decrypt } from './crypto.js';

const SECRETS_ALLOWLIST = new Set([
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'COLIATY_PUBLIC_KEY',
  'COLIATY_SECRET_KEY',
  'COLIATY_BASE_URL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'MAINTENANCE_BYPASS_PASSWORD',
  'EXTERNAL_LOG_STREAM_URL',
  'EXTERNAL_LOG_STREAM_API_KEY'
]);

const dbSecretsCache = new Map<string, string>();

export const initSecrets = async () => {
  try {
    const secrets = await prisma.appSecret.findMany();
    for (const s of secrets) {
      if (SECRETS_ALLOWLIST.has(s.key)) {
        try {
          const decryptedVal = s.value.startsWith('ENC:') ? decrypt(s.value) : s.value;
          dbSecretsCache.set(s.key, decryptedVal);
        } catch (e) {
          console.warn(`[SECRETS] Failed to decrypt key ${s.key}:`, e);
          dbSecretsCache.set(s.key, s.value);
        }
      }
    }
    console.log(`[SECRETS] Loaded ${dbSecretsCache.size} secrets from database.`);
  } catch (err) {
    console.error('[SECRETS] Error loading secrets from database:', err);
  }
};

export const getSecret = (key: string): string | undefined => {
  if (!SECRETS_ALLOWLIST.has(key)) {
    return process.env[key];
  }
  return dbSecretsCache.get(key) ?? process.env[key];
};

export const updateSecretInMemory = (key: string, value: string) => {
  if (SECRETS_ALLOWLIST.has(key)) {
    dbSecretsCache.set(key, value);
  }
};

export const deleteSecretFromMemory = (key: string) => {
  dbSecretsCache.delete(key);
};

export { SECRETS_ALLOWLIST };
