import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { BaseAuthMiddleware } from "../BaseAuthMiddleware";
import { HTTPResponse, HttpStatus } from "../../httpResponse";

/**
 * Admin Create User Middleware
 *
 * Allows admins to create users with temporary passwords
 * Features:
 * - Generates secure random temporary password
 * - Marks password as temporary (must reset before login)
 * - Sends temporary password via hook
 * - Enforces password reset on first login
 */
export class AdminCreateUserMiddleware extends BaseAuthMiddleware {
  /**
   * Generate a secure random password
   */
  private generateTemporaryPassword(length: number = 12): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";

    // Ensure at least one of each character type
    password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]; // Uppercase
    password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]; // Lowercase
    password += "0123456789"[Math.floor(Math.random() * 10)]; // Number
    password += "!@#$%^&*"[Math.floor(Math.random() * 8)]; // Special char

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      const randomBytes = crypto.randomBytes(1);
      const randomIndex = randomBytes[0] % charset.length;
      password += charset[randomIndex];
    }

    // Shuffle the password
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }

  /**
   * Admin creates a new user with temporary password
   */
  createUser = async (req: Request, res: Response) => {
    try {
      const { email, firstName, lastName, roles } = req.body;

      // Validate required fields
      if (!email) {
        return res.status(400).send(
          new HTTPResponse({
            statusCode: HttpStatus.WARNING.code,
            httpStatus: HttpStatus.WARNING.status,
            message: "Email is required",
          })
        );
      }

      // Check if user already exists
      const existingUser = await this.database.findUserByEmail(email);
      if (existingUser) {
        return res.status(400).send(
          new HTTPResponse({
            statusCode: HttpStatus.WARNING.code,
            httpStatus: HttpStatus.WARNING.status,
            message: "User with this email already exists",
          })
        );
      }

      // Generate temporary password
      const temporaryPassword = this.generateTemporaryPassword(12);

      // Hash the temporary password
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      // Create user with temporary password flag
      const user = await this.database.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        roles: roles || ["user"],
        isVerified: false,
        isTemporaryPassword: true, // Mark as temporary
        mustResetPassword: true, // Force reset on first login
        twoFactorEnabled: false,
      });

      // Call hook to send temporary password email
      await this.hooks.onUserCreatedWithTempPassword?.({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        temporaryPassword,
        email: user.email,
      });

      return res.status(201).send(
        new HTTPResponse({
          statusCode: HttpStatus.OK.code,
          httpStatus: HttpStatus.OK.status,
          message: "User created successfully. Temporary password sent to email.",
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              roles: user.roles,
              mustResetPassword: true,
            },
          },
        })
      );
    } catch (error) {
      console.error("Admin create user error:", error);
      return res.status(500).send(
        new HTTPResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR.code,
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR.status,
          message: error instanceof Error ? error.message : "Failed to create user",
        })
      );
    }
  };

  /**
   * Force password reset for user with temporary password
   * This is called on first login attempt
   */
  forcePasswordReset = async (req: Request, res: Response) => {
    try {
      const { email, temporaryPassword, newPassword } = req.body;

      // Validate input
      if (!email || !temporaryPassword || !newPassword) {
        return res.status(400).send(
          new HTTPResponse({
            statusCode: HttpStatus.WARNING.code,
            httpStatus: HttpStatus.WARNING.status,
            message: "Email, temporary password, and new password are required",
          })
        );
      }

      // Find user
      const user = await this.database.findUserByEmail(email);
      if (!user) {
        return res.status(400).send(
          new HTTPResponse({
            statusCode: HttpStatus.BAD_REQUEST.code,
            httpStatus: HttpStatus.BAD_REQUEST.status,
            message: "User not found",
          })
        );
      }

      // Check if user has temporary password
      if (!user.isTemporaryPassword || !user.mustResetPassword) {
        return res.status(400).send(
          new HTTPResponse({
            statusCode: HttpStatus.BAD_REQUEST.code,
            httpStatus: HttpStatus.BAD_REQUEST.status,
            message: "This user does not have a temporary password",
          })
        );
      }

      // Verify temporary password
      if (!user.password) {
        return res.status(400).send(
          new HTTPResponse({
            statusCode: HttpStatus.BAD_REQUEST.code,
            httpStatus: HttpStatus.BAD_REQUEST.status,
            message: "User password not set",
          })
        );
      }

      const isValidTempPassword = await bcrypt.compare(temporaryPassword, user.password);
      if (!isValidTempPassword) {
        return res.status(401).send(
          new HTTPResponse({
            statusCode: HttpStatus.UN_AUTHORISED.code,
            httpStatus: HttpStatus.UN_AUTHORISED.status,
            message: "Invalid temporary password",
          })
        );
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password and remove temporary flags
      await this.database.updateUser(user.id, {
        password: hashedNewPassword,
        isTemporaryPassword: false,
        mustResetPassword: false,
        isVerified: true, // Auto-verify user after password reset
      });

      // Call hook
      const { ip } = this.getClientDetails(req);
      await this.hooks.onPasswordReset?.({
        user: {
          id: user.id,
          email: user.email,
        },
        ip,
      });

      return res.status(200).send(
        new HTTPResponse({
          statusCode: HttpStatus.OK.code,
          httpStatus: HttpStatus.OK.status,
          message: "Password reset successfully. You can now login with your new password.",
        })
      );
    } catch (error) {
      console.error("Force password reset error:", error);
      return res.status(500).send(
        new HTTPResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR.code,
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR.status,
          message: error instanceof Error ? error.message : "Failed to reset password",
        })
      );
    }
  };
}
