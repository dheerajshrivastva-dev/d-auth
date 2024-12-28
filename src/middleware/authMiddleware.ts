import express, { Request, Response, NextFunction, Express } from 'express';
import session, { SessionOptions } from 'express-session';
import { JwtPayload } from 'jsonwebtoken';
import User from '../models/User';

import { AuthOptions, passportConfig } from '../passport/passportConfig';
import passport from 'passport';
import authRoutes from '../routes/authRoutes';
import mongoose from 'mongoose';

import dotenv from "dotenv";
import { verifyToken } from '../utils/verifyToken';
import AuthConfig, { CookieOptions, NodeMailerConfig, CompanyDetails } from '../config/authConfig';
import { REFRESH_TOKEN_EXP_TIME } from '../utils/generateTokens';

import cookieParser from "cookie-parser";
import cors from "cors";
import MongoStore from 'connect-mongo';
import rateLimit, { Options } from 'express-rate-limit';
import { HTTPResponse, HttpStatus } from '../httpResponse';

dotenv.config();

export interface DAuthOptions extends AuthOptions {
  sessionSecret: string;
  mongoDbUri: string;
  nodeMailerConfig: NodeMailerConfig;
  companyDetails: CompanyDetails;
  authRouteinitials?: string;
  cookieOptions?: CookieOptions;
  sessionOptions?: SessionOptions;
  rateLimitOptions?: Partial<Options>;
  corsOptions?: cors.CorsOptions;
}

/**
 * Configures and initializes authentication middleware for the Express application.
 *
 * @param {Express} app - The Express application instance.
 * @param {DAuthOptions} options - Options for authentication configuration.
 * @return {void}
 *
 * @example
 * // Initialize Express app and configure dAuth middleware
 * import express, { Express } from "express";
 * import { dAuthMiddleware } from "./middleware/authMiddleware";
 * import dotenv from "dotenv";
 *
 * dotenv.config();
 * const app: Express = express();
 * const port = process.env.PORT || 3000;
 *
 * dAuthMiddleware(app, {
 *   mongoDbUri: process.env.MONGO_URI!,
 *   sessionSecret: process.env.SESSION_SECRET!,
 *   googleClientId: process.env.GOOGLE_CLIENT_ID! || "",
 *   googleClientSecret: process.env.GOOGLE_CLIENT_SECRET! || "",
 *   googleCallbackURL: process.env.GOOGLE_CALLBACK_URL! || "",
 *   facebookAppId: process.env.FACEBOOK_APP_ID! || "",
 *   facebookAppSecret: process.env.FACEBOOK_APP_SECRET! || "",
 *   facebookCallbackURL: process.env.FACEBOOK_CALLBACK_URL! || "",
 * });
 *
 * // Define routes and start server
 * app.get("/", (req, res) => {
 *   res.send("Express + TypeScript Server");
 * });
 *
 * app.use('/api', authenticateApiMiddleware);
 *
 * app.get('/api/public/data', (req, res) => {
 *   res.send('This is a public route');
 * });
 *
 * app.get('/api/private/data', (req, res) => {
 *   // Only authenticated users will reach here
 *   res.send(`Hello, ${req.user.email}`);
 * });
 *
 * app.listen(port, () => {
 *   console.log(`[server]: Server is running at http://localhost:${port}`);
 * });
 */
export function dAuthMiddleware(app: Express | any, options: DAuthOptions) {

  const configInstance = AuthConfig.getInstance();

  if (!options.sessionSecret) {
    throw new Error('Session secret is required');
  }

  if (!options.mongoDbUri) {
    throw new Error('MongoDB URI is required');
  }

  if ( !process.env.CORS_ORIGIN ) {
    throw new Error('CORS_ORIGIN environment variable is required');
  }


  configInstance.setConfiguration(options);

  // MongoDB connection
  mongoose.connect(options.mongoDbUri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

  app.use(session(AuthConfig.getInstance().sessionOptions));
  
  // Middleware
  app.use(
    cors(AuthConfig.getInstance().corsOptions)
  );

  app.use(rateLimit(AuthConfig.getInstance().rateLimitOptions));

  app.use(express.json());
  app.use(cookieParser());
  
  // Initialize Passport and session management middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Initialize Passport with the configuration
  passportConfig(options);

  // Attach auth routes here (e.g., /auth/login, /auth/register)
  app.use(options.authRouteinitials || '', authRoutes);

  // Error handling and other middleware logic can go here
}

export interface AuthenticatedRequest extends Request {
  user?: any;
}

/**
 * Authenticates a token sent in the Authorization header of an incoming request.
 *
 * @param {AuthenticatedRequest} req - The incoming request object.
 * @param {Response} res - The outgoing response object.
 * @param {NextFunction} next - The next middleware or route handler in the stack.
 * @return {void}
 */
export const authenticateApiMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Skip /api/public/* routes
  if (req.path.startsWith('/public/')) {
    return next();
  }

  if (req.isAuthenticated() && req.user.id) {
    if (req.path.startsWith('/admin/') && (!req.user.isAdmin || !req.user.isVerified)) {
      return res.status(400).send( new HTTPResponse({statusCode: HttpStatus.UN_AUTHORISED.code, httpStatus: HttpStatus.UN_AUTHORISED.status, message: "Not admin or not verified"}));
    } else {
      return next();
    }
  } else {
    return res.status(403).send( new HTTPResponse({statusCode: HttpStatus.FORBIDDEN.code, httpStatus: HttpStatus.FORBIDDEN.status, message: "Unauthorized Access"}));
  }
};

export const authenticateApiJWTMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
