/**
 * Session Store Interface
 *
 * Separates session storage from user data storage.
 * Allows using different backends for sessions (Redis) vs users (PostgreSQL).
 *
 * Implementations:
 * - RedisSessionStore: Fast in-memory session storage
 * - MemorySessionStore: In-memory storage (dev/testing)
 * - DatabaseSessionStore: Wraps IDatabaseAdapter for backward compatibility
 */

export interface ISessionData {
  sessionId: string;
  userId: string;
  refreshToken: string;
  ip: string;
  deviceName: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ISessionStore {
  /**
   * Add a new session
   *
   * Implements FIFO strategy:
   * - If user has reached max sessions limit, removes the OLDEST session
   * - Then adds the new session
   *
   * @param session - Session data to add
   * @param maxSessionsPerUser - Maximum sessions allowed per user (default: 10)
   */
  addSession(session: ISessionData, maxSessionsPerUser?: number): Promise<void>;

  /**
   * Get a specific session by userId and sessionId
   */
  getSession(userId: string, sessionId: string): Promise<ISessionData | null>;

  /**
   * Remove a specific session
   */
  removeSession(userId: string, sessionId: string): Promise<void>;

  /**
   * Remove all sessions for a user
   */
  clearAllSessions(userId: string): Promise<void>;

  /**
   * Update refresh token for a session
   */
  updateSessionToken(userId: string, sessionId: string, newRefreshToken: string): Promise<void>;

  /**
   * Get all sessions for a user
   * Returns sessions ordered by createdAt (oldest first)
   */
  getAllSessions(userId: string): Promise<ISessionData[]>;

  /**
   * Clean up expired sessions (optional, for stores that need manual cleanup)
   * Removes sessions where expiresAt < now
   */
  cleanupExpiredSessions?(): Promise<void>;
}
