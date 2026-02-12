/**
 * Email HTML templates
 * Uses Daily Coach design system colors from tailwind.config.js
 */

// Design system colors
const colors = {
  primary: '#111418',
  primaryDark: '#000000',
  background: '#f6f7f8',
  surface: '#ffffff',
  input: '#f0f2f4',
  foreground: '#111418',
  muted: '#6b7280',
  border: '#e5e7eb',
  success: '#22c55e',
};

/**
 * Base email layout wrapper
 */
function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Daily Coach</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.background};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 460px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <span style="font-size: 24px; font-weight: 700; color: ${colors.primary}; letter-spacing: -0.5px;">Daily Coach</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color: ${colors.surface}; border-radius: 16px; padding: 40px 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 24px;">
              <p style="color: ${colors.muted}; font-size: 12px; margin: 0; line-height: 1.5;">
                You received this email because you have a Daily Coach account.
                <br>If you didn't make this request, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * OTP digit block for email display
 */
function otpBlock(otp: string): string {
  const digits = otp.split('');
  const digitCells = digits
    .map(
      (digit) =>
        `<td align="center" style="width: 44px; height: 52px; background-color: ${colors.input}; border-radius: 12px; border: 1px solid ${colors.border};">
          <span style="font-size: 24px; font-weight: 700; color: ${colors.foreground}; line-height: 52px;">${digit}</span>
        </td>`
    )
    .join(`<td style="width: 8px;"></td>`);

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
    <tr>${digitCells}</tr>
  </table>`;
}

/**
 * OTP Verification email template (registration)
 */
export function otpVerificationTemplate(data: { otp: string; firstName: string }): string {
  return baseLayout(`
    <h1 style="color: ${colors.foreground}; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
      Verify your email
    </h1>
    <p style="color: ${colors.muted}; font-size: 15px; margin: 0 0 28px 0; text-align: center; line-height: 1.5;">
      Hi ${data.firstName}, enter this code to complete your registration.
    </p>
    <div style="margin-bottom: 28px;">
      ${otpBlock(data.otp)}
    </div>
    <div style="background-color: ${colors.input}; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;">
      <p style="color: ${colors.muted}; font-size: 13px; margin: 0; text-align: center; line-height: 1.5;">
        This code expires in <strong style="color: ${colors.foreground};">10 minutes</strong>. Do not share it with anyone.
      </p>
    </div>
    <p style="color: ${colors.muted}; font-size: 13px; margin: 0; text-align: center;">
      Didn't create an account? Ignore this email.
    </p>
  `);
}

/**
 * Password Reset OTP email template
 */
export function otpPasswordResetTemplate(data: { otp: string; firstName: string }): string {
  return baseLayout(`
    <h1 style="color: ${colors.foreground}; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
      Reset your password
    </h1>
    <p style="color: ${colors.muted}; font-size: 15px; margin: 0 0 28px 0; text-align: center; line-height: 1.5;">
      Hi ${data.firstName}, use this code to reset your password.
    </p>
    <div style="margin-bottom: 28px;">
      ${otpBlock(data.otp)}
    </div>
    <div style="background-color: ${colors.input}; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;">
      <p style="color: ${colors.muted}; font-size: 13px; margin: 0; text-align: center; line-height: 1.5;">
        This code expires in <strong style="color: ${colors.foreground};">10 minutes</strong>. Do not share it with anyone.
      </p>
    </div>
    <p style="color: ${colors.muted}; font-size: 13px; margin: 0; text-align: center;">
      Didn't request a password reset? You can safely ignore this email.
    </p>
  `);
}

/**
 * Welcome email template (after email verification)
 */
export function welcomeTemplate(data: { firstName: string }): string {
  return baseLayout(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 56px; height: 56px; background-color: #ecfdf5; border-radius: 50%; display: inline-block; line-height: 56px;">
        <span style="font-size: 28px;">&#10003;</span>
      </div>
    </div>
    <h1 style="color: ${colors.foreground}; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
      Welcome to Daily Coach!
    </h1>
    <p style="color: ${colors.muted}; font-size: 15px; margin: 0 0 28px 0; text-align: center; line-height: 1.5;">
      Hi ${data.firstName}, your email has been verified and your account is all set.
    </p>
    <div style="background-color: ${colors.input}; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
      <p style="color: ${colors.foreground}; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">
        Here's what you can do next:
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 6px 0; color: ${colors.muted}; font-size: 14px; line-height: 1.5;">
            &#8226;&nbsp; Browse AI mentors in the Coach Library
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: ${colors.muted}; font-size: 14px; line-height: 1.5;">
            &#8226;&nbsp; Start a voice session with any coach
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: ${colors.muted}; font-size: 14px; line-height: 1.5;">
            &#8226;&nbsp; Get personalized evaluations and feedback
          </td>
        </tr>
      </table>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="https://play.google.com/apps/internaltest/4701400362088575307" style="display: inline-block; background-color: ${colors.primary}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 32px; border-radius: 10px;">
            Open Daily Coach
          </a>
        </td>
      </tr>
    </table>
  `);
}

/**
 * Password Changed confirmation email template
 */
export function passwordChangedTemplate(data: { firstName: string }): string {
  return baseLayout(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 56px; height: 56px; background-color: ${colors.input}; border-radius: 50%; display: inline-block; line-height: 56px;">
        <span style="font-size: 28px;">&#128274;</span>
      </div>
    </div>
    <h1 style="color: ${colors.foreground}; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
      Password changed
    </h1>
    <p style="color: ${colors.muted}; font-size: 15px; margin: 0 0 28px 0; text-align: center; line-height: 1.5;">
      Hi ${data.firstName}, your Daily Coach password was successfully changed.
    </p>
    <div style="background-color: #fef2f2; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px; border: 1px solid #fecaca;">
      <p style="color: #991b1b; font-size: 13px; margin: 0; text-align: center; line-height: 1.5;">
        If you didn't make this change, please reset your password immediately or contact support.
      </p>
    </div>
    <p style="color: ${colors.muted}; font-size: 13px; margin: 0; text-align: center;">
      You can now sign in with your new password.
    </p>
  `);
}

/**
 * Coach preview card block for sharing emails
 */
function coachCard(data: {
  coachName: string;
  coachSpecialty: string;
  coachBio: string;
  coachAvatar: string;
}): string {
  const truncatedBio =
    data.coachBio.length > 120
      ? data.coachBio.substring(0, 120) + '...'
      : data.coachBio;

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${colors.input}; border-radius: 12px; margin-bottom: 24px;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width: 64px; vertical-align: top;">
              <img src="${data.coachAvatar}" alt="${data.coachName}" width="64" height="64" style="border-radius: 50%; display: block; object-fit: cover;" />
            </td>
            <td style="padding-left: 16px; vertical-align: top;">
              <p style="color: ${colors.foreground}; font-size: 16px; font-weight: 700; margin: 0 0 2px 0;">
                ${data.coachName}
              </p>
              <p style="color: ${colors.primary}; font-size: 13px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                ${data.coachSpecialty}
              </p>
              <p style="color: ${colors.muted}; font-size: 13px; margin: 0; line-height: 1.5;">
                ${truncatedBio}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

/**
 * Permission level label for sharing emails
 */
function permissionLabel(permission: string): string {
  switch (permission) {
    case 'edit':
      return 'Can modify this coach';
    case 'use':
      return 'Can start sessions';
    case 'view':
    default:
      return 'Can view coach details';
  }
}

/**
 * Coach invitation email template (for non-registered users)
 */
export function coachInvitationTemplate(data: {
  senderName: string;
  senderEmail: string;
  coachName: string;
  coachSpecialty: string;
  coachBio: string;
  coachAvatar: string;
  acceptUrl: string;
}): string {
  return baseLayout(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 56px; height: 56px; background-color: ${colors.input}; border-radius: 50%; display: inline-block; line-height: 56px;">
        <span style="font-size: 28px;">&#127873;</span>
      </div>
    </div>
    <h1 style="color: ${colors.foreground}; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
      ${data.senderName} shared a coach with you
    </h1>
    <p style="color: ${colors.muted}; font-size: 15px; margin: 0 0 28px 0; text-align: center; line-height: 1.5;">
      You've been invited to try an AI coach on Daily Coach.
    </p>
    ${coachCard(data)}
    <div style="background-color: ${colors.input}; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; border: 1px solid ${colors.border};">
      <p style="color: ${colors.primary}; font-size: 13px; font-weight: 600; margin: 0; text-align: center;">
        &#128274;&nbsp; ${permissionLabel('use')}
      </p>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="${data.acceptUrl}" style="display: inline-block; background-color: ${colors.primary}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 36px; border-radius: 10px;">
            Join Daily Coach
          </a>
        </td>
      </tr>
    </table>
    <p style="color: ${colors.muted}; font-size: 13px; margin: 16px 0 0 0; text-align: center; line-height: 1.5;">
      Create a free account to access this AI coach.
    </p>
  `);
}

/**
 * Coach share notification email template (for existing users)
 */
export function coachShareNotificationTemplate(data: {
  recipientName: string;
  senderName: string;
  coachName: string;
  coachSpecialty: string;
  coachBio: string;
  coachAvatar: string;
  permissionLevel: string;
  coachUrl: string;
}): string {
  return baseLayout(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 56px; height: 56px; background-color: ${colors.input}; border-radius: 50%; display: inline-block; line-height: 56px;">
        <span style="font-size: 28px;">&#129309;</span>
      </div>
    </div>
    <h1 style="color: ${colors.foreground}; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
      ${data.senderName} shared a coach with you
    </h1>
    <p style="color: ${colors.muted}; font-size: 15px; margin: 0 0 28px 0; text-align: center; line-height: 1.5;">
      Hi ${data.recipientName}, you now have access to a new AI coach.
    </p>
    ${coachCard(data)}
    <div style="background-color: ${colors.input}; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; border: 1px solid ${colors.border};">
      <p style="color: ${colors.primary}; font-size: 13px; font-weight: 600; margin: 0; text-align: center;">
        &#128274;&nbsp; ${permissionLabel(data.permissionLevel)}
      </p>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="${data.coachUrl}" style="display: inline-block; background-color: ${colors.primary}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 36px; border-radius: 10px;">
            View Coach
          </a>
        </td>
      </tr>
    </table>
  `);
}
