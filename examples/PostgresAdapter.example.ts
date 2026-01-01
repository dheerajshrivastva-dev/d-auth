/**
 * Example PostgreSQL Adapter Implementation
 *
 * This shows how users can implement their own database adapter for SQL databases
 */

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import {
  IDatabaseAdapter,
  IUserDocument,
  ISessionData,
  IOTPData,
} from "../src/adapters/IDatabaseAdapter";

export class PostgresAdapter implements IDatabaseAdapter {
  private pool: Pool;
  private maxSessionsPerUser: number;

  constructor(options: { connectionString: string; maxSessionsPerUser?: number }) {
    this.pool = new Pool({
      connectionString: options.connectionString,
    });
    this.maxSessionsPerUser = options.maxSessionsPerUser || 10;
  }

  // ==================== User Operations ====================

  async findUserByEmail(email: string): Promise<IUserDocument | null> {
    const result = await this.pool.query("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  async findUserById(id: string): Promise<IUserDocument | null> {
    const result = await this.pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  async findUserByOAuthId(
    provider: "google" | "facebook" | "apple",
    oauthId: string
  ): Promise<IUserDocument | null> {
    const column = `${provider}_id`;
    const result = await this.pool.query(`SELECT * FROM users WHERE ${column} = $1`, [oauthId]);
    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  async createUser(userData: Partial<IUserDocument>): Promise<IUserDocument> {
    const result = await this.pool.query(
      `INSERT INTO users (email, password, google_id, facebook_id, apple_id, roles, is_verified, two_factor_enabled, first_name, last_name, profile_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING *`,
      [
        userData.email,
        userData.password,
        userData.googleId,
        userData.facebookId,
        userData.appleId,
        JSON.stringify(userData.roles || ["user"]),
        userData.isVerified || false,
        false,
        userData.firstName,
        userData.lastName,
        userData.profileUrl,
      ]
    );
    return this.mapRowToUser(result.rows[0]);
  }

  async updateUser(id: string, data: Partial<IUserDocument>): Promise<IUserDocument | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.email) {
      updates.push(`email = $${paramCount++}`);
      values.push(data.email);
    }
    if (data.firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(data.lastName);
    }
    if (data.profileUrl !== undefined) {
      updates.push(`profile_url = $${paramCount++}`);
      values.push(data.profileUrl);
    }
    if (data.roles) {
      updates.push(`roles = $${paramCount++}`);
      values.push(JSON.stringify(data.roles));
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM users WHERE id = $1", [id]);
    return result.rowCount! > 0;
  }

  async updatePassword(id: string, hashedPassword: string): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
      [hashedPassword, id]
    );
    return result.rowCount! > 0;
  }

  async verifyUser(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1",
      [id]
    );
    return result.rowCount! > 0;
  }

  // ==================== 2FA Operations ====================

  async enable2FA(userId: string, secret: string, backupCodes: string[]): Promise<boolean> {
    const hashedCodes = await Promise.all(backupCodes.map((code) => bcrypt.hash(code, 10)));

    const result = await this.pool.query(
      `UPDATE users
       SET two_factor_enabled = true,
           two_factor_secret = $1,
           two_factor_backup_codes = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [secret, JSON.stringify(hashedCodes), userId]
    );
    return result.rowCount! > 0;
  }

  async disable2FA(userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE users
       SET two_factor_enabled = false,
           two_factor_secret = NULL,
           two_factor_backup_codes = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
    return result.rowCount! > 0;
  }

  async get2FASecret(userId: string): Promise<string | null> {
    const result = await this.pool.query("SELECT two_factor_secret FROM users WHERE id = $1", [
      userId,
    ]);
    return result.rows[0]?.two_factor_secret || null;
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const result = await this.pool.query(
      "SELECT two_factor_backup_codes FROM users WHERE id = $1",
      [userId]
    );

    if (!result.rows[0]) return false;

    const backupCodes = JSON.parse(result.rows[0].two_factor_backup_codes || "[]");

    for (let i = 0; i < backupCodes.length; i++) {
      const isMatch = await bcrypt.compare(code, backupCodes[i]);
      if (isMatch) {
        // Remove used code
        backupCodes.splice(i, 1);
        await this.pool.query("UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2", [
          JSON.stringify(backupCodes),
          userId,
        ]);
        return true;
      }
    }

    return false;
  }

  // ==================== Session Operations ====================

  async addSession(userId: string, session: ISessionData): Promise<void> {
    // Check for existing session from same device/IP
    const existing = await this.pool.query(
      "SELECT id FROM user_sessions WHERE user_id = $1 AND ip = $2 AND device_name = $3",
      [userId, session.ip, session.deviceName]
    );

    if (existing.rows.length > 0) {
      // Update existing session
      await this.pool.query(
        `UPDATE user_sessions
         SET session_id = $1, refresh_token = $2, created_at = $3, expires_at = $4
         WHERE user_id = $5 AND ip = $6 AND device_name = $7`,
        [
          session.sessionId,
          session.refreshToken,
          session.createdAt,
          session.expiresAt,
          userId,
          session.ip,
          session.deviceName,
        ]
      );
    } else {
      // Insert new session
      await this.pool.query(
        `INSERT INTO user_sessions (user_id, session_id, refresh_token, ip, device_name, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          session.sessionId,
          session.refreshToken,
          session.ip,
          session.deviceName,
          session.createdAt,
          session.expiresAt,
        ]
      );

      // Enforce max sessions limit
      await this.pool.query(
        `DELETE FROM user_sessions
         WHERE user_id = $1
         AND id NOT IN (
           SELECT id FROM user_sessions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2
         )`,
        [userId, this.maxSessionsPerUser]
      );
    }
  }

  async getSession(userId: string, sessionId: string): Promise<ISessionData | null> {
    const result = await this.pool.query(
      "SELECT * FROM user_sessions WHERE user_id = $1 AND session_id = $2",
      [userId, sessionId]
    );

    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      sessionId: row.session_id,
      refreshToken: row.refresh_token,
      ip: row.ip,
      deviceName: row.device_name,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  async removeSession(userId: string, sessionId: string): Promise<void> {
    await this.pool.query("DELETE FROM user_sessions WHERE user_id = $1 AND session_id = $2", [
      userId,
      sessionId,
    ]);
  }

  async clearAllSessions(userId: string): Promise<void> {
    await this.pool.query("DELETE FROM user_sessions WHERE user_id = $1", [userId]);
  }

  async updateSessionToken(
    userId: string,
    sessionId: string,
    newRefreshToken: string
  ): Promise<void> {
    await this.pool.query(
      "UPDATE user_sessions SET refresh_token = $1 WHERE user_id = $2 AND session_id = $3",
      [newRefreshToken, userId, sessionId]
    );
  }

  async getAllSessions(userId: string): Promise<ISessionData[]> {
    const result = await this.pool.query(
      "SELECT * FROM user_sessions WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    return result.rows.map((row) => ({
      sessionId: row.session_id,
      refreshToken: row.refresh_token,
      ip: row.ip,
      deviceName: row.device_name,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
  }

  // ==================== OTP Operations ====================

  async createOTP(data: IOTPData): Promise<void> {
    // Delete existing OTPs for this user
    await this.pool.query("DELETE FROM otps WHERE user_id = $1", [data.userId]);

    await this.pool.query(
      `INSERT INTO otps (user_id, otp, session_id, otp_type, otp_count, otp_sent_at, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        data.userId,
        data.otp,
        data.sessionId,
        data.otpType,
        data.otpCount,
        data.otpSentAt,
        data.createdAt,
        data.expiresAt,
      ]
    );
  }

  async findOTP(userId: string, sessionId: string, otpType: string): Promise<IOTPData | null> {
    const result = await this.pool.query(
      "SELECT * FROM otps WHERE user_id = $1 AND session_id = $2 AND otp_type = $3",
      [userId, sessionId, otpType]
    );

    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      otp: row.otp,
      sessionId: row.session_id,
      otpType: row.otp_type,
      otpCount: row.otp_count,
      otpSentAt: row.otp_sent_at,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  async deleteOTP(userId: string, sessionId: string): Promise<void> {
    await this.pool.query("DELETE FROM otps WHERE user_id = $1 AND session_id = $2", [
      userId,
      sessionId,
    ]);
  }

  async deleteAllUserOTPs(userId: string): Promise<void> {
    await this.pool.query("DELETE FROM otps WHERE user_id = $1", [userId]);
  }

  async updateOTPCount(
    userId: string,
    sessionId: string,
    count: number,
    sentAt: Date
  ): Promise<void> {
    await this.pool.query(
      "UPDATE otps SET otp_count = $1, otp_sent_at = $2 WHERE user_id = $3 AND session_id = $4",
      [count, sentAt, userId, sessionId]
    );
  }

  // ==================== Helper Methods ====================

  private mapRowToUser(row: any): IUserDocument {
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      googleId: row.google_id,
      facebookId: row.facebook_id,
      appleId: row.apple_id,
      roles: JSON.parse(row.roles || '["user"]'),
      isVerified: row.is_verified,
      twoFactorEnabled: row.two_factor_enabled,
      twoFactorSecret: row.two_factor_secret,
      twoFactorBackupCodes: row.two_factor_backup_codes
        ? JSON.parse(row.two_factor_backup_codes)
        : [],
      firstName: row.first_name,
      lastName: row.last_name,
      profileUrl: row.profile_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * SQL Schema for PostgreSQL:
 *
 * CREATE TABLE users (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   email VARCHAR(255) UNIQUE NOT NULL,
 *   password VARCHAR(255),
 *   google_id VARCHAR(255),
 *   facebook_id VARCHAR(255),
 *   apple_id VARCHAR(255),
 *   roles JSONB DEFAULT '["user"]',
 *   is_verified BOOLEAN DEFAULT false,
 *   two_factor_enabled BOOLEAN DEFAULT false,
 *   two_factor_secret VARCHAR(255),
 *   two_factor_backup_codes JSONB,
 *   first_name VARCHAR(255),
 *   last_name VARCHAR(255),
 *   profile_url TEXT,
 *   created_at TIMESTAMP DEFAULT NOW(),
 *   updated_at TIMESTAMP DEFAULT NOW()
 * );
 *
 * CREATE TABLE user_sessions (
 *   id SERIAL PRIMARY KEY,
 *   user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 *   session_id VARCHAR(255) NOT NULL,
 *   refresh_token TEXT NOT NULL,
 *   ip VARCHAR(45) NOT NULL,
 *   device_name VARCHAR(255) NOT NULL,
 *   created_at TIMESTAMP DEFAULT NOW(),
 *   expires_at TIMESTAMP NOT NULL
 * );
 *
 * CREATE TABLE otps (
 *   id SERIAL PRIMARY KEY,
 *   user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 *   otp VARCHAR(10) NOT NULL,
 *   session_id VARCHAR(255) NOT NULL,
 *   otp_type VARCHAR(50) NOT NULL,
 *   otp_count INT DEFAULT 0,
 *   otp_sent_at TIMESTAMP DEFAULT NOW(),
 *   created_at TIMESTAMP DEFAULT NOW(),
 *   expires_at TIMESTAMP NOT NULL
 * );
 *
 * CREATE INDEX idx_users_email ON users(email);
 * CREATE INDEX idx_users_google_id ON users(google_id);
 * CREATE INDEX idx_users_facebook_id ON users(facebook_id);
 * CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
 * CREATE INDEX idx_sessions_session_id ON user_sessions(session_id);
 * CREATE INDEX idx_otps_user_id ON otps(user_id);
 * CREATE INDEX idx_otps_session_id ON otps(session_id);
 */
