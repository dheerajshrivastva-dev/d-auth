import { Request, Response } from "express";
import { BaseAuthMiddleware } from "../BaseAuthMiddleware";

/**
 * Logout Middleware
 * Refactored from authController.ts:161-202
 *
 * Changes from v3:
 * - User.findOne → database.findUserById
 * - Direct token manipulation → database.removeSession
 * - Added hook call: onUserLogout
 */
export class LogoutMiddleware extends BaseAuthMiddleware {
  logout = async (req: Request, res: Response) => {
    // ✅ REUSE: Extract token from cookies (authController.ts:162-167)
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    try {
      // ✅ REUSE: Verify token (authController.ts:171)
      const decoded = this.verifyJWT(refreshToken);

      // 🔄 CHANGE: User.findOne → database.findUserById
      const user = await this.database.findUserById(decoded.id);
      if (!user) {
        return res.status(403).json({ message: "Invalid refresh token" });
      }

      // 🔄 CHANGE: Token array manipulation → database.removeSession
      await this.database.removeSession(decoded.id, decoded.sessionId);

      // 🆕 NEW: Call hook
      await this.hooks.onUserLogout?.({
        userId: decoded.id,
        sessionId: decoded.sessionId,
      });

      // ✅ REUSE: Clear cookies (authController.ts:188)
      this.clearTokenCookies(res);

      // ✅ REUSE: Passport logout (authController.ts:191-196)
      if (req.logout) {
        req.logout((err) => {
          if (err) {
            console.error("Passport logout error:", err);
          }
        });
      }

      // ✅ REUSE: Response (authController.ts:197)
      return res.status(200).json({ message: "Logout successful" });
    } catch (error) {
      console.error("Logout error:", error);
      return res.status(500).json({ message: "Error during logout" });
    }
  };
}
