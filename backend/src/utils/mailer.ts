import nodemailer from 'nodemailer';

// Configure the transporter using SMTP credentials from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.silacod.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // false for STARTTLS (port 587), true for SSL (port 465)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates
  },
});

interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendEmail = async (options: MailOptions): Promise<boolean> => {
  try {
    const fromName = process.env.SITE_NAME || 'SILACOD';
    const fromAddress = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@vegas.ma';
    
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