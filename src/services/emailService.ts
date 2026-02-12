/**
 * Email Service using Resend with local HTML templates
 */

import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { EMAIL_SUBJECTS, EmailTemplateId } from '../constants/emailTemplates';
import {
  otpVerificationTemplate,
  otpPasswordResetTemplate,
  welcomeTemplate,
  passwordChangedTemplate,
  coachInvitationTemplate,
  coachShareNotificationTemplate,
} from '../templates/emails';

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
   * Send HTML email via Resend
   */
  async sendEmail({ to, subject, html }: SendRawEmailOptions): Promise<void> {
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
    const html = otpVerificationTemplate({ otp, firstName });
    await this.sendEmail({
      to,
      subject: EMAIL_SUBJECTS[EmailTemplateId.OTP_VERIFICATION],
      html,
    });
  }

  /**
   * Send password reset OTP email
   */
  async sendPasswordResetOTP(to: string, otp: string, firstName: string): Promise<void> {
    const html = otpPasswordResetTemplate({ otp, firstName });
    await this.sendEmail({
      to,
      subject: EMAIL_SUBJECTS[EmailTemplateId.OTP_PASSWORD_RESET],
      html,
    });
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcome(to: string, firstName: string): Promise<void> {
    const html = welcomeTemplate({ firstName });
    await this.sendEmail({
      to,
      subject: EMAIL_SUBJECTS[EmailTemplateId.WELCOME],
      html,
    });
  }

  /**
   * Send password changed confirmation
   */
  async sendPasswordChanged(to: string, firstName: string): Promise<void> {
    const html = passwordChangedTemplate({ firstName });
    await this.sendEmail({
      to,
      subject: EMAIL_SUBJECTS[EmailTemplateId.PASSWORD_CHANGED],
      html,
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
    const html = coachInvitationTemplate(options);
    await this.sendEmail({
      to: options.to,
      subject: EMAIL_SUBJECTS[EmailTemplateId.COACH_INVITATION],
      html,
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
    const html = coachShareNotificationTemplate(options);
    await this.sendEmail({
      to: options.to,
      subject: EMAIL_SUBJECTS[EmailTemplateId.COACH_SHARE_NOTIFICATION],
      html,
    });
  }
}

export const emailService = new EmailService();
