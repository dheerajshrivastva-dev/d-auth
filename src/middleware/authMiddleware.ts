import express, { Request, Response, NextFunction, Express } from "express";
import session, { SessionOptions } from "express-session";
import { JwtPayload } from "jsonwebtoken";
import User from "../models/User";

import { AuthOptions, passportConfig } from "../passport/passportConfig";
import passport from "passport";
import authRoutes from "../routes/authRoutes";
import mongoose from "mongoose";

import dotenv from "dotenv";
import { verifyToken } from "../utils/verifyToken";
import AuthConfig, { CookieOptions, NodeMailerConfig, CompanyDetails } from "../config/authConfig";

import cookieParser from "cookie-parser";
import cors from "cors";
import rateLimit, { Options } from "express-rate-limit";
import { HTTPResponse, HttpStatus } from "../httpResponse";
import {
  RoleHierarchy,
  initializeRoleHierarchy,
  getRoleHierarchyManager,
} from "../config/roleHierarchy";

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
  roleHierarchy?: RoleHierarchy; // Custom role hierarchy configuration
}

/**
 * Configures and initializes authentication middleware for the Express application.
 * This returns a function that applies all necessary middleware to your Express app.
 *
 * BREAKING CHANGE: This function now follows proper Express middleware pattern.
 * Previously: dAuthMiddleware(app, options)
 * Now: dAuthMiddleware(options)(app)
 *
 * @param {DAuthOptions} options - Options for authentication configuration.
 * @return {(app: Express) => void} Function that configures the Express app with auth middleware
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
 * // Use dAuth middleware - it configures the app using curried function pattern
 * dAuthMiddleware({
 *   mongoDbUri: process.env.MONGO_URI!,
 *   sessionSecret: process.env.SESSION_SECRET!,
 *   googleClientId: process.env.GOOGLE_CLIENT_ID! || "",
 *   googleClientSecret: process.env.GOOGLE_CLIENT_SECRET! || "",
 *   googleCallbackURL: process.env.GOOGLE_CALLBACK_URL! || "",
 *   facebookAppId: process.env.FACEBOOK_APP_ID! || "",
 *   facebookAppSecret: process.env.FACEBOOK_APP_SECRET! || "",
 *   facebookCallbackURL: process.env.FACEBOOK_CALLBACK_URL! || "",
 * })(app);
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
export function dAuthMiddleware(options: DAuthOptions) {
  // Returns a configuration function that takes the Express app instance
  // This follows the higher-order function pattern common in Express middleware
  return (app: Express | any) => {
    const configInstance = AuthConfig.getInstance();

    // Validate required options
    if (!options.sessionSecret) {
      throw new Error("Session secret is required");
    }

    if (!options.mongoDbUri) {
      throw new Error("MongoDB URI is required");
    }

    if (!process.env.CORS_ORIGIN) {
      throw new Error("CORS_ORIGIN environment variable is required");
    }

    configInstance.setConfiguration(options);

    // Initialize role hierarchy with custom or default configuration
    initializeRoleHierarchy(options.roleHierarchy);

    // Connect to MongoDB
    mongoose
      .connect(options.mongoDbUri)
      .then(() => console.log("MongoDB connected"))
      .catch((err) => console.error(err));

    // Apply global middleware to app instance
    // Note: These must be applied to app (not router) to work across all routes
    app.use(session(AuthConfig.getInstance().sessionOptions));

    app.use(cors(AuthConfig.getInstance().corsOptions));

    app.use(rateLimit(AuthConfig.getInstance().rateLimitOptions));

    app.use(express.json());
    app.use(cookieParser());

    // Initialize Passport and session management middleware
    app.use(passport.initialize());
    app.use(passport.session());

    // Initialize Passport with the configuration
    passportConfig(options);

    // Attach auth routes (e.g., /auth/login, /auth/register, /auth/google, etc.)
    app.use(options.authRouteinitials || "", authRoutes);
  };
}

export interface AuthenticatedRequest extends Request {
  user?: any; // Legacy v3 - kept for backward compatibility. Use guards/requireAuth.AuthenticatedRequest in v4
}

/**
 * Unified middleware factory for role-based access control with hierarchy support.
 * Handles public routes, single role, and multiple role requirements.
 * Uses role hierarchy - higher roles automatically have access to lower role routes.
 * Supports both new roles array and legacy isAdmin field.
 *
 * @param {string[]} requiredRoles - Array of roles allowed to access the route
 *                                   - Empty array [] = Public route (no authentication required)
 *                                   - Single role = User needs that role or higher
 *                                   - Multiple roles = User needs ANY of these roles (or higher)
 * @return {Function} Express middleware function
 *
 * @example
 * // Public routes - no authentication required
 * const publicRouter = express.Router();
 * app.use('/api/public', requireRoles([]), publicRouter);
 * // Anyone can access, even unauthenticated users
 *
 * // Single role - user needs this role or higher
 * app.get('/employee/dashboard', requireRoles(['employee']), (req, res) => {
 *   res.send('Employee Dashboard');
 *   // Employee, Supervisor, Manager, Moderator, Admin can access
 * });
 *
 * // Multiple roles - user needs ANY of these (or higher)
 * app.get('/staff/schedule', requireRoles(['employee', 'staff']), (req, res) => {
 *   res.send('Staff Schedule');
 *   // Staff, Employee, Supervisor, Manager, Moderator, Admin can access
 * });
 *
 * // Router-level protection (Recommended)
 * const adminRouter = express.Router();
 * adminRouter.get('/users', handler);
 * adminRouter.delete('/user/:id', handler);
 * app.use('/api/admin', requireRoles(['admin']), adminRouter);
 * // All routes in adminRouter require admin role
 */
export const requireRoles = (requiredRoles: string[] = []) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Empty array = Public route (no authentication required)
    if (requiredRoles.length === 0) {
      return next();
    }

    // Check authentication for protected routes
    if (!req.isAuthenticated() || !req.user?.id) {
      return res.status(401).send(
        new HTTPResponse({
          statusCode: HttpStatus.UN_AUTHORISED.code,
          httpStatus: HttpStatus.UN_AUTHORISED.status,
          message: "Authentication required",
        })
      );
    }

    const hierarchyManager = getRoleHierarchyManager();

    // Get user's roles (support legacy isAdmin)
    const userRoles = req.user.roles || [];
    if (req.user.isAdmin && !userRoles.includes("admin")) {
      userRoles.push("admin");
    }

    // Check if user has access to ANY of the required roles (or higher) using hierarchy
    const hasAccess = hierarchyManager.hasAnyAccess(userRoles, requiredRoles);

    if (!hasAccess) {
      return res.status(403).send(
        new HTTPResponse({
          statusCode: HttpStatus.FORBIDDEN.code,
          httpStatus: HttpStatus.FORBIDDEN.status,
          message: `Access denied. Required roles: ${requiredRoles.join(", ")} (or higher)`,
        })
      );
    }

    return next();
  };
};

/**
 * @deprecated Use requireRoles() instead for cleaner role-based access control.
 *
 * Legacy middleware that checks authentication and admin access based on URL paths.
 * This middleware uses path-based checking (/admin/*) which creates redundancy with
 * the role hierarchy system.
 *
 * Migration:
 * @example
 * // ❌ Old way (deprecated):
 * app.use('/api', authenticateApiMiddleware);
 * app.get('/api/admin/users', handler);
 *
 * // ✅ New way (recommended):
 * app.use('/api/public', publicRouter);
 * app.use('/api/user', requireRoles(['user']), userRouter);
 * app.use('/api/admin', requireRoles(['admin']), adminRouter);
 */
export const authenticateApiMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Skip /api/public/* routes
  if (req.path.startsWith("/public/")) {
    return next();
  }

  if (req.isAuthenticated() && req.user.id) {
    // Check admin routes - supports both legacy isAdmin and new roles array
    if (req.path.startsWith("/admin/")) {
      const isAdmin = req.user.isAdmin || (req.user.roles && req.user.roles.includes("admin"));

      if (!isAdmin || !req.user.isVerified) {
        return res.status(400).send(
          new HTTPResponse({
            statusCode: HttpStatus.UN_AUTHORISED.code,
            httpStatus: HttpStatus.UN_AUTHORISED.status,
            message: "Not admin or not verified",
          })
        );
      }
    }
    return next();
  }

  return res.status(403).send(
    new HTTPResponse({
      statusCode: HttpStatus.FORBIDDEN.code,
      httpStatus: HttpStatus.FORBIDDEN.status,
      message: "Unauthorized Access",
    })
  );
};

export const authenticateApiJWTMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Skip /api/public/* routes
  if (req.path.startsWith("/api/public")) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Authorization token is missing" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Require access token to use this api" });
  }

  try {
    // Verify the access token
    const decoded: JwtPayload = verifyToken(token);
    // Fetch the user based on the decoded token (userId)
    const user = await User.findById(decoded?.id);

    if (!user) {
      return res.status(403).json({ message: "Invalid access token" });
    }

    // Attach user to the request
    req.user = user;

    // Proceed to the next middleware or route handler
    next();
  } catch {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};
