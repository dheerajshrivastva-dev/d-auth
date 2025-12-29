/**
 * Database Adapter Interface for d-auth
 *
 * Implement this interface to support any database (MongoDB, PostgreSQL, MySQL, etc.)
 */

export interface IUserDocument {
  id: string;
  email: string;
  password?: string; // Optional for OAuth-only users

  // OAuth identifiers
  googleId?: string;
  facebookId?: string;
  appleId?: string;

  // Auth metadata
  roles: string[];
  isVerified: boolean;

  // Password management
  isTemporaryPassword?: boolean; // True if admin created user with temp password
  mustResetPassword?: boolean; // True if user must reset password before login
  failedLoginAttempts?: number; // Count of failed login attempts
  lastFailedLoginAt?: Date; // Timestamp of last failed login
  accountLockedUntil?: Date; // Lock account until this time

  // 2FA fields
  twoFactorEnabled: boolean;
  twoFactorSecret?: string; // TOTP secret for authenticator apps
  twoFactorBackupCodes?: string[]; // Hashed backup codes

  // Profile fields (optional, user can extend)
  firstName?: string;
  lastName?: string;
  profileUrl?: string;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;

  // Allow additional custom fields
  [key: string]: any;
}

export interface ISessionData {
  sessionId: string;
  refreshToken: string;
  ip: string;
  deviceName: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface IOTPData {
  id?: string;
  userId: string;
  otp: string;
  sessionId: string;
  otpType: "ForgetPassword" | "VerifyEmail" | "Verify2FA" | "VerifyPhone";
  otpCount: number;
  otpSentAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface IDatabaseAdapter {
  // ==================== User Operations ====================

  /**
   * Find a user by email
   */
  findUserByEmail(email: string): Promise<IUserDocument | null>;

  /**
   * Find a user by ID
   */
  findUserById(id: string): Promise<IUserDocument | null>;

  /**
   * Find a user by OAuth ID (Google, Facebook, etc.)
   */
  findUserByOAuthId(
    provider: "google" | "facebook" | "apple",
    oauthId: string
  ): Promise<IUserDocument | null>;

  /**
   * Create a new user
   */
  createUser(userData: Partial<IUserDocument>): Promise<IUserDocument>;

  /**
   * Update user data
   */
  updateUser(id: string, data: Partial<IUserDocument>): Promise<IUserDocument | null>;

  /**
   * Delete a user
   */
  deleteUser(id: string): Promise<boolean>;

  /**
   * Update user password
   */
  updatePassword(id: string, hashedPassword: string): Promise<boolean>;

  /**
   * Verify user email
   */
  verifyUser(id: string): Promise<boolean>;

  /**
   * Increment failed login attempts for a user
   * Returns the new count of failed attempts
   */
  incrementFailedLoginAttempts(userId: string): Promise<number>;

  /**
   * Reset failed login attempts to 0
   */
  resetFailedLoginAttempts(userId: string): Promise<void>;

  /**
   * Lock user account until specified time
   */
  lockAccount(userId: string, lockUntil: Date): Promise<void>;

  /**
   * Check if user account is locked
   */
  isAccountLocked(userId: string): Promise<boolean>;

  // ==================== 2FA Operations ====================

  /**
   * Enable 2FA for a user
   */
  enable2FA(userId: string, secret: string, backupCodes: string[]): Promise<boolean>;

  /**
   * Disable 2FA for a user
   */
  disable2FA(userId: string): Promise<boolean>;

  /**
   * Get 2FA secret for a user
   */
  get2FASecret(userId: string): Promise<string | null>;

  /**
   * Verify and consume a backup code
   */
  verifyBackupCode(userId: string, code: string): Promise<boolean>;

  // ==================== Session Operations ====================

  /**
   * Add a session token to user
   * Should enforce max session limit (e.g., 10 sessions per user)
   */
  addSession(userId: string, session: ISessionData): Promise<void>;

  /**
   * Get a specific session for a user
   */
  getSession(userId: string, sessionId: string): Promise<ISessionData | null>;

  /**
   * Remove a specific session
   */
  removeSession(userId: string, sessionId: string): Promise<void>;

  /**
   * Clear all sessions for a user
   */
  clearAllSessions(userId: string): Promise<void>;

  /**
   * Update refresh token for a session
   */
  updateSessionToken(userId: string, sessionId: string, newRefreshToken: string): Promise<void>;

  /**
   * Get all sessions for a user
   */
  getAllSessions(userId: string): Promise<ISessionData[]>;

  // ==================== OTP Operations ====================

  /**
   * Create a new OTP
   */
  createOTP(data: IOTPData): Promise<void>;

  /**
   * Find an OTP by user ID, session ID, and type
   */
  findOTP(userId: string, sessionId: string, otpType: string): Promise<IOTPData | null>;

  /**
   * Delete an OTP (after validation or expiry)
   */
  deleteOTP(userId: string, sessionId: string): Promise<void>;

  /**
   * Delete all OTPs for a user
   */
  deleteAllUserOTPs(userId: string): Promise<void>;

  /**
   * Update OTP count and sent timestamp
   */
  updateOTPCount(userId: string, sessionId: string, count: number, sentAt: Date): Promise<void>;
}
