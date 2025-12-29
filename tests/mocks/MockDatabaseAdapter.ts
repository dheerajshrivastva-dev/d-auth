import {
  IDatabaseAdapter,
  IUserDocument,
  ISessionData,
  IOTPData,
} from "../../src/adapters/IDatabaseAdapter";

/**
 * Mock Database Adapter for testing
 */
export class MockDatabaseAdapter implements IDatabaseAdapter {
  private users: Map<string, IUserDocument> = new Map();
  private sessions: Map<string, ISessionData[]> = new Map();
  private otps: Map<string, IOTPData[]> = new Map();

  // Helper to reset all data
  reset(): void {
    this.users.clear();
    this.sessions.clear();
    this.otps.clear();
  }

  // Helper to seed test data
  seedUser(user: IUserDocument): void {
    this.users.set(user.id, user);
  }

  // ==================== User Operations ====================

  async findUserByEmail(email: string): Promise<IUserDocument | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<IUserDocument | null> {
    return this.users.get(id) || null;
  }

  async findUserByOAuthId(
    provider: "google" | "facebook" | "apple",
    oauthId: string
  ): Promise<IUserDocument | null> {
    const field = `${provider}Id`;
    for (const user of this.users.values()) {
      if (user[field] === oauthId) {
        return user;
      }
    }
    return null;
  }

  async createUser(userData: Partial<IUserDocument>): Promise<IUserDocument> {
    const user: IUserDocument = {
      id: `user_${Date.now()}`,
      email: userData.email!,
      password: userData.password,
      roles: userData.roles || ["user"],
      isVerified: userData.isVerified || false,
      twoFactorEnabled: userData.twoFactorEnabled || false,
      ...userData,
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, data: Partial<IUserDocument>): Promise<IUserDocument | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async updatePassword(id: string, hashedPassword: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;

    user.password = hashedPassword;
    this.users.set(id, user);
    return true;
  }

  async verifyUser(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;

    user.isVerified = true;
    this.users.set(id, user);
    return true;
  }

  async incrementFailedLoginAttempts(userId: string): Promise<number> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");

    const attempts = (user.failedLoginAttempts || 0) + 1;
    user.failedLoginAttempts = attempts;
    user.lastFailedLoginAt = new Date();
    this.users.set(userId, user);
    return attempts;
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    user.failedLoginAttempts = 0;
    user.lastFailedLoginAt = undefined;
    this.users.set(userId, user);
  }

  async lockAccount(userId: string, lockUntil: Date): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    user.accountLockedUntil = lockUntil;
    this.users.set(userId, user);
  }

  async isAccountLocked(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user || !user.accountLockedUntil) return false;

    return new Date() < user.accountLockedUntil;
  }

  // ==================== 2FA Operations ====================

  async enable2FA(userId: string, secret: string, backupCodes: string[]): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    user.twoFactorEnabled = true;
    user.twoFactorSecret = secret;
    user.twoFactorBackupCodes = backupCodes;
    this.users.set(userId, user);
    return true;
  }

  async disable2FA(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = undefined;
    this.users.set(userId, user);
    return true;
  }

  async get2FASecret(userId: string): Promise<string | null> {
    const user = this.users.get(userId);
    return user?.twoFactorSecret || null;
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user || !user.twoFactorBackupCodes) return false;

    const index = user.twoFactorBackupCodes.indexOf(code);
    if (index === -1) return false;

    user.twoFactorBackupCodes.splice(index, 1);
    this.users.set(userId, user);
    return true;
  }

  // ==================== Session Operations ====================

  async addSession(userId: string, session: ISessionData): Promise<void> {
    const sessions = this.sessions.get(userId) || [];
    sessions.push(session);

    // Keep max 10 sessions
    if (sessions.length > 10) {
      sessions.shift();
    }

    this.sessions.set(userId, sessions);
  }

  async getSession(userId: string, sessionId: string): Promise<ISessionData | null> {
    const sessions = this.sessions.get(userId) || [];
    return sessions.find((s) => s.sessionId === sessionId) || null;
  }

  async removeSession(userId: string, sessionId: string): Promise<void> {
    const sessions = this.sessions.get(userId) || [];
    const filtered = sessions.filter((s) => s.sessionId !== sessionId);
    this.sessions.set(userId, filtered);
  }

  async clearAllSessions(userId: string): Promise<void> {
    this.sessions.delete(userId);
  }

  async updateSessionToken(
    userId: string,
    sessionId: string,
    newRefreshToken: string
  ): Promise<void> {
    const sessions = this.sessions.get(userId) || [];
    const session = sessions.find((s) => s.sessionId === sessionId);
    if (session) {
      session.refreshToken = newRefreshToken;
      this.sessions.set(userId, sessions);
    }
  }

  async getAllSessions(userId: string): Promise<ISessionData[]> {
    return this.sessions.get(userId) || [];
  }

  // ==================== OTP Operations ====================

  async createOTP(data: IOTPData): Promise<void> {
    const otps = this.otps.get(data.userId) || [];
    otps.push(data);
    this.otps.set(data.userId, otps);
  }

  async findOTP(userId: string, sessionId: string, otpType: string): Promise<IOTPData | null> {
    const otps = this.otps.get(userId) || [];
    return otps.find((o) => o.sessionId === sessionId && o.otpType === otpType) || null;
  }

  async deleteOTP(userId: string, sessionId: string): Promise<void> {
    const otps = this.otps.get(userId) || [];
    const filtered = otps.filter((o) => o.sessionId !== sessionId);
    this.otps.set(userId, filtered);
  }

  async deleteAllUserOTPs(userId: string): Promise<void> {
    this.otps.delete(userId);
  }

  async updateOTPCount(
    userId: string,
    sessionId: string,
    count: number,
    sentAt: Date
  ): Promise<void> {
    const otps = this.otps.get(userId) || [];
    const otp = otps.find((o) => o.sessionId === sessionId);
    if (otp) {
      otp.otpCount = count;
      otp.otpSentAt = sentAt;
      this.otps.set(userId, otps);
    }
  }
}
