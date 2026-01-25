/**
 * Authentication Service
 * Handles all authentication business logic
 */

import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { User, IUser } from '../models/User';
import { OTPCode } from '../models/OTPCode';
import { RefreshToken } from '../models/RefreshToken';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { generateOTP, getOTPExpiry } from '../utils/otp';
import { logger } from '../config/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface SocialAuthData {
  provider: 'google' | 'apple';
  token: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const accessToken = jwt.sign(
      { userId, email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

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
    };
  }

  async register(data: RegisterData) {
    const { email, password, firstName, lastName } = data;

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

    logger.info(`OTP for ${email}: ${otp}`);

    return {
      message: 'Registration successful. Please verify your email with the OTP sent.',
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
      throw new Error('EMAIL_NOT_VERIFIED');
    }

    const tokens = await this.generateTokens(user._id.toString(), user.email);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async socialAuth(data: SocialAuthData) {
    throw new Error('Use socialAuthController for OAuth');
  }

  async forgotPassword(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return { message: 'If the email exists, an OTP has been sent.' };
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

    logger.info(`Password reset OTP for ${email}: ${otp}`);

    return {
      message: 'If the email exists, an OTP has been sent.',
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

      const tokens = await this.generateTokens(user._id.toString(), user.email);

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
      return { message: 'If the email exists, a new OTP has been sent.' };
    }

    await OTPCode.updateMany(
      { userId: user._id, verified: false },
      { verified: true }
    );

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

    logger.info(`Resent OTP for ${email}: ${otp}`);

    return {
      message: 'A new OTP has been sent.',
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

    return {
      message: 'Password reset successfully',
    };
  }

  async refreshToken(refreshToken: string) {
    const tokenRecord = await RefreshToken.findOne({
      token: refreshToken,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenRecord) {
      throw new Error('INVALID_TOKEN');
    }

    const user = await User.findById(tokenRecord.userId);
    if (!user) {
      throw new Error('INVALID_TOKEN');
    }

    const newTokens = await this.generateTokens(user._id.toString(), user.email);

    tokenRecord.revoked = true;
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

  async logout(userId: string) {
    await RefreshToken.updateMany(
      { userId, revoked: false },
      { revoked: true }
    );

    return {
      message: 'Logged out successfully',
    };
  }
}

export const authService = new AuthService();
