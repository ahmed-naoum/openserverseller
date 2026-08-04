import { getTransporter } from '../lib/mailTransport.js';
import { getSecret } from '../lib/secretStore.js';

interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendEmail = async (options: MailOptions): Promise<boolean> => {
  try {
    const fromName = getSecret('SITE_NAME') || 'SILACOD';
    const fromAddress = getSecret('SMTP_FROM_EMAIL') || getSecret('SMTP_USER') || 'noreply@vegas.ma';

    await getTransporter().sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log(`[MAILER] Successfully sent email to ${options.to}`);
    return true;
  } catch (error) {
    console.error(`[MAILER] Failed to send email to ${options.to}:`, error);
    return false;
  }
};