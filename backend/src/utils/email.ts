import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // false for STARTTLS (port 587), true for SSL (port 465)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@silacod.com',
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${options.to}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

export const sendOTPEmail = async (email: string, otp: string, purpose: string = 'vérification'): Promise<void> => {
  await sendEmail({
    to: email,
    subject: `Code de ${purpose} - SILACOD`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">SILACOD</h2>
        <p>Votre code de ${purpose} est:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px;">
          ${otp}
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          Ce code expire dans ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.
        </p>
      </div>
    `,
  });
};

export const sendWelcomeEmail = async (email: string, name: string): Promise<void> => {
  await sendEmail({
    to: email,
    subject: 'Bienvenue sur SILACOD! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">Bienvenue, ${name}! 🎉</h2>
        <p>Merci de rejoindre SILACOD, la plateforme de dropshipping white-label #1 au Maroc.</p>
        <p>Vous pouvez maintenant:</p>
        <ul>
          <li>Créer votre marque personnalisée</li>
          <li>Accéder à notre catalogue de +200 produits</li>
          <li>Importer vos prospects</li>
          <li>Générer des ventes avec notre équipe de call-center</li>
        </ul>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
          Accéder à mon espace
        </a>
      </div>
    `,
  });
};

export const sendPayoutEmail = async (email: string, amount: string, status: string): Promise<void> => {
  const statusMessages: Record<string, string> = {
    PENDING: 'en attente de traitement',
    APPROVED: 'approuvée',
    COMPLETED: 'traitée avec succès',
    REJECTED: 'rejetée',
  };

  await sendEmail({
    to: email,
    subject: `Mise à jour de votre demande de retrait - SILACOD`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">SILACOD</h2>
        <p>Votre demande de retrait de <strong>${amount} MAD</strong> a été ${statusMessages[status] || 'mise à jour'}.</p>
        <p>Connectez-vous à votre espace pour plus de détails.</p>
      </div>
    `,
  });
};
