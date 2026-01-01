import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { BaseAuthMiddleware } from "../BaseAuthMiddleware";
import userValidations from "../../validations/userValidatons";
import { HTTPResponse, HttpStatus } from "../../httpResponse";

/**
 * Login Middleware
 * Refactored from authController.ts:98-129
 *
 * Supports both strategies:
 * - JWT: Stateless token-based authentication
 * - Session: Passport.js session-based authentication
 *
 * Changes from v3:
 * - User.findOne → database.findUserByEmail
 * - user.addSession → database.addSession
 * - Added 2FA support
 * - Added hook call: onUserLogin
 * - Added token mode support
 */
export class LoginMiddleware extends BaseAuthMiddleware {
  /**
   * JWT-based login
   * Refactored from authController.ts:98-129 with JWT logic
   */
  private loginWithJWT = async (req: Request, res: Response) => {
    try {
      // ✅ REUSE: Validation from v3 (authController.ts:99-108)
      const { error } = userValidations.loginValidation.validate(req.body);
      if (error) {
        return res.status(200).send(
          new HTTPResponse({
            statusCode: HttpStatus.WARNING.code,
            httpStatus: HttpStatus.WARNING.status,
            message: error.message,
          })
        );
      }

      const { email, password } = req.body;

      // 🔄 CHANGE: User.findOne → database.findUserByEmail
      const user = await this.database.findUserByEmail(email);

      if (!user || !user.password) {
        return res.status(401).json({
          message: "Incorrect email or password.",
        });
      }

      // 🆕 NEW: Check if account is locked
      const isLocked = await this.database.isAccountLocked(user.id);
      if (isLocked) {
        return res.status(403).json({
          message:
            "Account is temporarily locked due to multiple failed login attempts. Please try again later or reset your password.",
        });
      }

      // 🆕 NEW: Check if password must be reset (temporary password)
      if (user.mustResetPassword || user.isTemporaryPassword) {
        return res.status(403).json({
          message:
            "You must reset your password before logging in. Please use the force password reset endpoint.",
          requiresPasswordReset: true,
        });
      }

      // ✅ REUSE: Password verification using bcrypt
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        // 🆕 NEW: Increment failed login attempts (v4.0.0)
        if (this.accountSecurity.enableAccountLockout) {
          const failedAttempts = await this.database.incrementFailedLoginAttempts(user.id);

          // Lock account after configured number of failed attempts
          const maxAttempts = this.accountSecurity.maxFailedLoginAttempts!;
          if (failedAttempts >= maxAttempts) {
            const lockoutMinutes = this.accountSecurity.lockoutDurationMinutes!;
            const lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
            await this.database.lockAccount(user.id, lockUntil);

            // Call hook
            await this.hooks.onAccountLocked?.({
              user: {
                id: user.id,
                email: user.email,
              },
              failedAttempts,
              lockedUntil: lockUntil,
            });

            return res.status(403).json({
              message: `Account locked due to multiple failed login attempts. Your account will be unlocked in ${lockoutMinutes} minutes or you can reset your password.`,
            });
          }

          return res.status(401).json({
            message: "Incorrect email or password.",
            attemptsRemaining: maxAttempts - failedAttempts,
          });
        }

        // If account lockout is disabled, just return error
        return res.status(401).json({
          message: "Incorrect email or password.",
        });
      }

      // 🆕 NEW: Reset failed login attempts on successful password verification
      await this.database.resetFailedLoginAttempts(user.id);

      // 🆕 NEW: Check 2FA
      if (user.twoFactorEnabled) {
        // Generate temporary token for 2FA verification
        const tempToken = this.generateTokens(user.id).accessToken;
        return res.json({
          requires2FA: true,
          tempToken,
        });
      }

      // ✅ REUSE: Generate tokens from v3
      const { sessionId, accessToken, refreshToken } = this.generateTokens(user.id);

      // ✅ REUSE: Extract client details from v3
      const { ip, deviceName } = this.getClientDetails(req);

      // 🔄 CHANGE: user.addSession → sessionStore.addSession (with FIFO)
      await this.sessionStore.addSession(
        {
          sessionId,
          userId: user.id,
          refreshToken,
          ip,
          deviceName,
          createdAt: new Date(),
          expiresAt: this.getSessionExpiry(),
        },
        this.maxSessionsPerUser
      );

      // 🆕 NEW: Call hook
      await this.hooks.onUserLogin?.({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        ip,
        deviceName,
      });

      // ✅ REUSE: Set cookies
      this.setTokenCookies(res, { accessToken, refreshToken });

      // ✅ REUSE: Response format
      const tokenResponse = this.formatTokenResponse(
        { accessToken, refreshToken },
        {
          id: user.id,
          email: user.email,
          roles: user.roles,
        }
      );

      return res.status(200).json({
        message: "Login successful",
        ...tokenResponse,
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  /**
   * Session-based login using Passport.js
   * ✅ REUSE: Complete logic from authController.ts:98-129
   */
  private loginWithSession = (req: Request, res: Response, next: NextFunction) => {
    // ✅ REUSE: Validation from v3
    const { error } = userValidations.loginValidation.validate(req.body);
    if (error) {
      return res.status(200).send(
        new HTTPResponse({
          statusCode: HttpStatus.WARNING.code,
          httpStatus: HttpStatus.WARNING.status,
          message: error.message,
        })
      );
    }

    // ✅ REUSE: Passport authentication from authController.ts:109-128
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        return res.status(401).json({
          message: info ? info.message : "Incorrect email or password.",
        });
      }

      if (!user) {
        return res.status(401).json({
          message: info
            ? info.message
            : "No user found with the provided credentials. Please register.",
        });
      }

      // Passport.js session establishment
      req.logIn(user, async (err) => {
        if (err) {
          return next(err);
        }

        // 🆕 NEW: Call hook
        const { ip, deviceName } = this.getClientDetails(req);
        await this.hooks.onUserLogin?.({
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          ip,
          deviceName,
        });

        return res.status(200).json({
          message: "Login successful",
          user: {
            id: user.id,
            email: user.email,
            roles: user.roles,
          },
        });
      });
    })(req, res, next);
  };

  /**
   * Main login method - routes to JWT or Session based on strategy
   */
  login = (req: Request, res: Response, next: NextFunction) => {
    // Determine strategy from JWT config presence
    const isJWTMode = !!this.jwtConfig;

    if (isJWTMode) {
      return this.loginWithJWT(req, res);
    } else {
      return this.loginWithSession(req, res, next);
    }
  };
}
