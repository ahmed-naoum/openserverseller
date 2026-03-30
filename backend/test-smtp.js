require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'mail.silacod.com',
  port: 587,
  secure: true,
  auth: {
    user: 'mailuser',
    pass: 'mailpassword123',
  },
  tls: { rejectUnauthorized: false },
});

(async () => {
  try {
    const info = await transporter.sendMail({
      from: '"Silacod" <mailuser@silacod.com>',
      to: 'naoum00007@gmail.com',
      subject: 'Test Email - Silacod SMTP',
      text: 'This is a test email from Silacod to verify SMTP is working.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #22c55e;">Silacod.ma ✅</h2>
          <p>This is a <strong>test email</strong> to confirm SMTP is working correctly.</p>
          <p>If you received this, your email configuration is correct!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
    });
    console.log('✅ Email sent successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('   Response:', info.response);
    console.log('   Accepted:', info.accepted);
    console.log('   Rejected:', info.rejected);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    console.error('   Full error:', err);
  }
})();
