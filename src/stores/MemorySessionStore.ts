import { ISessionStore, ISessionData } from "./ISessionStore";

/**
 * In-Memory Session Store
 *
 * Fast but:
 * - Data lost on restart
 * - Not suitable for multi-server deployments
 * - Good for development/testing
 */
export class MemorySessionStore implements ISessionStore {
  private sessions: Map<string, ISessionData[]> = new Map();

  async addSession(session: ISessionData, maxSessionsPerUser: number = 10): Promise<void> {
    const userId = session.userId;
    let userSessions = this.sessions.get(userId) || [];

    // FIFO: If at limit, remove oldest session (first in array)
    if (userSessions.length >= maxSessionsPerUser) {
      userSessions.shift(); // Remove oldest
    }

    // Add new session at the end
    userSessions.push(session);
    this.sessions.set(userId, userSessions);
  }

  async getSession(userId: string, sessionId: string): Promise<ISessionData | null> {
    const userSessions = this.sessions.get(userId) || [];
    return userSessions.find((s) => s.sessionId === sessionId) || null;
  }

  async removeSession(userId: string, sessionId: string): Promise<void> {
    const userSessions = this.sessions.get(userId) || [];
    const filtered = userSessions.filter((s) => s.sessionId !== sessionId);
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
    const userSessions = this.sessions.get(userId) || [];
    const session = userSessions.find((s) => s.sessionId === sessionId);
    if (session) {
      session.refreshToken = newRefreshToken;
      this.sessions.set(userId, userSessions);
    }
  }

  async getAllSessions(userId: string): Promise<ISessionData[]> {
    return this.sessions.get(userId) || [];
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    for (const [userId, sessions] of this.sessions.entries()) {
      const validSessions = sessions.filter((s) => s.expiresAt > now);
      if (validSessions.length === 0) {
        this.sessions.delete(userId);
      } else {
        this.sessions.set(userId, validSessions);
      }
    }
  }

  /**
   * Reset all sessions (useful for testing)
   */
  reset(): void {
    this.sessions.clear();
  }
}
