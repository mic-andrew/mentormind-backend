/**
 * Email template identifiers and subjects
 */

export enum EmailTemplateId {
  OTP_VERIFICATION = 'otp_verification',
  OTP_PASSWORD_RESET = 'otp_password_reset',
  WELCOME = 'welcome',
  PASSWORD_CHANGED = 'password_changed',
  COACH_INVITATION = 'coach_invitation',
  COACH_SHARE_NOTIFICATION = 'coach_share_notification',
}

export const EMAIL_SUBJECTS: Record<EmailTemplateId, string> = {
  [EmailTemplateId.OTP_VERIFICATION]: 'Verify your Daily Coach account',
  [EmailTemplateId.OTP_PASSWORD_RESET]: 'Reset your Daily Coach password',
  [EmailTemplateId.WELCOME]: 'Welcome to Daily Coach!',
  [EmailTemplateId.PASSWORD_CHANGED]: 'Your password has been changed',
  [EmailTemplateId.COACH_INVITATION]: "You've been invited to Daily Coach",
  [EmailTemplateId.COACH_SHARE_NOTIFICATION]: 'A coach has been shared with you',
};
