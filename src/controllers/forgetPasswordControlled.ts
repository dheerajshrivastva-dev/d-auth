import { Request, Response } from 'express';
import User from '../models/User';
import bcrypt from 'bcryptjs';

import dotenv from "dotenv";
import AuthConfig from '../config/authConfig';
import sendEmail from '../services/sendEmail';
import { IOtpResponse, requestNewOtp, requestOtp, validateOTP } from '../services/otpService';
import { OTPType } from '../models/OTP';
import { completeOtpEmailTemplate } from '../template/email/otpEmailTemplate';
import userValidatons from '../validations/userValidatons';
import { HTTPResponse, HttpStatus } from '../httpResponse';
import { TemplateRenderer } from '../services/TemplateRendrer';
import logger from '../utils/logger';
dotenv.config();

const setForgetPassCookie = (res: Response, sessionId: string) => {
  const config = AuthConfig.getInstance().cookieOptions;
  
  res.cookie('forgetPassSessionId', sessionId, {
    httpOnly: config.httpOnly,
    secure: config.secure,
    sameSite: config.sameSite,
    domain: config.domain,
    path: config.path,
    maxAge: config.maxAge,
  });
};

const clearForgetPassCookie = (res: Response) => {
  const config = AuthConfig.getInstance().cookieOptions;

  res.clearCookie('forgetPassSessionId', {
    domain: config.domain,
    path: config.path,
  });
};

export default {
  forgotPassword: async (req: Request, res: Response) => {
    const body = req.body;
    
    try {
      const { error } = userValidatons.forgetPasswordValidation.validate(body);
      if (error) {
        return res.status(200).send(
          new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: error.message})
        )
      }
      const { email } = body;
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const { sessionId, otp, validityMinutes } = await requestOtp(user.id, OTPType.ForgetPassword) as IOtpResponse;

      const renderer = new TemplateRenderer(completeOtpEmailTemplate);
      const otpEmailTemplateHtml = renderer.render({
        userName: [user.firstName, user?.middleName, user.lastName].filter(Boolean).join(' '),
        OTP: otp,
        validityMinutes: String(validityMinutes),
      });

      // Send email
      await sendEmail({
        to: email,
        subject: completeOtpEmailTemplate.subject,
        text: `${otp} This OTP is valid for the next 10 minutes. Please do not share it with anyone.`,
        html: otpEmailTemplateHtml
      });
      setForgetPassCookie(res, sessionId);

      logger.info(`OTP sent to ${email}, ${sessionId}`);
  
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.OK.code, httpStatus: HttpStatus.OK.status, message: 'Otp sent successfully', data: { sessionId }})
      )
    } catch (error) {
      return res.status(500).send(
        new HTTPResponse({statusCode: HttpStatus.INTERNAL_SERVER_ERROR.code, httpStatus: HttpStatus.INTERNAL_SERVER_ERROR.status, message: JSON.stringify(error) || "Something went wrong"})
      )
    }
  },

  resetPassword: async (req: Request, res: Response) => {
    const body = req.body;
  
    try {
      const { error, value } = userValidatons.resetPasswordValidatins.validate(body);
      if (error) {
        return res.status(200).send(
          new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: error.message})
        )
      }
  
      const { email, password, otp } = value;

      const requestSessionId = req.cookies.forgetPassSessionId || value.sessionId;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).send(
          new HTTPResponse({statusCode: HttpStatus.BAD_REQUEST.code, httpStatus: HttpStatus.BAD_REQUEST.status, message: 'User not found'})
        )
      }

      await validateOTP(user.id, requestSessionId, otp, OTPType.ForgetPassword);
  
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
      await user.save();

      clearForgetPassCookie(res);

      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.OK.code, httpStatus: HttpStatus.OK.status, message: 'Password updated successfully, login with new password'})
      )
  
    } catch (error) {
      if (error instanceof Error) {
        return res.status(200).send(
          new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: error.message})
        )
      }
      logger.log({
        level: 'error',
        message: JSON.stringify(error),
      })
      return res.status(500).send(
        new HTTPResponse({statusCode: HttpStatus.INTERNAL_SERVER_ERROR.code, httpStatus: HttpStatus.INTERNAL_SERVER_ERROR.status, message: 'Something went wrong',})
      )
    }
  },

  resendOtpForForgetPassowrd: async (req: Request, res: Response) => {
    const body = req.body;
  
    try {
      const { error } = userValidatons.forgetPasswordValidation.validate(body);
      if (error) {
        return res.status(200).send(
          new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: error.message})
        )
      }
  
      const { email } = body;
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).send(
          new HTTPResponse({statusCode: HttpStatus.BAD_REQUEST.code, httpStatus: HttpStatus.BAD_REQUEST.status, message: 'User not found'})
        )
      }

      const requestSessionId = req.cookies.forgetPassSessionId || body.sessionId;
  
      const { sessionId, otp, validityMinutes } = await requestNewOtp(user.id, requestSessionId, OTPType.ForgetPassword) as IOtpResponse;
  
      const renderer = new TemplateRenderer(completeOtpEmailTemplate);
      const otpEmailTemplateHtml = renderer.render({
        userName: [user.firstName, user?.middleName, user.lastName].filter(Boolean).join(' '),
        OTP: sessionId,
      });

      // Send email
      await sendEmail({
        to: email,
        subject: completeOtpEmailTemplate.subject,
        text: `${otp} This is New OTP, valid for the next ${validityMinutes} minutes. Please do not share it with anyone.`,
        html: otpEmailTemplateHtml
      });
  
      setForgetPassCookie(res, sessionId);

      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.OK.code, httpStatus: HttpStatus.OK.status, message: 'Rest Otp sent successfully, check your email'})
      )

    } catch (error) {
      if (error instanceof Error) {
        return res.status(200).send(
          new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: error.message})
        )
      }
      logger.log({
        level: 'error',
        message: JSON.stringify(error),
      })
      return res.status(500).send(
        new HTTPResponse({statusCode: HttpStatus.INTERNAL_SERVER_ERROR.code, httpStatus: HttpStatus.INTERNAL_SERVER_ERROR.status, message: 'Something went wrong',})
      )
    }
  }
}
