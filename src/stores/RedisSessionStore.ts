import { ISessionStore, ISessionData } from "./ISessionStore";

/**
 * Redis Session Store
 *
 * Fast in-memory session storage using Redis.
 * Recommended for production with blacklist strategy.
 *
 * Features:
 * - Automatic expiry using Redis TTL
 * - Fast lookups (O(1) for getSession)
 * - Scales horizontally
 *
 * Note: Requires redis client to be passed in constructor.
 * Compatible with both 'redis' and 'ioredis' packages.
 */

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: any): Promise<any>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  ttl(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

export class RedisSessionStore implements ISessionStore {
  private keyPrefix = "dauth:session:";
  private userSessionsPrefix = "dauth:user:sessions:";

  constructor(private redis: RedisClient) {}

  private getSessionKey(userId: string, sessionId: string): string {
    return `${this.keyPrefix}${userId}:${sessionId}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `${this.userSessionsPrefix}${userId}`;
  }

  async addSession(session: ISessionData, maxSessionsPerUser: number = 10): Promise<void> {
    const userId = session.userId;
    const sessionKey = this.getSessionKey(userId, session.sessionId);
    const userSessionsKey = this.getUserSessionsKey(userId);

    // Get existing sessions for FIFO
    const sessionListJson = await this.redis.get(userSessionsKey);
    let sessionList: Array<{ sessionId: string; createdAt: string }> = sessionListJson
      ? JSON.parse(sessionListJson)
      : [];

    // FIFO: If at limit, remove oldest session
    if (sessionList.length >= maxSessionsPerUser && sessionList.length > 0) {
      const oldestSession = sessionList[0];
      await this.redis.del(this.getSessionKey(userId, oldestSession.sessionId));
      sessionList.shift();
    }

    // Add new session to list
    sessionList.push({
      sessionId: session.sessionId,
      createdAt: session.createdAt.toISOString(),
    });

    // Store session data
    const sessionData = JSON.stringify(session);
    const ttlSeconds = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);

    // Set session with TTL (auto-expiry)
    await this.redis.set(sessionKey, sessionData, { EX: ttlSeconds });

    // Update user sessions list
    await this.redis.set(userSessionsKey, JSON.stringify(sessionList), { EX: ttlSeconds });
  }

  async getSession(userId: string, sessionId: string): Promise<ISessionData | null> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    const sessionData = await this.redis.get(sessionKey);

    if (!sessionData) return null;

    const session = JSON.parse(sessionData);
    return {
      ...session,
      createdAt: new Date(session.createdAt),
      expiresAt: new Date(session.expiresAt),
    };
  }

  async removeSession(userId: string, sessionId: string): Promise<void> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    const userSessionsKey = this.getUserSessionsKey(userId);

    // Remove session
    await this.redis.del(sessionKey);

    // Update user sessions list
    const sessionListJson = await this.redis.get(userSessionsKey);
    if (sessionListJson) {
      let sessionList = JSON.parse(sessionListJson);
      sessionList = sessionList.filter((s: any) => s.sessionId !== sessionId);
      await this.redis.set(userSessionsKey, JSON.stringify(sessionList));
    }
  }

  async clearAllSessions(userId: string): Promise<void> {
    const userSessionsKey = this.getUserSessionsKey(userId);

    // Get all sessions for this user
    const sessionListJson = await this.redis.get(userSessionsKey);
    if (sessionListJson) {
      const sessionList = JSON.parse(sessionListJson);

      // Delete each session
      for (const session of sessionList) {
        await this.redis.del(this.getSessionKey(userId, session.sessionId));
      }

      // Delete the sessions list
      await this.redis.del(userSessionsKey);
    }
  }

  async updateSessionToken(
    userId: string,
    sessionId: string,
    newRefreshToken: string
  ): Promise<void> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    const sessionData = await this.redis.get(sessionKey);

    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.refreshToken = newRefreshToken;

      // Get remaining TTL
      const ttl = await this.redis.ttl(sessionKey);

      // Update session with same TTL
      await this.redis.set(sessionKey, JSON.stringify(session), { EX: ttl });
    }
  }

  async getAllSessions(userId: string): Promise<ISessionData[]> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    const sessionListJson = await this.redis.get(userSessionsKey);

    if (!sessionListJson) return [];

    const sessionList = JSON.parse(sessionListJson);
    const sessions: ISessionData[] = [];

    for (const sessionInfo of sessionList) {
      const session = await this.getSession(userId, sessionInfo.sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async cleanupExpiredSessions(): Promise<void> {
    // Redis automatically handles cleanup via TTL
    // This method is a no-op for Redis
  }
}
