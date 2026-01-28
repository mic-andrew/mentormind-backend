/**
 * Email Service
 * Reusable Resend-based email service for sending templated emails
 */

import { Resend } from 'resend';
import { env } from '../config/env';
import { EmailTemplateId, EMAIL_SUBJECTS } from '../constants/emailTemplates';
import {
  otpVerificationTemplate,
  otpPasswordResetTemplate,
  welcomeTemplate,
  passwordChangedTemplate,
} from '../templates/emails';
import { logger } from '../config/logger';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface OTPEmailData {
  otp: string;
  firstName: string;
}

interface UserEmailData {
  firstName: string;
}

type EmailTemplateData = OTPEmailData | UserEmailData;

class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(env.resendApiKey);
  }

  /**
   * Send a raw email (for custom use cases)
   */
  async send({ to, subject, html }: SendEmailOptions): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({
        from: env.emailFrom,
        to,
        subject,
        html,
      });

      if (error) {
        logger.error('Failed to send email:', error);
        throw new Error(`Email send failed: ${error.message}`);
      }

      logger.info(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      logger.error('Email service error:', err);
      throw err;
    }
  }

  /**
   * Send a templated email by template ID
   */
  async sendTemplate(
    templateId: EmailTemplateId,
    to: string,
    data: EmailTemplateData
  ): Promise<void> {
    const subject = EMAIL_SUBJECTS[templateId];
    const html = this.getTemplateHtml(templateId, data);
    await this.send({ to, subject, html });
  }

  /**
   * Send OTP verification email (registration)
   */
  async sendOTPVerification(to: string, data: OTPEmailData): Promise<void> {
    await this.sendTemplate(EmailTemplateId.OTP_VERIFICATION, to, data);
  }

  /**
   * Send password reset OTP email
   */
  async sendOTPPasswordReset(to: string, data: OTPEmailData): Promise<void> {
    await this.sendTemplate(EmailTemplateId.OTP_PASSWORD_RESET, to, data);
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcome(to: string, data: UserEmailData): Promise<void> {
    await this.sendTemplate(EmailTemplateId.WELCOME, to, data);
  }

  /**
   * Send password changed confirmation email
   */
  async sendPasswordChanged(to: string, data: UserEmailData): Promise<void> {
    await this.sendTemplate(EmailTemplateId.PASSWORD_CHANGED, to, data);
  }

  private getTemplateHtml(
    templateId: EmailTemplateId,
    data: EmailTemplateData
  ): string {
    switch (templateId) {
      case EmailTemplateId.OTP_VERIFICATION:
        return otpVerificationTemplate(data as OTPEmailData);
      case EmailTemplateId.OTP_PASSWORD_RESET:
        return otpPasswordResetTemplate(data as OTPEmailData);
      case EmailTemplateId.WELCOME:
        return welcomeTemplate(data as UserEmailData);
      case EmailTemplateId.PASSWORD_CHANGED:
        return passwordChangedTemplate(data as UserEmailData);
      default:
        throw new Error(`Unknown email template: ${templateId}`);
    }
  }
}

export const emailService = new EmailService();
