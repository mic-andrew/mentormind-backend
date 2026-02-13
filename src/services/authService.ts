/**
 * Authentication Service
 * Handles all authentication business logic
 */

import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { User, IUser } from '../models/User';
import { OTPCode } from '../models/OTPCode';
import { RefreshToken } from '../models/RefreshToken';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { TemporarySession } from '../models/TemporarySession';
import { generateOTP, getOTPExpiry, OTP_RESEND_COOLDOWN_SECONDS } from '../utils/otp';
import { emailService } from './emailService';
import { logger } from '../config/logger';
import { env } from '../config/env';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || '1h';
const _JWT_REFRESH_EXPIRES_IN: string | number = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  anonymousUserId?: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const accessToken = jwt.sign({ userId, email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    const refreshTokenString = crypto.randomBytes(64).toString('hex');
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    await RefreshToken.create({
      userId,
      token: refreshTokenString,
      expiresAt: refreshTokenExpiry,
      revoked: false,
    });

    return {
      accessToken,
      refreshToken: refreshTokenString,
    };
  }

  private sanitizeUser(user: IUser) {
    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      picture: user.picture,
      emailVerified: user.emailVerified,
      password: user.password ? 'set' : undefined,
      googleId: user.googleId,
      appleId: user.appleId,
      isAnonymous: user.isAnonymous || false,
      deviceId: user.deviceId,
      language: user.language || 'English',
    };
  }

  async createAnonymousUser(deviceId: string) {
    let user = await User.findOne({ deviceId, isAnonymous: true, isDeleted: false });

    if (user) {
      const tokens = await this.generateTokens(user._id.toString(), deviceId);
      return { user: this.sanitizeUser(user), tokens, isExisting: true };
    }

    try {
      user = await User.create({
        deviceId,
        isAnonymous: true,
        emailVerified: false,
        isOnboarded: false,
      });
    } catch (error: any) {
      // Race condition: concurrent request already created this deviceId.
      // Recover by fetching the existing user instead of failing.
      if (error?.code === 11000) {
        user = await User.findOne({ deviceId, isAnonymous: true, isDeleted: false });
        if (user) {
          const tokens = await this.generateTokens(user._id.toString(), deviceId);
          return { user: this.sanitizeUser(user), tokens, isExisting: true };
        }
      }
      throw error;
    }

    const tokens = await this.generateTokens(user._id.toString(), deviceId);
    return { user: this.sanitizeUser(user), tokens, isExisting: false };
  }

  async upgradeAnonymousUser(anonymousUserId: string, data: Omit<RegisterData, 'anonymousUserId'>) {
    const { email, password, firstName, lastName } = data;

    const user = await User.findById(anonymousUserId);
    if (!user) {
      throw new Error('INVALID_ANONYMOUS_USER');
    }

    // Handle retry: user was already partially upgraded (isAnonymous set to false
    // in a prior attempt) but didn't complete OTP verification
    if (!user.isAnonymous) {
      if (user.email === email.toLowerCase() && !user.emailVerified) {
        // Same email, unverified — update password/name and resend OTP
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.firstName = firstName;
        user.lastName = lastName;
        await user.save();

        const otp = generateOTP();
        const otpExpiry = getOTPExpiry();

        await OTPCode.create({
          userId: user._id,
          code: otp,
          expiresAt: otpExpiry,
          type: 'registration',
          verified: false,
        });

        emailService
          .sendOTPVerification(email.toLowerCase(), otp, firstName)
          .catch((err) => logger.error('Failed to send verification email:', err));

        return {
          message: 'Verification code resent. Please check your email.',
          retryAfter: OTP_RESEND_COOLDOWN_SECONDS,
        };
      }
      throw new Error('INVALID_ANONYMOUS_USER');
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: user._id },
    });
    if (existingUser) {
      throw new Error('USER_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.email = email.toLowerCase();
    user.password = hashedPassword;
    user.firstName = firstName;
    user.lastName = lastName;
    user.isAnonymous = false;
    await user.save();

    const otp = generateOTP();
    const otpExpiry = getOTPExpiry();

    await OTPCode.create({
      userId: user._id,
      code: otp,
      expiresAt: otpExpiry,
      type: 'registration',
      verified: false,
    });

    emailService
      .sendOTPVerification(email.toLowerCase(), otp, firstName)
      .catch((err) => logger.error('Failed to send verification email:', err));

    return {
      message: 'Account upgraded. Please verify your email with the OTP sent.',
      retryAfter: OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  async register(data: RegisterData) {
    const { email, password, firstName, lastName, anonymousUserId } = data;

    if (anonymousUserId) {
      return this.upgradeAnonymousUser(anonymousUserId, { email, password, firstName, lastName });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error('USER_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      emailVerified: false,
    });

    const otp = generateOTP();
    const otpExpiry = getOTPExpiry();

    await OTPCode.create({
      userId: user._id,
      code: otp,
      expiresAt: otpExpiry,
      type: 'registration',
      verified: false,
    });

    emailService
      .sendOTPVerification(email.toLowerCase(), otp, firstName)
      .catch((err) => logger.error('Failed to send verification email:', err));

    return {
      message: 'Registration successful. Please verify your email with the OTP sent.',
      retryAfter: OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  async login(data: LoginData) {
    const { email, password } = data;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    if (!user.emailVerified) {
      // Send a fresh OTP so the user can verify from the OTP screen
      const otp = generateOTP();
      const otpExpiry = getOTPExpiry();

      await OTPCode.create({
        userId: user._id,
        code: otp,
        expiresAt: otpExpiry,
        type: 'registration',
        verified: false,
      });

      emailService
        .sendOTPVerification(user.email!, otp, user.firstName || 'there')
        .catch((err) => logger.error('Failed to send verification email:', err));

      throw new Error('EMAIL_NOT_VERIFIED');
    }

    const tokens = await this.generateTokens(user._id.toString(), user.email!);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async createSession(user: IUser) {
    const tokens = await this.generateTokens(user._id.toString(), user.email!);
    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async forgotPassword(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return {
        message: 'If the email exists, an OTP has been sent.',
        retryAfter: OTP_RESEND_COOLDOWN_SECONDS,
      };
    }

    const otp = generateOTP();
    const otpExpiry = getOTPExpiry();

    await OTPCode.create({
      userId: user._id,
      code: otp,
      expiresAt: otpExpiry,
      type: 'password-reset',
      verified: false,
    });

    emailService
      .sendPasswordResetOTP(user.email!, otp, user.firstName || 'there')
      .catch((err) => logger.error('Failed to send password reset email:', err));

    return {
      message: 'If the email exists, an OTP has been sent.',
      retryAfter: OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  async verifyOTP(email: string, otp: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error('INVALID_OTP');
    }

    const otpRecord = await OTPCode.findOne({
      userId: user._id,
      code: otp,
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      throw new Error('INVALID_OTP');
    }

    otpRecord.verified = true;
    await otpRecord.save();

    if (otpRecord.type === 'registration') {
      user.emailVerified = true;
      await user.save();

      const tokens = await this.generateTokens(user._id.toString(), user.email!);

      emailService
        .sendWelcome(user.email!, user.firstName || 'there')
        .catch((err) => logger.error('Failed to send welcome email:', err));

      return {
        message: 'Email verified successfully',
        user: this.sanitizeUser(user),
        tokens,
      };
    } else {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date();
      resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

      await PasswordResetToken.create({
        userId: user._id,
        token: resetToken,
        expiresAt: resetTokenExpiry,
        used: false,
      });

      return {
        message: 'OTP verified',
        resetToken,
      };
    }
  }

  async resendOTP(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return {
        message: 'If the email exists, a new OTP has been sent.',
        retryAfter: OTP_RESEND_COOLDOWN_SECONDS,
      };
    }

    // Enforce cooldown between resends
    const lastOtp = await OTPCode.findOne({ userId: user._id }).sort({ createdAt: -1 });
    if (lastOtp) {
      const elapsed = (Date.now() - lastOtp.createdAt.getTime()) / 1000;
      if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
        const retryAfter = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed);
        throw new Error(`OTP_COOLDOWN:${retryAfter}`);
      }
    }

    await OTPCode.updateMany({ userId: user._id, verified: false }, { verified: true });

    const otp = generateOTP();
    const otpExpiry = getOTPExpiry();

    const type = user.emailVerified ? 'password-reset' : 'registration';

    await OTPCode.create({
      userId: user._id,
      code: otp,
      expiresAt: otpExpiry,
      type,
      verified: false,
    });

    const emailPromise =
      type === 'password-reset'
        ? emailService.sendPasswordResetOTP(user.email!, otp, user.firstName || 'there')
        : emailService.sendOTPVerification(user.email!, otp, user.firstName || 'there');
    emailPromise.catch((err) => logger.error('Failed to send OTP email:', err));

    return {
      message: 'A new OTP has been sent.',
      retryAfter: OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  async resetPassword(resetToken: string, newPassword: string) {
    const tokenRecord = await PasswordResetToken.findOne({
      token: resetToken,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenRecord) {
      throw new Error('INVALID_RESET_TOKEN');
    }

    const user = await User.findById(tokenRecord.userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    tokenRecord.used = true;
    await tokenRecord.save();

    emailService
      .sendPasswordChanged(user.email!, user.firstName || 'there')
      .catch((err) => logger.error('Failed to send password changed email:', err));

    return {
      message: 'Password reset successfully',
    };
  }

  async refreshToken(refreshToken: string) {
    // First try to find a valid (non-revoked) token
    let tokenRecord = await RefreshToken.findOne({
      token: refreshToken,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenRecord) {
      // Grace period: if the token was revoked within the last 30 seconds
      // (e.g. concurrent request race condition), return the replacement token
      const GRACE_PERIOD_MS = 30_000;
      const revokedRecord = await RefreshToken.findOne({
        token: refreshToken,
        revoked: true,
        revokedAt: { $gt: new Date(Date.now() - GRACE_PERIOD_MS) },
        replacedByToken: { $exists: true, $ne: null },
      });

      if (revokedRecord) {
        // Find the replacement token's corresponding access token
        const replacementRecord = await RefreshToken.findOne({
          token: revokedRecord.replacedByToken,
          revoked: false,
        });

        if (replacementRecord) {
          const user = await User.findById(replacementRecord.userId);
          if (!user) throw new Error('INVALID_TOKEN');

          // Generate a fresh access token but reuse the existing refresh token
          const accessToken = jwt.sign(
            { userId: user._id.toString(), email: user.email || user.deviceId || '' },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
          );

          return {
            accessToken,
            refreshToken: replacementRecord.token,
          };
        }
      }

      throw new Error('INVALID_TOKEN');
    }

    const user = await User.findById(tokenRecord.userId);
    if (!user) {
      throw new Error('INVALID_TOKEN');
    }

    const newTokens = await this.generateTokens(user._id.toString(), user.email || user.deviceId || '');

    tokenRecord.revoked = true;
    tokenRecord.revokedAt = new Date();
    tokenRecord.replacedByToken = newTokens.refreshToken;
    await tokenRecord.save();

    return newTokens;
  }

  async getCurrentUser(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('NOT_FOUND');
    }

    return this.sanitizeUser(user);
  }

  async updateUser(userId: string, updates: { firstName?: string; lastName?: string }) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('NOT_FOUND');
    }

    if (updates.firstName !== undefined) {
      user.firstName = updates.firstName;
    }

    if (updates.lastName !== undefined) {
      user.lastName = updates.lastName;
    }

    await user.save();

    return this.sanitizeUser(user);
  }

  async updatePassword(userId: string, currentPassword: string | undefined, newPassword: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('NOT_FOUND');
    }

    // If user has a password, verify current password
    if (user.password) {
      if (!currentPassword) {
        throw new Error('CURRENT_PASSWORD_REQUIRED');
      }
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        throw new Error('INVALID_PASSWORD');
      }
    }

    // Set/update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    const message = user.password
      ? 'Password updated successfully'
      : 'Password created successfully';

    if (user.email) {
      emailService
        .sendPasswordChanged(user.email, user.firstName || 'there')
        .catch((err) => logger.error('Failed to send password changed email:', err));
    }

    return {
      message,
    };
  }

  async scheduleAccountDeletion(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('NOT_FOUND');
    }

    if (user.isDeleted) {
      throw new Error('ALREADY_DELETED');
    }

    // Schedule deletion for 30 days from now
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    user.deletionScheduledAt = deletionDate;
    await user.save();

    // TODO: Send email notification about scheduled deletion
    // TODO: Implement sendAccountDeletionScheduled in emailService
    // emailService
    //   .sendAccountDeletionScheduled(user.email, user.firstName || 'there', deletionDate)
    //   .catch((err: unknown) => logger.error('Failed to send deletion scheduled email:', err));

    return {
      message: 'Account deletion scheduled',
      deletionDate,
    };
  }

  async cancelAccountDeletion(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('NOT_FOUND');
    }

    if (!user.deletionScheduledAt) {
      throw new Error('NO_DELETION_SCHEDULED');
    }

    user.deletionScheduledAt = undefined;
    await user.save();

    return {
      message: 'Account deletion cancelled',
    };
  }

  async logout(userId: string) {
    await RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });

    return {
      message: 'Logged out successfully',
    };
  }

  // Google OAuth (Server-driven flow)
  generateGoogleAuthUrl(redirectUri: string, platform?: string): string {
    const oauth2Client = new OAuth2Client(
      env.googleClientId,
      env.googleClientSecret,
      env.googleCallbackUrl
    );

    const state = crypto.randomBytes(32).toString('hex');

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['profile', 'email'],
      state: JSON.stringify({ state, redirectUri, platform }),
      prompt: 'select_account',
    });

    return authUrl;
  }

  async handleGoogleCallback(
    code: string,
    state: string
  ): Promise<{ sessionId: string; redirectUri: string }> {
    try {
      const oauth2Client = new OAuth2Client(
        env.googleClientId,
        env.googleClientSecret,
        env.googleCallbackUrl
      );

      // Exchange authorization code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Get user info from Google
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Google user info');
      }

      const payload = (await response.json()) as Record<string, any>;

      // Find or create user
      let user = await User.findOne({ googleId: payload.sub });

      if (!user) {
        user = await User.findOne({ email: payload.email.toLowerCase() });

        if (user) {
          // Link Google account to existing user
          user.googleId = payload.sub;
          if (payload.picture && !user.picture) {
            user.picture = payload.picture;
          }
          if (!user.emailVerified && payload.email_verified) {
            user.emailVerified = true;
          }
          await user.save();
        } else {
          // Create new user
          user = await User.create({
            email: payload.email.toLowerCase(),
            googleId: payload.sub,
            firstName: payload.given_name || payload.name?.split(' ')[0],
            lastName: payload.family_name || payload.name?.split(' ').slice(1).join(' '),
            picture: payload.picture,
            emailVerified: payload.email_verified,
          });
        }
      } else {
        // Update picture if changed
        if (payload.picture && user.picture !== payload.picture) {
          user.picture = payload.picture;
          await user.save();
        }
      }

      // Parse state to get redirect URI
      const stateData = JSON.parse(state);
      const redirectUriFromState = stateData.redirectUri;

      // Create temporary session
      const sessionId = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await TemporarySession.create({
        sessionId,
        userId: user._id,
        provider: 'google',
        expiresAt,
        used: false,
      });

      return { sessionId, redirectUri: redirectUriFromState };
    } catch (error) {
      logger.error('Google callback handling failed:', error);
      throw new Error('GOOGLE_AUTH_FAILED');
    }
  }

  async exchangeSessionId(sessionId: string): Promise<{ user: any; tokens: AuthTokens }> {
    const session = await TemporarySession.findOne({
      sessionId,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      throw new Error('INVALID_SESSION');
    }

    // Mark session as used
    session.used = true;
    await session.save();

    // Get user
    const user = await User.findById(session.userId);

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user._id.toString(), user.email!);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  // Apple OAuth (Client-driven flow)
  async handleAppleAuth(
    token: string,
    fullName?: { firstName?: string; lastName?: string },
    anonymousUserId?: string
  ): Promise<{ user: any; tokens: AuthTokens }> {
    try {
      // Verify Apple token
      const appleData = await appleSignin.verifyIdToken(token, {
        audience: env.googleClientId, // Replace with Apple client ID when configured
        ignoreExpiration: false,
      });

      const appleId = appleData.sub;
      const email = appleData.email;

      // Find or create user
      let user = await User.findOne({ appleId });

      if (!user) {
        // Check if we should upgrade an anonymous user
        if (anonymousUserId) {
          const anonUser = await User.findById(anonymousUserId);
          if (anonUser && anonUser.isAnonymous) {
            anonUser.email = email?.toLowerCase();
            anonUser.appleId = appleId;
            anonUser.firstName = fullName?.firstName || '';
            anonUser.lastName = fullName?.lastName || '';
            anonUser.emailVerified = true;
            anonUser.isAnonymous = false;
            await anonUser.save();
            user = anonUser;
          }
        }

        if (!user) {
          user = await User.findOne({ email: email?.toLowerCase() });

          if (user) {
            // Link Apple account to existing user
            user.appleId = appleId;
            await user.save();
          } else {
            // Create new user (Apple only provides name on first sign in)
            user = await User.create({
              email: email?.toLowerCase(),
              appleId,
              firstName: fullName?.firstName || '',
              lastName: fullName?.lastName || '',
              emailVerified: true, // Apple verifies emails
            });
          }
        }
      }

      // Generate tokens
      const tokens = await this.generateTokens(user._id.toString(), user.email || user.deviceId || '');

      return {
        user: this.sanitizeUser(user),
        tokens,
      };
    } catch (error) {
      logger.error('Apple auth failed:', error);
      throw new Error('APPLE_AUTH_FAILED');
    }
  }
}

export const authService = new AuthService();
