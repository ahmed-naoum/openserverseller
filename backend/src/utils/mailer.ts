import nodemailer from 'nodemailer';
import { getSecret } from './secrets.js';

interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendEmail = async (options: MailOptions): Promise<boolean> => {
  try {
    const host = getSecret('SMTP_HOST') || 'mail.silacod.com';
    const port = parseInt(getSecret('SMTP_PORT') || '587', 10);
    const user = getSecret('SMTP_USER');
    const pass = getSecret('SMTP_PASS');
    const fromName = process.env.SITE_NAME || 'SILACOD';
    const fromAddress = getSecret('SMTP_FROM') || process.env.SMTP_FROM_EMAIL || user || 'noreply@vegas.ma';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: user && pass ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.sendMail({
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