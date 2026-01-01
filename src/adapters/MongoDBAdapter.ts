import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { IDatabaseAdapter, IUserDocument, ISessionData, IOTPData } from "./IDatabaseAdapter";

/**
 * MongoDB Adapter for d-auth
 * Implements IDatabaseAdapter using Mongoose
 */
export class MongoDBAdapter implements IDatabaseAdapter {
  private userModel: mongoose.Model<any>;
  private otpModel: mongoose.Model<any>;
  private maxSessionsPerUser: number;

  constructor(options: {
    uri?: string;
    userModel?: mongoose.Model<any>;
    otpModel?: mongoose.Model<any>;
    maxSessionsPerUser?: number;
  }) {
    this.maxSessionsPerUser = options.maxSessionsPerUser || 10;

    // Connect to MongoDB if URI provided
    if (options.uri && mongoose.connection.readyState === 0) {
      mongoose.connect(options.uri);
    }

    // Use provided models or create default ones
    this.userModel = options.userModel || this.createDefaultUserModel();
    this.otpModel = options.otpModel || this.createDefaultOTPModel();
  }

  /**
   * Create default User model schema
   */
  private createDefaultUserModel() {
    const userSchema = new mongoose.Schema(
      {
        email: { type: String, required: true, unique: true },
        password: { type: String },
        googleId: { type: String },
        facebookId: { type: String },
        appleId: { type: String },
        roles: { type: [String], default: ["user"] },
        isVerified: { type: Boolean, default: false },

        // Password management (v4.0.0)
        isTemporaryPassword: { type: Boolean, default: false },
        mustResetPassword: { type: Boolean, default: false },
        failedLoginAttempts: { type: Number, default: 0 },
        lastFailedLoginAt: { type: Date },
        accountLockedUntil: { type: Date },

        // 2FA fields
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorSecret: { type: String },
        twoFactorBackupCodes: { type: [String], default: [] },

        // Profile fields
        firstName: { type: String },
        lastName: { type: String },
        profileUrl: { type: String },

        // Sessions
        tokens: [
          {
            sessionId: { type: String, required: true },
            refreshToken: { type: String, required: true },
            ip: { type: String, required: true },
            deviceName: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
            expiresAt: { type: Date, required: true },
          },
        ],
      },
      { timestamps: true, strict: false }
    );

    return mongoose.models.User || mongoose.model("User", userSchema);
  }

  /**
   * Create default OTP model schema
   */
  private createDefaultOTPModel() {
    const otpSchema = new mongoose.Schema({
      userId: { type: String, required: true, index: true },
      otp: { type: String, required: true },
      sessionId: { type: String, required: true, index: true },
      otpType: {
        type: String,
        enum: ["ForgetPassword", "VerifyEmail", "Verify2FA", "VerifyPhone"],
        required: true,
      },
      otpCount: { type: Number, default: 0 },
      otpSentAt: { type: Date, default: Date.now },
      createdAt: { type: Date, default: Date.now, expires: 600 }, // TTL: 10 minutes
      expiresAt: { type: Date, required: true },
    });

    return mongoose.models.OTP || mongoose.model("OTP", otpSchema);
  }

  // ==================== User Operations ====================

  async findUserByEmail(email: string): Promise<IUserDocument | null> {
    const user = await this.userModel.findOne({ email }).lean();
    return user ? this.mapToUserDocument(user) : null;
  }

  async findUserById(id: string): Promise<IUserDocument | null> {
    const user = await this.userModel.findById(id).lean();
    return user ? this.mapToUserDocument(user) : null;
  }

  async findUserByOAuthId(
    provider: "google" | "facebook" | "apple",
    oauthId: string
  ): Promise<IUserDocument | null> {
    const field = `${provider}Id`;
    const user = await this.userModel.findOne({ [field]: oauthId }).lean();
    return user ? this.mapToUserDocument(user) : null;
  }

  async createUser(userData: Partial<IUserDocument>): Promise<IUserDocument> {
    const user = await this.userModel.create({
      ...userData,
      roles: userData.roles || ["user"],
      isVerified: userData.isVerified || false,
      twoFactorEnabled: false,
      tokens: [],
    });
    return this.mapToUserDocument(user.toObject());
  }

  async updateUser(id: string, data: Partial<IUserDocument>): Promise<IUserDocument | null> {
    const user = await this.userModel.findByIdAndUpdate(id, data, { new: true }).lean();
    return user ? this.mapToUserDocument(user) : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndDelete(id);
    return !!result;
  }

  async updatePassword(id: string, hashedPassword: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndUpdate(id, {
      password: hashedPassword,
    });
    return !!result;
  }

  async verifyUser(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndUpdate(id, {
      isVerified: true,
    });
    return !!result;
  }

  async incrementFailedLoginAttempts(userId: string): Promise<number> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new Error("User not found");

    const newCount = (user.failedLoginAttempts || 0) + 1;
    await this.userModel.findByIdAndUpdate(userId, {
      failedLoginAttempts: newCount,
      lastFailedLoginAt: new Date(),
    });

    return newCount;
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
    });
  }

  async lockAccount(userId: string, lockUntil: Date): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      accountLockedUntil: lockUntil,
    });
  }

  async isAccountLocked(userId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId).select("accountLockedUntil");
    if (!user || !user.accountLockedUntil) return false;

    // Check if lock time has passed
    return new Date() < new Date(user.accountLockedUntil);
  }

  // ==================== 2FA Operations ====================

  async enable2FA(userId: string, secret: string, backupCodes: string[]): Promise<boolean> {
    // Hash backup codes before storing
    const hashedCodes = await Promise.all(backupCodes.map((code) => bcrypt.hash(code, 10)));

    const result = await this.userModel.findByIdAndUpdate(userId, {
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorBackupCodes: hashedCodes,
    });
    return !!result;
  }

  async disable2FA(userId: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndUpdate(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    });
    return !!result;
  }

  async get2FASecret(userId: string): Promise<string | null> {
    const user = await this.userModel.findById(userId).select("twoFactorSecret");
    return user?.twoFactorSecret || null;
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user || !user.twoFactorBackupCodes) return false;

    // Find matching backup code
    for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
      const isMatch = await bcrypt.compare(code, user.twoFactorBackupCodes[i]);
      if (isMatch) {
        // Remove used backup code
        user.twoFactorBackupCodes.splice(i, 1);
        await user.save();
        return true;
      }
    }

    return false;
  }

  // ==================== Session Operations ====================

  async addSession(userId: string, session: ISessionData): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new Error("User not found");

    // Check for existing session from same device/IP
    const existingIndex = user.tokens.findIndex(
      (t: any) => t.ip === session.ip && t.deviceName === session.deviceName
    );

    if (existingIndex !== -1) {
      // Update existing session
      user.tokens[existingIndex] = session;
    } else {
      // Add new session
      user.tokens.push(session);

      // Enforce max sessions limit
      if (user.tokens.length > this.maxSessionsPerUser) {
        user.tokens.shift(); // Remove oldest session
      }
    }

    await user.save();
  }

  async getSession(userId: string, sessionId: string): Promise<ISessionData | null> {
    const user = await this.userModel.findById(userId);
    if (!user) return null;

    const session = user.tokens.find((t: any) => t.sessionId === sessionId);
    return session || null;
  }

  async removeSession(userId: string, sessionId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { tokens: { sessionId } },
    });
  }

  async clearAllSessions(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      tokens: [],
    });
  }

  async updateSessionToken(
    userId: string,
    sessionId: string,
    newRefreshToken: string
  ): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new Error("User not found");

    const session = user.tokens.find((t: any) => t.sessionId === sessionId);
    if (session) {
      session.refreshToken = newRefreshToken;
      await user.save();
    }
  }

  async getAllSessions(userId: string): Promise<ISessionData[]> {
    const user = await this.userModel.findById(userId);
    return user?.tokens || [];
  }

  // ==================== OTP Operations ====================

  async createOTP(data: IOTPData): Promise<void> {
    // Delete existing OTPs for this user to prevent duplicates
    await this.otpModel.deleteMany({ userId: data.userId });

    await this.otpModel.create(data);
  }

  async findOTP(userId: string, sessionId: string, otpType: string): Promise<IOTPData | null> {
    const otp = await this.otpModel.findOne({ userId, sessionId, otpType }).lean();
    return otp ? this.mapToOTPData(otp) : null;
  }

  async deleteOTP(userId: string, sessionId: string): Promise<void> {
    await this.otpModel.deleteOne({ userId, sessionId });
  }

  async deleteAllUserOTPs(userId: string): Promise<void> {
    await this.otpModel.deleteMany({ userId });
  }

  async updateOTPCount(
    userId: string,
    sessionId: string,
    count: number,
    sentAt: Date
  ): Promise<void> {
    await this.otpModel.findOneAndUpdate(
      { userId, sessionId },
      { otpCount: count, otpSentAt: sentAt }
    );
  }

  // ==================== Helper Methods ====================

  private mapToUserDocument(user: any): IUserDocument {
    return {
      id: user._id.toString(),
      email: user.email,
      password: user.password,
      googleId: user.googleId,
      facebookId: user.facebookId,
      appleId: user.appleId,
      roles: user.roles || ["user"],
      isVerified: user.isVerified || false,

      // Password management (v4.0.0)
      isTemporaryPassword: user.isTemporaryPassword || false,
      mustResetPassword: user.mustResetPassword || false,
      failedLoginAttempts: user.failedLoginAttempts || 0,
      lastFailedLoginAt: user.lastFailedLoginAt,
      accountLockedUntil: user.accountLockedUntil,

      // 2FA
      twoFactorEnabled: user.twoFactorEnabled || false,
      twoFactorSecret: user.twoFactorSecret,
      twoFactorBackupCodes: user.twoFactorBackupCodes,

      // Profile
      firstName: user.firstName,
      lastName: user.lastName,
      profileUrl: user.profileUrl,

      // Timestamps
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ...user, // Include any custom fields
    };
  }

  private mapToOTPData(otp: any): IOTPData {
    return {
      id: otp._id?.toString(),
      userId: otp.userId,
      otp: otp.otp,
      sessionId: otp.sessionId,
      otpType: otp.otpType,
      otpCount: otp.otpCount || 0,
      otpSentAt: otp.otpSentAt,
      createdAt: otp.createdAt,
      expiresAt: otp.expiresAt,
    };
  }
}
