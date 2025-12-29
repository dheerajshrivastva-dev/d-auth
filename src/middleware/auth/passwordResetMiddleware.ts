import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { BaseAuthMiddleware } from "../BaseAuthMiddleware";
import userValidations from "../../validations/userValidatons";
import { HTTPResponse, HttpStatus } from "../../httpResponse";
import { requestOtp, validateOTP, requestNewOtp, IOtpResponse } from "../../services/otpService";
import { OTPType } from "../../models/OTP";

/**
 * Password Reset Middleware
 * Refactored from forgetPasswordControlled.ts
 *
 * Changes from v3:
 * - User.findOne → database.findUserByEmail
 * - user.save → database.updatePassword
 * - sendEmail → hook call (onOTPGenerated, onPasswordReset)
 */
export class PasswordResetMiddleware extends BaseAuthMiddleware {
  /**
   * Forgot Password - Send OTP
   * Refactored from forgetPasswordControlled.ts:40-101
   */
  forgotPassword = async (req: Request, res: Response) => {
    try {
      // ✅ REUSE: Validation (forgetPasswordControlled.ts:44-53)
      const { error } = userValidations.forgetPasswordValidation.validate(req.body);
      if (error) {
        return res.status(200).send(
          new HTTPResponse({
            statusCode: HttpStatus.WARNING.code,
            httpStatus: HttpStatus.WARNING.status,
            message: error.message,
          })
        );
      }

      const { email } = req.body;

      // 🔄 CHANGE: User.findOne → database.findUserByEmail
      const user = await this.database.findUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // ✅ REUSE: OTP generation (forgetPasswordControlled.ts:60-63)
      const { sessionId, otp, validityMinutes } = (await requestOtp(
        user.id,
        OTPType.ForgetPassword
      )) as IOtpResponse;

      // 🔄 CHANGE: sendEmail → hook call
      await this.hooks.onOTPGenerated?.({
        email: user.email,
        otp,
        userId: user.id,
        otpType: "ForgetPassword",
        sessionId,
        expiresInMinutes: validityMinutes,
      });

      // ✅ REUSE: Set cookie (forgetPasswordControlled.ts:79)
      this.setForgetPassCookie(res, sessionId);

      // ✅ REUSE: Response (forgetPasswordControlled.ts:82-90)
      return res.status(200).send(
        new HTTPResponse({
          statusCode: HttpStatus.OK.code,
          httpStatus: HttpStatus.OK.status,
          message: "OTP sent successfully",
          data: { sessionId },
        })
      );
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).send(
        new HTTPResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR.code,
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR.status,
          message: error instanceof Error ? error.message : "Something went wrong",
        })
      );
    }
  };

  /**
   * Reset Password with OTP
   * Refactored from forgetPasswordControlled.ts:103-170
   */
  resetPassword = async (req: Request, res: Response) => {
    try {
      // ✅ REUSE: Validation (forgetPasswordControlled.ts:107-116)
      const { error, value } = userValidations.resetPasswordValidatins.validate(req.body);
      if (error) {
        return res.status(200).send(
          new HTTPResponse({
            statusCode: HttpStatus.WARNING.code,
            httpStatus: HttpStatus.WARNING.status,
            message: error.message,
          })
        );
      }

      const { email, password, otp } = value;

      // ✅ REUSE: Get sessionId from cookie or body (forgetPasswordControlled.ts:120)
      const requestSessionId = req.cookies.forgetPassSessionId || value.sessionId;

      // 🔄 CHANGE: User.findOne → database.findUserByEmail
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

      // ✅ REUSE: OTP validation (forgetPasswordControlled.ts:133)
      await validateOTP(user.id, requestSessionId, otp, OTPType.ForgetPassword);

      // ✅ REUSE: Password hashing (forgetPasswordControlled.ts:135)
      const hashedPassword = await bcrypt.hash(password, 10);

      // 🔄 CHANGE: user.password = ... user.save() → database.updatePassword
      await this.database.updatePassword(user.id, hashedPassword);

      // 🆕 NEW: Call hook
      const { ip } = this.getClientDetails(req);
      await this.hooks.onPasswordReset?.({
        user: {
          id: user.id,
          email: user.email,
        },
        ip,
      });

      // ✅ REUSE: Clear cookie (forgetPasswordControlled.ts:139)
      this.clearForgetPassCookie(res);

      // ✅ REUSE: Response (forgetPasswordControlled.ts:141-146)
      return res.status(200).send(
        new HTTPResponse({
          statusCode: HttpStatus.OK.code,
          httpStatus: HttpStatus.OK.status,
          message: "Password updated successfully, login with new password",
        })
      );
    } catch (error) {
      if (error instanceof Error) {
        return res.status(200).send(
          new HTTPResponse({
            statusCode: HttpStatus.WARNING.code,
            httpStatus: HttpStatus.WARNING.status,
            message: error.message,
          })
        );
      }
      console.error("Reset password error:", error);
      return res.status(500).send(
        new HTTPResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR.code,
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR.status,
          message: "Something went wrong",
        })
      );
    }
  };

  /**
   * Resend OTP
   * Refactored from forgetPasswordControlled.ts:172-252
   */
  resendOTP = async (req: Request, res: Response) => {
    try {
      // ✅ REUSE: Validation
      const { error } = userValidations.forgetPasswordValidation.validate(req.body);
      if (error) {
        return res.status(200).send(
          new HTTPResponse({
            statusCode: HttpStatus.WARNING.code,
            httpStatus: HttpStatus.WARNING.status,
            message: error.message,
          })
        );
      }

      const { email } = req.body;

      // 🔄 CHANGE: database.findUserByEmail
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

      const requestSessionId = req.cookies.forgetPassSessionId || req.body.sessionId;

      // ✅ REUSE: Request new OTP
      const { sessionId, otp, validityMinutes } = (await requestNewOtp(
        user.id,
        requestSessionId,
        OTPType.ForgetPassword
      )) as IOtpResponse;

      // 🔄 CHANGE: hook call
      await this.hooks.onOTPGenerated?.({
        email: user.email,
        otp,
        userId: user.id,
        otpType: "ForgetPassword",
        sessionId,
        expiresInMinutes: validityMinutes,
      });

      this.setForgetPassCookie(res, sessionId);

      return res.status(200).send(
        new HTTPResponse({
          statusCode: HttpStatus.OK.code,
          httpStatus: HttpStatus.OK.status,
          message: "New OTP sent successfully, check your email",
        })
      );
    } catch (error) {
      if (error instanceof Error) {
        return res.status(200).send(
          new HTTPResponse({
            statusCode: HttpStatus.WARNING.code,
            httpStatus: HttpStatus.WARNING.status,
            message: error.message,
          })
        );
      }
      console.error("Resend OTP error:", error);
      return res.status(500).send(
        new HTTPResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR.code,
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR.status,
          message: "Something went wrong",
        })
      );
    }
  };
}
