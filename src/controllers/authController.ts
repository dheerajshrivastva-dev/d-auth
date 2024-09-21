import { NextFunction, Request, Response } from 'express';
import User from '../models/User';
import bcrypt from 'bcryptjs';
import { generateAccessToken, generateRefreshToken } from '../utils/generateTokens';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail';

import dotenv from "dotenv";
import passport from 'passport';
import { verifyToken } from '../utils/verifyToken';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

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

    // Generate unique sessionId for this session
    const sessionId = uuidv4();

    const accessToken = generateAccessToken(user.id, sessionId);
    const refreshToken = generateRefreshToken(user.id, sessionId);

    user.tokens.push({ accessToken, refreshToken, sessionId });
    await user.save();

    res.status(201).json({ accessToken, refreshToken });
  } catch (error) {
    console.debug(error);
    res.status(500).json({ error: JSON.stringify(error) });
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  // handled by Passport LocalStrategy
  passport.authenticate('local', { session: false }, (err: any, data: any, info:any) => {
    if (err || !data) {
      return res.status(400).json({
        message: info ? info.message : 'Login failed',
      });
    }

    // On successful authentication, send tokens and user info
    const { accessToken, refreshToken } = data;

    return res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
    });
  })(req, res, next);
};

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

    user.tokens = user.tokens.filter((tokenObj) => tokenObj.sessionId !== decoded.sessionId);

    await user.save();

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
  const { refreshToken } = req.body;

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
    const sessionToken = user.tokens.find((tokenObj) => tokenObj.refreshToken === refreshToken);

    if (!sessionToken) {
      return res.status(403).json({ message: 'Session not found' });
    }

    // Generate new tokens for the session
   
    const newAccessToken = generateAccessToken(user.id, sessionToken.sessionId);
    const newRefreshToken = generateRefreshToken(user.id, sessionToken.sessionId);

    // Update tokens in the session object
    sessionToken.accessToken = newAccessToken;
    sessionToken.refreshToken = newRefreshToken;

    await user.save();

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
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
