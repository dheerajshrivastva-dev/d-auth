import { Request, Response, NextFunction } from "express";
import passport from "passport";
import { BaseAuthMiddleware } from "../BaseAuthMiddleware";

/**
 * OAuth Authentication Middleware
 * Handles Google, Facebook, and Apple OAuth login/registration
 *
 * Features:
 * - Auto-creates user on first OAuth login
 * - Links OAuth account to existing email
 * - Generates session/JWT tokens
 * - Calls onUserRegistered hook for new users
 * - Validates and handles post-OAuth redirects
 */
export class OAuthMiddleware extends BaseAuthMiddleware {
  /**
   * Validates redirect URL against whitelist
   */
  private validateRedirectUrl(redirectUrl: string): boolean {
    const allowedUrls = this.oauthConfig?.allowedRedirectUrls || [];

    if (allowedUrls.length === 0) {
      return false;
    }

    return allowedUrls.some((allowedUrl: string) => redirectUrl.startsWith(allowedUrl));
  }

  /**
   * Encodes state parameter with redirect URL
   */
  private encodeState(redirectUrl: string): string {
    return Buffer.from(JSON.stringify({ redirectUrl })).toString("base64");
  }

  /**
   * Decodes state parameter to get redirect URL
   */
  private decodeState(state: string): string | null {
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64").toString());
      return decoded.redirectUrl || null;
    } catch {
      return null;
    }
  }

  /**
   * Google OAuth Login
   * Initiates Google OAuth flow with optional redirect URL
   */
  googleAuth = (req: Request, res: Response, next: NextFunction) => {
    const redirectUrl = req.headers.referer as string;

    // If redirect URL is provided, validate and include in state
    if (redirectUrl) {
      const isValid = this.validateRedirectUrl(redirectUrl);

      if (!isValid) {
        return res.status(400).json({
          error: "Invalid redirect URL",
          message: "The provided redirect URL is not in the allowed list",
        });
      }

      const state = this.encodeState(redirectUrl);
      passport.authenticate("google", {
        scope: ["profile", "email"],
        state: state,
      })(req, res, next);
    } else {
      passport.authenticate("google", {
        scope: ["profile", "email"],
      })(req, res, next);
    }
  };

  /**
   * Google OAuth Callback
   * Handles Google OAuth redirect with optional redirect URL
   */
  googleCallback = async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("google", async (err: any, user: any, info: any) => {
      if (err) {
        return res.status(401).json({
          message: info ? info.message : "Google authentication failed",
        });
      }

      if (!user) {
        return res.status(401).json({
          message: info ? info.message : "No user found from Google authentication",
        });
      }

      try {
        // Check if this is a new user (newly created)
        const existingUser = await this.database.findUserByOAuthId("google", user.googleId);
        const isNewUser = !existingUser;

        // Extract redirect URL from state parameter
        const state = req.query.state as string;
        const redirectUrl = state ? this.decodeState(state) : null;

        // If JWT mode, generate tokens
        if (this.jwtConfig) {
          const { sessionId, accessToken, refreshToken } = this.generateTokens(user.id);
          const { ip, deviceName } = this.getClientDetails(req);

          await this.database.addSession(user.id, {
            sessionId,
            refreshToken,
            ip,
            deviceName,
            createdAt: new Date(),
            expiresAt: this.getSessionExpiry(),
          });

          // Call hook for new user
          if (isNewUser) {
            await this.hooks.onUserRegistered?.({
              user,
              isOAuth: true,
              provider: "google",
            });
          }

          // Call login hook
          await this.hooks.onUserLogin?.({
            user,
            ip,
            deviceName,
          });

          this.setTokenCookies(res, { accessToken, refreshToken });

          // If redirect URL exists, redirect to it
          if (redirectUrl) {
            return res.redirect(redirectUrl);
          }

          return res.status(200).json(
            this.formatTokenResponse(
              { accessToken, refreshToken },
              {
                message: isNewUser ? "Registration successful" : "Login successful",
                user,
              }
            )
          );
        } else {
          // Session mode - use Passport session
          req.logIn(user, async (err) => {
            if (err) {
              return next(err);
            }

            if (isNewUser) {
              await this.hooks.onUserRegistered?.({
                user,
                isOAuth: true,
                provider: "google",
              });
            }

            const { ip, deviceName } = this.getClientDetails(req);
            await this.hooks.onUserLogin?.({
              user,
              ip,
              deviceName,
            });

            // If redirect URL exists, redirect to it
            if (redirectUrl) {
              return res.redirect(redirectUrl);
            }

            return res.status(200).json({
              message: isNewUser ? "Registration successful" : "Login successful",
              user,
            });
          });
        }
      } catch (error) {
        console.error("Google callback error:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    })(req, res, next);
  };

  /**
   * Facebook OAuth Login
   * Initiates Facebook OAuth flow with optional redirect URL
   */
  facebookAuth = (req: Request, res: Response, next: NextFunction) => {
    const redirectUrl = req.headers.referer as string;

    // If redirect URL is provided, validate and include in state
    if (redirectUrl) {
      const isValid = this.validateRedirectUrl(redirectUrl);

      if (!isValid) {
        return res.status(400).json({
          error: "Invalid redirect URL",
          message: "The provided redirect URL is not in the allowed list",
        });
      }

      const state = this.encodeState(redirectUrl);
      passport.authenticate("facebook", {
        scope: ["email"],
        state: state,
      })(req, res, next);
    } else {
      passport.authenticate("facebook", {
        scope: ["email"],
      })(req, res, next);
    }
  };

  /**
   * Facebook OAuth Callback
   * Handles Facebook OAuth redirect with optional redirect URL
   */
  facebookCallback = async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("facebook", async (err: any, user: any, info: any) => {
      if (err) {
        return res.status(401).json({
          message: info ? info.message : "Facebook authentication failed",
        });
      }

      if (!user) {
        return res.status(401).json({
          message: info ? info.message : "No user found from Facebook authentication",
        });
      }

      try {
        const existingUser = await this.database.findUserByOAuthId("facebook", user.facebookId);
        const isNewUser = !existingUser;

        // Extract redirect URL from state parameter
        const state = req.query.state as string;
        const redirectUrl = state ? this.decodeState(state) : null;

        if (this.jwtConfig) {
          const { sessionId, accessToken, refreshToken } = this.generateTokens(user.id);
          const { ip, deviceName } = this.getClientDetails(req);

          await this.database.addSession(user.id, {
            sessionId,
            refreshToken,
            ip,
            deviceName,
            createdAt: new Date(),
            expiresAt: this.getSessionExpiry(),
          });

          if (isNewUser) {
            await this.hooks.onUserRegistered?.({
              user,
              isOAuth: true,
              provider: "facebook",
            });
          }

          await this.hooks.onUserLogin?.({
            user,
            ip,
            deviceName,
          });

          this.setTokenCookies(res, { accessToken, refreshToken });

          // If redirect URL exists, redirect to it
          if (redirectUrl) {
            return res.redirect(redirectUrl);
          }

          return res.status(200).json(
            this.formatTokenResponse(
              { accessToken, refreshToken },
              {
                message: isNewUser ? "Registration successful" : "Login successful",
                user,
              }
            )
          );
        } else {
          req.logIn(user, async (err) => {
            if (err) {
              return next(err);
            }

            if (isNewUser) {
              await this.hooks.onUserRegistered?.({
                user,
                isOAuth: true,
                provider: "facebook",
              });
            }

            const { ip, deviceName } = this.getClientDetails(req);
            await this.hooks.onUserLogin?.({
              user,
              ip,
              deviceName,
            });

            // If redirect URL exists, redirect to it
            if (redirectUrl) {
              return res.redirect(redirectUrl);
            }

            return res.status(200).json({
              message: isNewUser ? "Registration successful" : "Login successful",
              user,
            });
          });
        }
      } catch (error) {
        console.error("Facebook callback error:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    })(req, res, next);
  };

  /**
   * Apple OAuth Login
   * Initiates Apple OAuth flow with optional redirect URL
   */
  appleAuth = (req: Request, res: Response, next: NextFunction) => {
    const redirectUrl = req.headers.referer as string;

    // If redirect URL is provided, validate and include in state
    if (redirectUrl) {
      const isValid = this.validateRedirectUrl(redirectUrl);

      if (!isValid) {
        return res.status(400).json({
          error: "Invalid redirect URL",
          message: "The provided redirect URL is not in the allowed list",
        });
      }

      const state = this.encodeState(redirectUrl);
      passport.authenticate("apple", {
        state: state,
      })(req, res, next);
    } else {
      passport.authenticate("apple")(req, res, next);
    }
  };

  /**
   * Apple OAuth Callback
   * Handles Apple OAuth redirect with optional redirect URL
   */
  appleCallback = async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("apple", async (err: any, user: any, info: any) => {
      if (err) {
        return res.status(401).json({
          message: info ? info.message : "Apple authentication failed",
        });
      }

      if (!user) {
        return res.status(401).json({
          message: info ? info.message : "No user found from Apple authentication",
        });
      }

      try {
        const existingUser = await this.database.findUserByOAuthId("apple", user.appleId);
        const isNewUser = !existingUser;

        // Extract redirect URL from state parameter
        const state = req.query.state as string;
        const redirectUrl = state ? this.decodeState(state) : null;

        if (this.jwtConfig) {
          const { sessionId, accessToken, refreshToken } = this.generateTokens(user.id);
          const { ip, deviceName } = this.getClientDetails(req);

          await this.database.addSession(user.id, {
            sessionId,
            refreshToken,
            ip,
            deviceName,
            createdAt: new Date(),
            expiresAt: this.getSessionExpiry(),
          });

          if (isNewUser) {
            await this.hooks.onUserRegistered?.({
              user,
              isOAuth: true,
              provider: "apple",
            });
          }

          await this.hooks.onUserLogin?.({
            user,
            ip,
            deviceName,
          });

          this.setTokenCookies(res, { accessToken, refreshToken });

          // If redirect URL exists, redirect to it
          if (redirectUrl) {
            return res.redirect(redirectUrl);
          }

          return res.status(200).json(
            this.formatTokenResponse(
              { accessToken, refreshToken },
              {
                message: isNewUser ? "Registration successful" : "Login successful",
                user,
              }
            )
          );
        } else {
          req.logIn(user, async (err) => {
            if (err) {
              return next(err);
            }

            if (isNewUser) {
              await this.hooks.onUserRegistered?.({
                user,
                isOAuth: true,
                provider: "apple",
              });
            }

            const { ip, deviceName } = this.getClientDetails(req);
            await this.hooks.onUserLogin?.({
              user,
              ip,
              deviceName,
            });

            // If redirect URL exists, redirect to it
            if (redirectUrl) {
              return res.redirect(redirectUrl);
            }

            return res.status(200).json({
              message: isNewUser ? "Registration successful" : "Login successful",
              user,
            });
          });
        }
      } catch (error) {
        console.error("Apple callback error:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    })(req, res, next);
  };
}
