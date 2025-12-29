import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { BaseAuthMiddleware } from "../BaseAuthMiddleware";
import userValidations from "../../validations/userValidatons";
import { HTTPResponse, HttpStatus } from "../../httpResponse";

/**
 * Register Middleware
 * Refactored from authController.ts:58-96
 *
 * Changes from v3:
 * - User.findOne → database.findUserByEmail
 * - User.create → database.createUser
 * - user.addSession → database.addSession
 * - Added hook call: onUserRegistered
 * - Added token mode support (cookie/response/both)
 */
export class RegisterMiddleware extends BaseAuthMiddleware {
  register = async (req: Request, res: Response) => {
    try {
      // ✅ REUSE: Validation from v3 (authController.ts:60-69)
      const { error, value } = userValidations.registerUserValidation.validate(req.body);
      if (error) {
        return res.status(200).send(
          new HTTPResponse({
            statusCode: HttpStatus.WARNING.code,
            httpStatus: HttpStatus.WARNING.status,
            message: error.message,
          })
        );
      }

      const { email, password } = value;

      // 🔄 CHANGE: User.findOne → database.findUserByEmail
      const existingUser = await this.database.findUserByEmail(email);
      if (existingUser) {
        return res.status(200).send(
          new HTTPResponse({
            statusCode: HttpStatus.BAD_REQUEST.code,
            httpStatus: HttpStatus.BAD_REQUEST.status,
            message: "User with this email already exists",
          })
        );
      }

      // ✅ REUSE: Password hashing from v3 (authController.ts:75)
      const hashedPassword = await bcrypt.hash(password, 10);

      // 🔄 CHANGE: User.create → database.createUser
      const user = await this.database.createUser({
        ...req.body,
        password: hashedPassword,
        roles: req.body.roles || ["user"],
        isVerified: false,
      });

      // ✅ REUSE: Token generation from v3 (authController.ts:81)
      const { sessionId, accessToken, refreshToken } = this.generateTokens(user.id);

      // ✅ REUSE: Extract client details from v3 (authController.ts:83)
      const { ip, deviceName } = this.getClientDetails(req);

      // 🔄 CHANGE: user.addSession → database.addSession
      await this.database.addSession(user.id, {
        sessionId,
        refreshToken,
        ip,
        deviceName,
        createdAt: new Date(),
        expiresAt: this.getSessionExpiry(),
      });

      // 🆕 NEW: Call hook for email notification
      await this.hooks.onUserRegistered?.({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        isOAuth: false,
      });

      // ✅ REUSE: Set cookies from v3 (authController.ts:86)
      this.setTokenCookies(res, { accessToken, refreshToken });

      // ✅ REUSE: Response format from v3 (authController.ts:88-91)
      // Enhanced with token mode support
      const tokenResponse = this.formatTokenResponse(
        { accessToken, refreshToken },
        {
          id: user.id,
          email: user.email,
          roles: user.roles,
        }
      );

      return res.status(201).json({
        message: "Registration successful",
        ...tokenResponse,
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  };
}
