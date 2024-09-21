import { Request, Response, NextFunction, Express } from 'express';
import express from 'express';
import session from 'express-session';
import jwt from 'jsonwebtoken';

import { AuthOptions, passportConfig } from '../passport/passportConfig';
import passport from 'passport';
import authRoutes from '../routes/authRoutes';
import mongoose from 'mongoose';

import dotenv from "dotenv";

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


export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
      if (err) {
        return res.sendStatus(403); // Forbidden
      }

      (req as any).user = user;
      next();
    });
  } else {
    res.sendStatus(401); // Unauthorized
  }
};
