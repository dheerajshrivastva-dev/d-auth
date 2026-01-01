import { Request, Response } from "express";
import { BaseAuthMiddleware } from "../BaseAuthMiddleware";

/**
 * Logout Middleware
 * Refactored from authController.ts:161-202
 *
 * Changes from v3:
 * - User.findOne → database.findUserById
 * - Direct token manipulation → sessionStore.removeSession
 * - Added hook call: onUserLogout
 * - Added support for both JWT and Session modes
 */
export class LogoutMiddleware extends BaseAuthMiddleware {
  logout = async (req: Request, res: Response) => {
    const isJWTMode = !!this.jwtConfig;

    if (isJWTMode) {
      return this.logoutWithJWT(req, res);
    } else {
      return this.logoutWithSession(req, res);
    }
  };

  /**
   * JWT-based logout
   * Removes session from store and clears token cookies
   */
  private logoutWithJWT = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    try {
      const decoded = this.verifyJWT(refreshToken);

      const user = await this.database.findUserById(decoded.id);
      if (!user) {
        return res.status(403).json({ message: "Invalid refresh token" });
      }

      await this.sessionStore.removeSession(decoded.id, decoded.sessionId);

      await this.hooks.onUserLogout?.({
        userId: decoded.id,
        sessionId: decoded.sessionId,
      });

      this.clearTokenCookies(res);

      return res.status(200).json({ message: "Logout successful" });
    } catch (error) {
      console.error("Logout error:", error);
      return res.status(500).json({ message: "Error during logout" });
    }
  };

  /**
   * Session-based logout
   * Destroys Passport session
   */
  private logoutWithSession = async (req: Request, res: Response) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(400).json({ message: "Not logged in" });
    }

    const userId = req.user?.id;

    try {
      // Destroy Passport session
      if (req.logout) {
        await new Promise<void>((resolve, reject) => {
          req.logout((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Destroy express-session
      if (req.session) {
        await new Promise<void>((resolve, reject) => {
          req.session.destroy((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      if (userId) {
        await this.hooks.onUserLogout?.({
          userId,
          sessionId: "", // Session mode doesn't track session IDs like JWT mode
        });
      }

      return res.status(200).json({ message: "Logout successful" });
    } catch (error) {
      console.error("Logout error:", error);
      return res.status(500).json({ message: "Error during logout" });
    }
  };
}
