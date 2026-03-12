import axios from 'axios';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template';
  text?: { body: string };
  template?: {
    name: string;
    language: { code: string };
    components?: any[];
  };
}

export const sendWhatsAppMessage = async (message: WhatsAppMessage): Promise<any> => {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.log('[DEV] WhatsApp message:', message);
    return { success: true, dev: true };
  }

  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: message.to.replace('+', ''),
        type: message.type,
        text: message.text,
        template: message.template,
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('WhatsApp API error:', error.response?.data || error.message);
    throw error;
  }
};

export const sendOTPWhatsApp = async (phone: string, otp: string): Promise<any> => {
  return sendWhatsAppMessage({
    to: phone,
    type: 'text',
    text: {
      body: `🔒 *SILACOD*\n\nVotre code de vérification est: *${otp}*\n\nCe code expire dans ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.`,
    },
  });
};

export const sendOrderConfirmationWhatsApp = async (
  phone: string,
  orderNumber: string,
  total: string,
  items: string
): Promise<any> => {
  return sendWhatsAppMessage({
    to: phone,
    type: 'text',
    text: {
      body: `📦 *Nouvelle Commande*\n\n` +
        `Numéro: *${orderNumber}*\n` +
        `Total: *${total} MAD*\n\n` +
        `Articles:\n${items}\n\n` +
        `Merci pour votre confiance! 🙏`,
    },
  });
};

export const sendDeliveryUpdateWhatsApp = async (
  phone: string,
  orderNumber: string,
  status: string,
  trackingNumber?: string
): Promise<any> => {
  const tracking = trackingNumber ? `\nTracking: *${trackingNumber}*` : '';
  
  return sendWhatsAppMessage({
    to: phone,
    type: 'text',
    text: {
      body: `🚚 *Mise à jour de livraison*\n\n` +
        `Commande: *${orderNumber}*\n` +
        `Statut: *${status}*${tracking}\n\n` +
        `_SILACOD_`,
    },
  });
};

export const sendPayoutNotificationWhatsApp = async (
  phone: string,
  amount: string,
  status: string
): Promise<any> => {
  const statusEmoji = status === 'COMPLETED' ? '✅' : status === 'REJECTED' ? '❌' : '⏳';
  
  return sendWhatsAppMessage({
    to: phone,
    type: 'text',
    text: {
      body: `${statusEmoji} *Mise à jour de retrait*\n\n` +
        `Montant: *${amount} MAD*\n` +
        `Statut: *${status}*\n\n` +
        `_SILACOD_`,
    },
  });
};

export const sendNewLeadWhatsApp = async (
  phone: string,
  leadName: string,
  leadPhone: string,
  city: string
): Promise<any> => {
  return sendWhatsAppMessage({
    to: phone,
    type: 'text',
    text: {
      body: `📞 *Nouveau prospect assigné*\n\n` +
        `Nom: *${leadName}*\n` +
        `Téléphone: *${leadPhone}*\n` +
        `Ville: *${city}*\n\n` +
        `Connectez-vous pour plus de détails.`,
    },
  });
};

export const verifyWhatsAppWebhook = (mode: string, token: string, challenge: string): string | null => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }
  
  return null;
};

export default {
  sendWhatsAppMessage,
  sendOTPWhatsApp,
  sendOrderConfirmationWhatsApp,
  sendDeliveryUpdateWhatsApp,
  sendPayoutNotificationWhatsApp,
  sendNewLeadWhatsApp,
  verifyWhatsAppWebhook,
};
