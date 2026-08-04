/**
 * Shared nodemailer transport backed by the runtime configuration store.
 *
 * The transport is built lazily and rebuilt whenever the SMTP settings change,
 * so credentials updated from the admin dashboard take effect on the next email
 * without a restart. Previously each caller created its own transport at module
 * load time, which captured .env values before loadSecrets() had run.
 */

import nodemailer, { Transporter } from 'nodemailer';
import { getSecret } from './secretStore.js';

let cached: Transporter | null = null;
let cachedSignature = '';

export function getTransporter(): Transporter {
  const options = {
    host: getSecret('SMTP_HOST') || 'mail.silacod.com',
    port: parseInt(getSecret('SMTP_PORT') || '587', 10),
    // false for STARTTLS (port 587), true for SSL (port 465)
    secure: getSecret('SMTP_SECURE') === 'true',
    auth: {
      user: getSecret('SMTP_USER'),
      pass: getSecret('SMTP_PASS'),
    },
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates
    },
  };

  const signature = JSON.stringify(options);
  if (!cached || signature !== cachedSignature) {
    cached = nodemailer.createTransport(options);
    cachedSignature = signature;
  }
  return cached;
}

/** Default From address, falling back to the SMTP user. */
export function getFromAddress(): string | undefined {
  return getSecret('SMTP_FROM_EMAIL') || getSecret('EMAIL_FROM') || getSecret('SMTP_USER');
}
