/**
 * Apple Sign In Service
 * Handles Apple ID token verification and user authentication
 *
 * Requirements:
 * - npm install apple-signin-auth
 * - No Apple client ID needed - verification uses Apple's public keys
 *
 * Apple Sign In Flow:
 * 1. User signs in on mobile app with Apple
 * 2. App receives identity token (JWT)
 * 3. Backend verifies token with Apple's public keys
 * 4. Extract user info and create/login user
 */

import appleSignin from 'apple-signin-auth';
import { User, IUser } from '../models/User';
import { logger } from '../config/logger';

interface AppleUserInfo {
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  appleId: string;
}

/**
 * Verify Apple identity token
 * Apple uses JWTs signed with their private keys
 * We verify using Apple's public keys (automatically fetched)
 *
 * @param identityToken - The identity token from Apple Sign In
 * @returns Verified user information
 */
export async function verifyAppleToken(identityToken: string): Promise<AppleUserInfo> {
  try {
    // Verify the token with Apple's public keys
    const appleIdTokenPayload = await appleSignin.verifyIdToken(identityToken, {
      nonce: undefined,
      ignoreExpiration: false,
    });

    if (!appleIdTokenPayload.email) {
      throw new Error('Email not provided by Apple');
    }

    return {
      email: appleIdTokenPayload.email,
      emailVerified: appleIdTokenPayload.email_verified === 'true',
      appleId: appleIdTokenPayload.sub,
      // Note: firstName and lastName are only available on first sign-in
      // They're passed separately in the authorization response
      firstName: undefined,
      lastName: undefined,
    };
  } catch (error) {
    logger.error('Apple token verification failed:', error);
    throw new Error('INVALID_APPLE_TOKEN');
  }
}

/**
 * Find or create user from Apple account
 *
 * @param appleUserInfo - Verified Apple user information
 * @param fullName - Optional full name (only provided on first sign-in)
 * @returns User document
 */
export async function findOrCreateAppleUser(
  appleUserInfo: AppleUserInfo,
  fullName?: { firstName?: string; lastName?: string }
): Promise<IUser> {
  // 1. Check if user exists with this Apple ID
  let user = await User.findOne({ appleId: appleUserInfo.appleId });
  if (user) {
    return user;
  }

  // 2. Check if user exists with this email
  user = await User.findOne({ email: appleUserInfo.email.toLowerCase() });
  if (user) {
    // Link Apple ID to existing account
    user.appleId = appleUserInfo.appleId;
    if (!user.emailVerified && appleUserInfo.emailVerified) {
      user.emailVerified = true;
    }
    await user.save();
    return user;
  }

  // 3. Create new user
  // IMPORTANT: Apple only provides name on FIRST sign-in, so capture it now
  user = await User.create({
    email: appleUserInfo.email.toLowerCase(),
    firstName: fullName?.firstName || appleUserInfo.firstName || '',
    lastName: fullName?.lastName || appleUserInfo.lastName || '',
    appleId: appleUserInfo.appleId,
    emailVerified: appleUserInfo.emailVerified,
  });

  return user;
}
