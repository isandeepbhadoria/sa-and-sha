import nodemailer, { Transporter } from 'nodemailer';

// SMTP-based mailer for sending transactional email from Sa and Sha's own
// domain (e.g. via Hostinger email hosting, Google Workspace, Zoho Mail,
// etc.) instead of a third-party provider. Configure via .env:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE ("true"/"false"), SMTP_USER,
//   SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_FROM_NAME
let cachedTransporter: Transporter | null = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  if (!host || !port || !user || !password) return null;
  return {
    host,
    port: Number(port),
    secure: process.env.SMTP_SECURE?.trim().toLowerCase() === 'true',
    user,
    password
  };
}

export function isEmailConfigured(): boolean {
  return getSmtpConfig() !== null;
}

function getTransporter(): Transporter | null {
  const config = getSmtpConfig();
  if (!config) {
    console.warn('[MAILER] SMTP is not configured (SMTP_HOST/PORT/USER/PASSWORD). Email sending will be skipped safely.');
    return null;
  }
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password }
    });
  }
  return cachedTransporter;
}

export function getDefaultFromAddress(): string {
  const email = process.env.SMTP_FROM_EMAIL?.trim() || process.env.SMTP_USER?.trim() || 'orders@sa-and-sha.com';
  const name = process.env.SMTP_FROM_NAME?.trim() || 'Sa and Sha';
  return `${name} <${email}>`;
}

export interface SendMailOptions {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendMailResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, error: 'SMTP is not configured on the server.' };
  }

  try {
    const info = await transporter.sendMail({
      from: options.from || getDefaultFromAddress(),
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo
    });
    return { success: true, providerId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send email via SMTP' };
  }
}
