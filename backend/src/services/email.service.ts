import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.silacod.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export const sendOtpEmail = async (to: string, otp: string, lang: string = 'fr') => {
  const subjects: Record<string, string> = {
    fr: `Votre code de vérification SILACOD: ${otp}`,
    en: `Your SILACOD verification code: ${otp}`,
    ar: `رمز التحقق الخاص بك من SILACOD: ${otp}`,
  };

  const bodies: Record<string, string> = {
    fr: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #2e315e 0%, #4338ca 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800;">SILACOD</h1>
          <p style="color: #c7d2fe; margin: 8px 0 0; font-size: 13px;">Vérification de votre adresse email</p>
        </div>
        <div style="padding: 32px 24px; text-align: center;">
          <p style="color: #475569; font-size: 14px; margin: 0 0 24px;">Voici votre code de vérification :</p>
          <div style="background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
            <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #2e315e;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">Ce code expire dans <strong>10 minutes</strong>. Ne le partagez avec personne.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} SILACOD. Tous droits réservés.</p>
        </div>
      </div>
    `,
    en: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #2e315e 0%, #4338ca 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800;">SILACOD</h1>
          <p style="color: #c7d2fe; margin: 8px 0 0; font-size: 13px;">Email Address Verification</p>
        </div>
        <div style="padding: 32px 24px; text-align: center;">
          <p style="color: #475569; font-size: 14px; margin: 0 0 24px;">Here is your verification code:</p>
          <div style="background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
            <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #2e315e;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} SILACOD. All rights reserved.</p>
        </div>
      </div>
    `,
    ar: `
      <div dir="rtl" style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #2e315e 0%, #4338ca 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800;">SILACOD</h1>
          <p style="color: #c7d2fe; margin: 8px 0 0; font-size: 13px;">التحقق من عنوان البريد الإلكتروني</p>
        </div>
        <div style="padding: 32px 24px; text-align: center;">
          <p style="color: #475569; font-size: 14px; margin: 0 0 24px;">رمز التحقق الخاص بك:</p>
          <div style="background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
            <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #2e315e;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">ينتهي هذا الرمز خلال <strong>10 دقائق</strong>. لا تشاركه مع أي شخص.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} SILACOD. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    `,
  };

  const subject = subjects[lang] || subjects.fr;
  const html = bodies[lang] || bodies.fr;

  try {
    await transporter.sendMail({
      from: `"SILACOD" <${process.env.SMTP_FROM_EMAIL || 'mail@silacod.com'}>`,
      to,
      subject,
      html,
    });
    console.log(`[EMAIL] OTP sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] Failed to send OTP to ${to}:`, error);
    return false;
  }
};

export const verifyTurnstile = async (token: string): Promise<boolean> => {
  try {
    const secret = process.env.TURNSTILE_SECRET_KEY || '';
    
    const verifyWithSecret = async (sec: string) => {
      try {
        // Hard timeout: without it a slow/unreachable Cloudflare hangs the whole
        // registration request, so the user sits on a spinning button indefinitely.
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: sec,
            response: token,
          }),
          signal: AbortSignal.timeout(8000),
        });
        const data = await response.json() as { success: boolean; 'error-codes'?: string[] };
        if (data.success !== true) {
          console.warn('[TURNSTILE] Verification rejected:', data['error-codes']);
        }
        return data.success === true;
      } catch (e) {
        console.error(`[TURNSTILE] Failed to verify with secret key starting with ${sec.slice(0, 6)}:`, e);
        return false;
      }
    };

    let isValid = await verifyWithSecret(secret);
    
    // In development mode, if verification with the primary secret fails,
    // try the official Cloudflare Turnstile dummy testing secret keys.
    if (!isValid && process.env.NODE_ENV === 'development') {
      console.log('[TURNSTILE] Validation failed with configured secret. Trying dummy secret keys for development...');
      isValid = await verifyWithSecret('1x0000000000000000000000000000000AA');
      if (!isValid) {
        isValid = await verifyWithSecret('2x0000000000000000000000000000000AA');
      }
      if (isValid) {
        console.log('[TURNSTILE] Validation succeeded using Cloudflare dummy test secret key.');
      }
    }
    
    return isValid;
  } catch (error) {
    console.error('[TURNSTILE] Verification failed:', error);
    return false;
  }
};
