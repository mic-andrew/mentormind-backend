/**
 * Email utilities
 */

import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  if (env.isDev) {
    logger.debug('📧 Email sending skipped in development mode', {
      to,
      subject,
    });
    return;
  }

  await transporter.sendMail({
    from: env.emailFrom,
    to,
    subject,
    html,
  });
}

export async function sendOTPEmail(email: string, otp: string, type: 'verification' | 'reset'): Promise<void> {
  const subject = type === 'verification'
    ? 'Verify your MentorMind account'
    : 'Reset your MentorMind password';

  // In development, log the OTP prominently for easy copying
  if (env.isDev) {
    logger.info(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 OTP CODE (${type === 'verification' ? 'EMAIL VERIFICATION' : 'PASSWORD RESET'})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email: ${email}
Code:  ${otp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copy this code to verify your account
    `);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f6f7f8;">
      <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <h1 style="color: #111418; font-size: 24px; margin: 0 0 8px 0;">
          ${type === 'verification' ? 'Verify your email' : 'Reset your password'}
        </h1>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">
          ${type === 'verification'
            ? 'Use this code to verify your MentorMind account.'
            : 'Use this code to reset your password.'}
        </p>
        <div style="background: #f0f2f4; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111418;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          This code expires in 10 minutes. If you didn't request this, please ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({ to: email, subject, html });
}
