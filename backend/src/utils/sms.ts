import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export const sendSMS = async (to: string, message: string): Promise<void> => {
  if (!client) {
    console.log(`[DEV] SMS to ${to}: ${message}`);
    return;
  }

  try {
    await client.messages.create({
      body: message,
      from: fromNumber,
      to,
    });
    console.log(`SMS sent to ${to}`);
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
};

export const sendOTPSMS = async (phone: string, otp: string, purpose: string = 'vérification'): Promise<void> => {
  const message = `OpenSeller.ma: Votre code de ${purpose} est ${otp}. Valable ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.`;
  await sendSMS(phone, message);
};

export const sendOrderConfirmationSMS = async (phone: string, orderNumber: string): Promise<void> => {
  const message = `OpenSeller.ma: Votre commande ${orderNumber} a été confirmée. Merci pour votre confiance!`;
  await sendSMS(phone, message);
};

export const sendDeliverySMS = async (phone: string, orderNumber: string, trackingNumber?: string): Promise<void> => {
  const tracking = trackingNumber ? ` Suivi: ${trackingNumber}` : '';
  const message = `OpenSeller.ma: Votre commande ${orderNumber} est en cours de livraison.${tracking}`;
  await sendSMS(phone, message);
};
