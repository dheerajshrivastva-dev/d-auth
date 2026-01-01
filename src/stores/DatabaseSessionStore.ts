import { ISessionStore, ISessionData } from "./ISessionStore";
import { IDatabaseAdapter, ISessionData as AdapterSessionData } from "../adapters/IDatabaseAdapter";

/**
 * Database Session Store
 *
 * Wraps IDatabaseAdapter to implement ISessionStore interface.
 * Provides backward compatibility with existing database adapters.
 *
 * The database adapter's session methods will handle storage in
 * whatever database the user has configured (MongoDB, PostgreSQL, etc.)
 */
export class DatabaseSessionStore implements ISessionStore {
  constructor(private database: IDatabaseAdapter) {}

  async addSession(session: ISessionData, maxSessionsPerUser: number = 10): Promise<void> {
    // Convert ISessionData to AdapterSessionData format
    const adapterSession: AdapterSessionData = {
      sessionId: session.sessionId,
      refreshToken: session.refreshToken,
      ip: session.ip,
      deviceName: session.deviceName,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };

    // Get existing sessions to implement FIFO
    const existingSessions = await this.database.getAllSessions(session.userId);

    // FIFO: If at limit, remove oldest session
    if (existingSessions.length >= maxSessionsPerUser && existingSessions.length > 0) {
      // Sessions should be ordered by createdAt (oldest first)
      const oldestSession = existingSessions[0];
      await this.database.removeSession(session.userId, oldestSession.sessionId);
    }

    // Add new session
    await this.database.addSession(session.userId, adapterSession);
  }

  async getSession(userId: string, sessionId: string): Promise<ISessionData | null> {
    const session = await this.database.getSession(userId, sessionId);
    if (!session) return null;

    // Convert AdapterSessionData to ISessionData
    return {
      sessionId: session.sessionId,
      userId,
      refreshToken: session.refreshToken,
      ip: session.ip,
      deviceName: session.deviceName,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }

  async removeSession(userId: string, sessionId: string): Promise<void> {
    await this.database.removeSession(userId, sessionId);
  }

  async clearAllSessions(userId: string): Promise<void> {
    await this.database.clearAllSessions(userId);
  }

  async updateSessionToken(
    userId: string,
    sessionId: string,
    newRefreshToken: string
  ): Promise<void> {
    await this.database.updateSessionToken(userId, sessionId, newRefreshToken);
  }

  async getAllSessions(userId: string): Promise<ISessionData[]> {
    const sessions = await this.database.getAllSessions(userId);
    return sessions.map((session) => ({
      sessionId: session.sessionId,
      userId,
      refreshToken: session.refreshToken,
      ip: session.ip,
      deviceName: session.deviceName,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  }

  // Database adapters should handle cleanup in their own way
  // (e.g., TTL indexes in MongoDB, cron jobs, etc.)
}
