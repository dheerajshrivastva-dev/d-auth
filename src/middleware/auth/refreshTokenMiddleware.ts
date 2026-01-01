import { Request, Response } from "express";
import { BaseAuthMiddleware } from "../BaseAuthMiddleware";
import { generateAccessToken, generateRefreshToken } from "../../utils/generateTokens";

/**
 * Refresh Token Middleware
 * Refactored from authController.ts:204-251
 *
 * Changes from v3:
 * - User.findOne → database.findUserById + getSession
 * - user.getToken → database.getSession
 * - Token update → database.updateSessionToken
 */
export class RefreshTokenMiddleware extends BaseAuthMiddleware {
  refresh = async (req: Request, res: Response) => {
    // ✅ REUSE: Extract token from cookies (authController.ts:205)
    const refreshToken = req?.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(403).json({ message: "Refresh token is required" });
    }

    try {
      // ✅ REUSE: Verify token (authController.ts:215)
      const decoded = this.verifyJWT(refreshToken);

      // 🔄 CHANGE: User.findOne → database.findUserById
      const user = await this.database.findUserById(decoded.id);

      if (!user) {
        return res.status(403).json({ message: "Invalid refresh token" });
      }

      // 🔄 CHANGE: user.getToken → sessionStore.getSession
      const session = await this.sessionStore.getSession(decoded.id, decoded.sessionId);

      if (!session) {
        return res.status(403).json({ message: "Session not found" });
      }

      // ✅ REUSE: Check expiry
      const now = new Date();
      if (now > session.expiresAt) {
        // Session expired, remove it
        await this.sessionStore.removeSession(decoded.id, decoded.sessionId);
        return res.status(403).json({ message: "Session expired" });
      }

      // ✅ REUSE: Generate new tokens (authController.ts:236-237)
      const newAccessToken = generateAccessToken(user.id, session.sessionId);
      const newRefreshToken = generateRefreshToken(user.id, session.sessionId);

      // 🔄 CHANGE: Direct token update → sessionStore.updateSessionToken
      await this.sessionStore.updateSessionToken(user.id, session.sessionId, newRefreshToken);

      // ✅ REUSE: Set cookies (authController.ts:245)
      this.setTokenCookies(res, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });

      // ✅ REUSE: Response (authController.ts:247)
      return res.json(
        this.formatTokenResponse(
          { accessToken: newAccessToken, refreshToken: newRefreshToken },
          {
            id: user.id,
            email: user.email,
            roles: user.roles,
          }
        )
      );
    } catch (error) {
      console.error("Refresh token error:", error);
      return res.status(403).json({ message: "Invalid refresh token" });
    }
  };
}
