/**
 * Google OAuth Service (Server-driven flow)
 * Handles OAuth authorization code flow with Google
 */

import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';
import { env } from '../config/env';
import { User, type IUser } from '../models/User';
import { TemporarySession } from '../models/TemporarySession';
import { logger } from '../config/logger';

const oauth2Client = new OAuth2Client(
  env.googleClientId,
  env.googleClientSecret,
  env.googleCallbackUrl
);

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Generate Google OAuth authorization URL
 */
export function generateGoogleAuthUrl(redirectUri: string, platform?: string): string {
  const state = crypto.randomBytes(32).toString('hex');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    state: JSON.stringify({ state, redirectUri, platform }),
    prompt: 'select_account',
  });

  return authUrl;
}

/**
 * Handle Google OAuth callback
 * Exchange code for tokens, get user info, create/find user, create temp session
 */
export async function handleGoogleCallback(
  code: string,
  state: string
): Promise<{ sessionId: string; redirectUri: string }> {
  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const userInfo = await getGoogleUserInfo(tokens.access_token!);

    // Find or create user
    const user = await findOrCreateGoogleUser(userInfo);

    // Parse state to get redirect URI
    const stateData = JSON.parse(state);
    const redirectUri = stateData.redirectUri;

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

    return { sessionId, redirectUri };
  } catch (error) {
    logger.error('Google callback handling failed:', error);
    throw new Error('GOOGLE_AUTH_FAILED');
  }
}

/**
 * Get user info from Google using access token
 */
async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google user info');
  }

  const payload = (await response.json()) as Record<string, any>;

  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
    given_name: payload.given_name,
    family_name: payload.family_name,
    picture: payload.picture,
  };
}

/**
 * Find existing user or create new one from Google profile
 */
async function findOrCreateGoogleUser(userInfo: GoogleUserInfo): Promise<IUser> {
  // First, try to find user by Google ID
  let user = await User.findOne({ googleId: userInfo.sub });

  if (user) {
    // Update picture if changed
    if (userInfo.picture && user.picture !== userInfo.picture) {
      user.picture = userInfo.picture;
      await user.save();
    }
    return user;
  }

  // If not found by googleId, try to find by email (account linking)
  user = await User.findOne({ email: userInfo.email.toLowerCase() });

  if (user) {
    // Link Google account to existing user
    user.googleId = userInfo.sub;
    if (userInfo.picture && !user.picture) {
      user.picture = userInfo.picture;
    }
    if (!user.emailVerified && userInfo.email_verified) {
      user.emailVerified = true;
    }
    await user.save();
    return user;
  }

  // Create new user
  user = await User.create({
    email: userInfo.email.toLowerCase(),
    googleId: userInfo.sub,
    firstName: userInfo.given_name || userInfo.name?.split(' ')[0],
    lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' '),
    picture: userInfo.picture,
    emailVerified: userInfo.email_verified,
  });

  return user;
}

/**
 * Exchange session ID for user
 * Used by /auth/exchange-session endpoint
 */
export async function exchangeSessionId(sessionId: string): Promise<IUser> {
  const session = await TemporarySession.findOne({
    sessionId,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    throw new Error('Invalid or expired session');
  }

  // Mark session as used
  session.used = true;
  await session.save();

  // Get user
  const user = await User.findById(session.userId);

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}
