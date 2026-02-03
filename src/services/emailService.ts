/**
 * Email Service using Resend Templates
 * All email templates are managed in Resend UI
 */

import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Resend Template IDs (configured in Resend UI)
export const RESEND_TEMPLATE_IDS = {
  EMAIL_VERIFICATION: 'email-verification-code',
  PASSWORD_RESET: 'password-reset',
  WELCOME: 'welcome-onboarding-email',
  PASSWORD_CHANGED: 'password-changed',
  COACH_INVITATION: 'coach-invitation',
  COACH_SHARE_NOTIFICATION: 'coach-sharing-notification',
} as const;

interface SendTemplateEmailOptions {
  to: string;
  templateId: string;
  variables: Record<string, any>;
}

interface SendRawEmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(env.resendApiKey);
  }

  /**
   * Send email using Resend template
   */
  async sendTemplateEmail({ to, templateId, variables }: SendTemplateEmailOptions): Promise<void> {
    logger.info(`Sending template email to ${to}: ${templateId}`);
    try {
      const { error } = await this.resend.emails.send({
        from: env.emailFrom!,
        to,
        template: { id: templateId, variables },
      });

      if (error) {
        logger.error('Failed to send template email:', error);
        throw new Error(`Template email send failed: ${error.message}`);
      }

      logger.info(`Template email sent to ${to}: ${templateId}`);
    } catch (err) {
      logger.error('Email service error:', err);
      throw err;
    }
  }

  /**
   * Send raw HTML email (for custom cases)
   */
  async sendRawEmail({ to, subject, html }: SendRawEmailOptions): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({
        from: env.emailFrom!,
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
   * Send OTP verification email (registration)
   */
  async sendOTPVerification(to: string, otp: string, firstName: string): Promise<void> {
    const digits = otp.split('');
    await this.sendTemplateEmail({
      to,
      templateId: RESEND_TEMPLATE_IDS.EMAIL_VERIFICATION,
      variables: {
        firstName,
        otpDigit1: digits[0],
        otpDigit2: digits[1],
        otpDigit3: digits[2],
        otpDigit4: digits[3],
        otpDigit5: digits[4],
        otpDigit6: digits[5],
      },
    });
  }

  /**
   * Send password reset OTP email
   */
  async sendPasswordResetOTP(to: string, otp: string, firstName: string): Promise<void> {
    const digits = otp.split('');
    await this.sendTemplateEmail({
      to,
      templateId: RESEND_TEMPLATE_IDS.PASSWORD_RESET,
      variables: {
        firstName,
        otpDigit1: digits[0],
        otpDigit2: digits[1],
        otpDigit3: digits[2],
        otpDigit4: digits[3],
        otpDigit5: digits[4],
        otpDigit6: digits[5],
      },
    });
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcome(
    to: string,
    firstName: string,
    appUrl: string = env.frontendUrl || ''
  ): Promise<void> {
    await this.sendTemplateEmail({
      to,
      templateId: RESEND_TEMPLATE_IDS.WELCOME,
      variables: {
        firstName,
        appUrl,
      },
    });
  }

  /**
   * Send password changed confirmation
   */
  async sendPasswordChanged(to: string, firstName: string): Promise<void> {
    await this.sendTemplateEmail({
      to,
      templateId: RESEND_TEMPLATE_IDS.PASSWORD_CHANGED,
      variables: {
        firstName,
      },
    });
  }

  /**
   * Send coach share invitation to new user (not registered)
   */
  async sendCoachInvitation(options: {
    to: string;
    senderName: string;
    senderEmail: string;
    coachName: string;
    coachSpecialty: string;
    coachBio: string;
    coachAvatar: string;
    acceptUrl: string;
  }): Promise<void> {
    await this.sendTemplateEmail({
      to: options.to,
      templateId: RESEND_TEMPLATE_IDS.COACH_INVITATION,
      variables: options,
    });
  }

  /**
   * Send coach share notification to existing user
   */
  async sendCoachShareNotification(options: {
    to: string;
    recipientName: string;
    senderName: string;
    coachName: string;
    coachSpecialty: string;
    coachBio: string;
    coachAvatar: string;
    permissionLevel: string;
    coachUrl: string;
  }): Promise<void> {
    await this.sendTemplateEmail({
      to: options.to,
      templateId: RESEND_TEMPLATE_IDS.COACH_SHARE_NOTIFICATION,
      variables: options,
    });
  }
}

export const emailService = new EmailService();
