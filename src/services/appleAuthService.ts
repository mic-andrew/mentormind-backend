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
      // Optional: Verify the token was issued for your app
      // audience: process.env.APPLE_CLIENT_ID, // Your app's bundle ID
      nonce: undefined, // Optional: verify nonce if you use one
      ignoreExpiration: false,
    });

    // Validate required fields
    if (!appleIdTokenPayload.email) {
      throw new Error('Email not provided by Apple');
    }

    // Extract user information
    // Note: Apple only provides name on first sign-in
    // You must capture and store it then
    return {
      email: appleIdTokenPayload.email,
      emailVerified: appleIdTokenPayload.email_verified === 'true',
      appleId: appleIdTokenPayload.sub, // Apple's unique user ID
      // Note: firstName and lastName are only available on first sign-in
      // They're passed separately in the authorization response
      firstName: undefined,
      lastName: undefined,
    };
  } catch (error) {
    console.error('Apple token verification failed:', error);
    throw new Error('Invalid Apple token');
  }
}

/**
 * Find or create user from Apple account
 * This is a placeholder - implement based on your database schema
 *
 * @param appleUserInfo - Verified Apple user information
 * @param fullName - Optional full name (only provided on first sign-in)
 * @returns User object with tokens
 */
export async function findOrCreateAppleUser(
  appleUserInfo: AppleUserInfo,
  fullName?: { firstName?: string; lastName?: string }
) {
  // TODO: Implement database logic
  // 1. Check if user exists with this Apple ID
  // 2. If not, check if user exists with this email
  // 3. If neither exists, create new user with provided name
  //    IMPORTANT: Apple only provides name on FIRST sign-in
  //    You must store it in your database then
  // 4. Update user's Apple ID if needed
  // 5. Generate JWT tokens
  // 6. Return user and tokens

  throw new Error('Database implementation required');
}
