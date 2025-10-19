import { NextFunction, Request, Response } from 'express';
import User, { IUser } from '../models/User';
import bcrypt from 'bcryptjs';
import { extractClientDetails, generateAccessToken, generateRefreshToken, REFRESH_TOKEN_EXP_TIME } from '../utils/generateTokens';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import dotenv from "dotenv";
import passport from 'passport';
import { verifyToken } from '../utils/verifyToken';
import { v4 as uuidv4 } from 'uuid';
import AuthConfig from '../config/authConfig';
import sendEmail from '../services/sendEmail';
import userValidatons from '../validations/userValidatons';
import { HTTPResponse, HttpStatus } from '../httpResponse';

dotenv.config();

const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  const config = AuthConfig.getInstance().cookieOptions;
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: config.httpOnly,
    secure: config.secure,
    sameSite: config.sameSite,
    domain: config.domain,
    path: config.path,
    maxAge: config.maxAge,
  });
};

const clearRefreshTokenCookie = (res: Response) => {
  const config = AuthConfig.getInstance().cookieOptions;

  res.clearCookie('refreshToken', {
    domain: config.domain,
    path: config.path,
  });
};


interface handleTokenReturnType {
  accessToken: string;
  sessionId: string;
  refreshToken: string;
}
const generateTokensByUserId = (userId: string): handleTokenReturnType => {
  // Generate unique sessionId for this session
  const sessionId = uuidv4();

  const accessToken = generateAccessToken(userId, sessionId);
  const refreshToken = generateRefreshToken(userId, sessionId);

  return {sessionId, refreshToken, accessToken};
}

export default {
  register: async (req: Request, res: Response) => {
    try {
      const { error, value } = userValidatons.registerUserValidation.validate(req.body);
      if (error) {
        return res.status(200).send(
          new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: error.message})
        );
      }
      const { email, password } = value;
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        ...req.body,
        password: hashedPassword,
      });
      // Generate the tokens
      const { sessionId, accessToken, refreshToken } = generateTokensByUserId(user.id);
      // Extract client details
      const { ip, deviceName } = extractClientDetails(req);
      await user.addSession(refreshToken, sessionId, ip, deviceName);
      // Send refresh token as an HTTP-only cookie
      setRefreshTokenCookie(res, refreshToken);
      // Return user and tokens
      res.status(201).json({ message: 'registration successful', user: {id: user.id, email: user.email, accessToken }});
    } catch (error) {
      console.debug(error);
      res.status(500).json({ error: JSON.stringify(error) });
    }
  },
  
  login: (req: Request, res: Response, next: NextFunction) => {
    const { error } = userValidatons.loginValidation.validate(req.body);
    if (error) {
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: error.message})
      );
    }
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        return res.status(401).json({ message: info ? info.message : 'Incorrect email or password.' });
      }
      if (!user) {
        return res.status(401).json({ message: info ? info.message : 'No user found with the provided credentials. Please create register' });
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.status(200).json({ message: 'Login successful', user });
      })
    })(req, res, next);
  },
  
  googleLoginCallback: async (req: Request, res: Response) => {
    // Handle redirect URL from state parameter
    let redirectUrl = process.env.SOCIAL_LOGIN_SUCCESS_URL!;

    if (req.query.state) {
      try {
        const stateData = JSON.parse(Buffer.from(req.query.state as string, 'base64').toString());
        redirectUrl = stateData.redirectUrl || redirectUrl;
      } catch (error) {
        console.error("Error decoding state parameter:", error);
      }
    }

    return res.redirect(redirectUrl);
  },
  
  facebookLoginCallback: async (req: Request, res: Response) => {
    let redirectUrl = process.env.SOCIAL_LOGIN_SUCCESS_URL!;

    if (req.query.state) {
      try {
        const stateData = JSON.parse(Buffer.from(req.query.state as string, 'base64').toString());
        redirectUrl = stateData.redirectUrl || redirectUrl;
      } catch (error) {
        console.error("Error decoding state parameter:", error);
      }
    }
    return res.redirect(redirectUrl);
  },
  
  logout: async (req: Request, res: Response) => {
    // Extract refreshToken from cookies
    const refreshToken = req.cookies.refreshToken;
  
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }
  
    try {
      // Verify the refresh token to get the session details (sessionId, userId, etc.)
      const decoded = verifyToken(refreshToken);
  
      // Find the user based on the decoded userId
      const user = await User.findOne({ _id: decoded.id });
      if (!user) {
        return res.status(403).json({ message: 'Invalid refresh token' });
      }
  
      // Remove only the session matching the current sessionId
      user.tokens = user.tokens.filter(
        (tokenObj: IUser['tokens'][0]) => tokenObj.sessionId !== decoded.sessionId
      );
  
      // Save the updated user data
      await user.save();
  
      // Clear the refreshToken cookie
      clearRefreshTokenCookie(res)
  
      // Logout from Passport (if using Passport.js)
      req.logout((err) => {
        if (err) {
          return res.status(500).json({ message: 'Failed to log out' });
        }
      });
  
      return res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ message: 'Error during logout' });
    }
  },
  
  refresh: async (req: Request, res: Response) => {
    const refreshToken = req?.cookies?.refreshToken;
    const forwarded = req.headers['x-forwarded-for'] as string;
    const ip = req.ip;
    console.debug('refresh', ip, forwarded);
    if (!refreshToken) {
      return res.status(403).json({ message: 'Refresh token is required' });
    }
  
    try {
      // Verify the refresh token
      const decoded = verifyToken(refreshToken);
  
      // Find user and match the sessionId from the token
      const user = await User.findOne({
        _id: decoded.id,
        'tokens.refreshToken': refreshToken,
      });
  
      if (!user) {
        return res.status(403).json({ message: 'Invalid refresh token' });
      }
  
      // Find the specific session object based on sessionId
      const sessionToken = await user.getToken(refreshToken);
  
      if (!sessionToken) {
        return res.status(403).json({ message: 'Session not found' });
      }
  
      // Generate new tokens for the session
     
      const newAccessToken = generateAccessToken(user.id, sessionToken.sessionId);
      const newRefreshToken = generateRefreshToken(user.id, sessionToken.sessionId);
  
      // Update tokens in the session object
      sessionToken.refreshToken = newRefreshToken;
  
      await user.save();
  
      // Send refresh token as an HTTP-only cookie
      setRefreshTokenCookie(res, newRefreshToken);
  
      return res.json({ user: {id: user.id, email: user.email, accessToken: newAccessToken  }});
    } catch (error) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }
  },
}
