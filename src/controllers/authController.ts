import { NextFunction, Request, Response } from 'express';
import User, { IUser } from '../models/User';
import bcrypt from 'bcryptjs';
import { extractClientDetails, generateAccessToken, generateRefreshToken, REFRESH_TOKEN_EXP_TIME } from '../utils/generateTokens';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail';

import dotenv from "dotenv";
import passport from 'passport';
import { verifyToken } from '../utils/verifyToken';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const handleRegister = async (req: Request, res: Response) => {
  const { email, password } = req.body;

}

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

export const register = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashedPassword,
    });

    // Generate the tokens
    const { sessionId, accessToken, refreshToken } = generateTokensByUserId(user.id);

    // Extract client details
    const { ip, deviceName } = extractClientDetails(req);

    await user.addSession(refreshToken, sessionId, ip, deviceName);

    // Send refresh token as an HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, // Prevents client-side JS from accessing the cookie
      secure: process.env.NODE_ENV === 'production', // Sends only over HTTPS
      sameSite: 'strict', // Helps mitigate CSRF attacks
      maxAge: REFRESH_TOKEN_EXP_TIME
    });

    // Return user and tokens
    res.status(201).json({ message: 'registration successful', user: {id: user.id, email: user.email, accessToken }});
  } catch (error) {
    console.debug(error);
    res.status(500).json({ error: JSON.stringify(error) });
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  // handled by Passport LocalStrategy
  passport.authenticate('local', { session: false }, async (err: any, user: {email: string, password: string}, info: any) => {
    if (!user?.email || !user?.password) {
      return res.status(400).json({ message: info ? info.message : 'Incorrect email or password.' });
    }

    const existingUser = await User.findOne({ email: user.email });
  
    // If the user does not exist
    if (!existingUser) {
      return res.status(400).json({ message: 'Incorrect email or password.'});
    }

    // Check if the password matches
    if (!existingUser.password) {
      return res.status(400).json({ message: 'Please forget your password.' });
    }

    const isMatch = await bcrypt.compare(user.password, existingUser.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect email or password.' });
    }

    const { sessionId, accessToken, refreshToken } = generateTokensByUserId(existingUser.id);

    // Extract client details
    const { ip, deviceName } = extractClientDetails(req);

    await existingUser.addSession(refreshToken, sessionId, ip, deviceName);
    // Send refresh token as an HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, // Prevents client-side JS from accessing the cookie
      secure: process.env.NODE_ENV === 'production', // Sends only over HTTPS
      sameSite: 'strict', // Helps mitigate CSRF attacks
      maxAge: REFRESH_TOKEN_EXP_TIME
    });

    // Return user and tokens
    return res.status(200).json({ message: 'Login successful', user: {id: existingUser.id, email: existingUser.email, accessToken }});

  })(req, res, next);
};

export const googleLoginCallback = async (req: Request, res: Response) => {
  const user = req.user as {googleId: string, email: string};
  let existingUser = await User.findOne({ googleId: user?.googleId });

  if (!existingUser) {
    existingUser = await User.create({
      email: user?.email,
      googleId: user?.googleId,
    });
  }
  const { sessionId, accessToken, refreshToken } = generateTokensByUserId(existingUser.id);

  // Extract client details
  const { ip, deviceName } = extractClientDetails(req);

  await existingUser.addSession(refreshToken, sessionId, ip, deviceName);
  // Send refresh token as an HTTP-only cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true, // Prevents client-side JS from accessing the cookie
    secure: process.env.NODE_ENV === 'production', // Sends only over HTTPS
    sameSite: 'strict', // Helps mitigate CSRF attacks
    maxAge: REFRESH_TOKEN_EXP_TIME
  });

  return res.status(200).json({ message: 'Login successful', user: {id: existingUser.id, email: existingUser.email, accessToken }});
}

export const facebookLoginCallback = async (req: Request, res: Response) => {
  const user = req.user as {facebookId: string, email: string};
  let existingUser = await User.findOne({ googleId: user?.facebookId });

  if (!existingUser) {
    existingUser = await User.create({
      email: user?.email,
      facebookId: user?.facebookId,
    });
  }
  const { sessionId, accessToken, refreshToken } = generateTokensByUserId(existingUser.id);

  // Extract client details
  const { ip, deviceName } = extractClientDetails(req);

  await existingUser.addSession(refreshToken, sessionId, ip, deviceName);
  // Send refresh token as an HTTP-only cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true, // Prevents client-side JS from accessing the cookie
    secure: process.env.NODE_ENV === 'production', // Sends only over HTTPS
    sameSite: 'strict', // Helps mitigate CSRF attacks
    maxAge: REFRESH_TOKEN_EXP_TIME
  });

  return res.status(200).json({ message: 'Login successful', user: {id: existingUser.id, email: existingUser.email, accessToken }});
}

export const logout = async (req: Request, res: Response) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ message: 'Access token is required' });
  }

  try {
    const decoded = verifyToken(accessToken);

    // Find user and remove only the session matching the current sessionId
    const user = await User.findOne({ _id: decoded.id });
    if (!user) {
      return res.status(403).json({ message: 'Invalid access token' });
    }

    user.tokens = user.tokens.filter((tokenObj: IUser['tokens'][0]) => tokenObj.sessionId !== decoded.sessionId);

    await user.save();

    // Clear cookies
    res.clearCookie('refreshToken');

    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to log out' });
      }
    });

    return res.json({ message: 'Logout successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Error during logout' });
  }

};

export const refresh = async (req: Request, res: Response) => {
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
    const sessionToken = user.tokens.find((tokenObj: IUser['tokens'][0]) => tokenObj.refreshToken === refreshToken);

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
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true, // Prevents client-side JS from accessing the cookie
      secure: process.env.NODE_ENV === 'production', // Sends only over HTTPS
      sameSite: 'strict', // Helps mitigate CSRF attacks
      maxAge: REFRESH_TOKEN_EXP_TIME
    });

    return res.json({ user: {id: user.id, email: user.email, accessToken: newAccessToken  }});
  } catch (error) {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }
};

// Add other routes like forgot password here...

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;

    // Send email
    await sendEmail(email, 'Password Reset', `Reset your password here: ${resetPasswordUrl}`);

    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Error sending password reset email' });
  }
};
