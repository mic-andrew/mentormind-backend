/**
 * Email template identifiers and subjects
 */

export enum EmailTemplateId {
  OTP_VERIFICATION = 'otp_verification',
  OTP_PASSWORD_RESET = 'otp_password_reset',
  WELCOME = 'welcome',
  PASSWORD_CHANGED = 'password_changed',
}

export const EMAIL_SUBJECTS: Record<EmailTemplateId, string> = {
  [EmailTemplateId.OTP_VERIFICATION]: 'Verify your MentorMind account',
  [EmailTemplateId.OTP_PASSWORD_RESET]: 'Reset your MentorMind password',
  [EmailTemplateId.WELCOME]: 'Welcome to MentorMind!',
  [EmailTemplateId.PASSWORD_CHANGED]: 'Your password has been changed',
};
