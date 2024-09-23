import { Request, Response, NextFunction, Express } from 'express';
import express from 'express';
import session from 'express-session';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User from '../models/User';

import { AuthOptions, passportConfig } from '../passport/passportConfig';
import passport from 'passport';
import authRoutes from '../routes/authRoutes';
import mongoose from 'mongoose';

import dotenv from "dotenv";
import { verifyToken } from '../utils/verifyToken';
import cookieParser from 'cookie-parser';

dotenv.config();

interface DAuthOptions extends AuthOptions {
  sessionSecret: string;
  mongoDbUri: string;
}

export function dAuthMiddleware(app: Express, options: DAuthOptions) {

  // MongoDB connection
  mongoose.connect(options.mongoDbUri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

  // Middleware
  app.use(express.json());
  app.use(cookieParser());
  app.use(session({ secret: options.sessionSecret!, resave: false, saveUninitialized: true }));
  // Initialize Passport with the configuration
  passportConfig(options);

  // Initialize Passport and session management middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Attach auth routes here (e.g., /auth/login, /auth/register)
  app.use('/auth', authRoutes);

  // Error handling and other middleware logic can go here
}

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Skip /api/public/* routes
  if (req.path.startsWith('/api/public')) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization token is missing' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Require access token to use this api' });
  }

  try {
    // Verify the access token
    const decoded: JwtPayload = verifyToken(token);
    // Fetch the user based on the decoded token (userId)
    const user = await User.findById(decoded?.id);

    if (!user) {
      return res.status(403).json({ message: 'Invalid access token' });
    }

    // Attach user to the request
    req.user = user;

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};
