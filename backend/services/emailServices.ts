// backend/src/services/emailService.ts
import nodemailer from 'nodemailer';

// Load credentials and server info from environment variables
const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

if (!smtpHost || !smtpUser || !smtpPass) {
  console.warn('SMTP configuration missing. Email notifications will be disabled.');
}

// Create a Nodemailer transporter object for Office 365 SMTP
const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: false, // For port 587, secure must be false to use STARTTLS
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
  requireTLS: true, // Explicitly require TLS
});

interface EmailOptions {
  to: string; // Recipient's email address
  subject: string;
  text: string; // Plain text body
  html: string; // HTML body
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log("Email sending is disabled due to missing SMTP configuration.");
    console.log("Email that would have been sent:", options); // Log for debugging
    return;
  }

  try {
    const mailOptions = {
      from: `"Apex" <${smtpUser}>`, // Sender address
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Mention notification email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending mention notification email:', error);
    // Don't re-throw the error, so a failed email doesn't block the API response
  }
}

