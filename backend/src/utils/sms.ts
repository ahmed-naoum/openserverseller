import twilio from 'twilio';
import { getSecret } from '../lib/secretStore.js';

// The client is rebuilt whenever the credentials change, so updating them in the
// admin dashboard takes effect without a restart.
let cachedClient: ReturnType<typeof twilio> | null = null;
let cachedSid: string | undefined;
let cachedToken: string | undefined;

const getClient = () => {
  const accountSid = getSecret('TWILIO_ACCOUNT_SID');
  const authToken = getSecret('TWILIO_AUTH_TOKEN');

  if (!accountSid || !authToken) return null;
  if (cachedClient && accountSid === cachedSid && authToken === cachedToken) return cachedClient;

  cachedClient = twilio(accountSid, authToken);
  cachedSid = accountSid;
  cachedToken = authToken;
  return cachedClient;
};

export const sendSMS = async (to: string, message: string): Promise<void> => {
  const client = getClient();
  if (!client) {
    console.log(`[DEV] SMS to ${to}: ${message}`);
    return;
  }

  try {
    await client.messages.create({
      body: message,
      from: getSecret('TWILIO_PHONE_NUMBER'),
      to,
    });
    console.log(`SMS sent to ${to}`);
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
};

export const sendOTPSMS = async (phone: string, otp: string, purpose: string = 'vérification'): Promise<void> => {
  const message = `SILACOD: Votre code de ${purpose} est ${otp}. Valable ${getSecret('OTP_EXPIRY_MINUTES') || 5} minutes.`;
  await sendSMS(phone, message);
};

export const sendOrderConfirmationSMS = async (phone: string, orderNumber: string): Promise<void> => {
  const message = `SILACOD: Votre commande ${orderNumber} a été confirmée. Merci pour votre confiance!`;
  await sendSMS(phone, message);
};

export const sendDeliverySMS = async (phone: string, orderNumber: string, trackingNumber?: string): Promise<void> => {
  const tracking = trackingNumber ? ` Suivi: ${trackingNumber}` : '';
  const message = `SILACOD: Votre commande ${orderNumber} est en cours de livraison.${tracking}`;
  await sendSMS(phone, message);
};
