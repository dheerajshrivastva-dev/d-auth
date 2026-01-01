import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "jsonwebtoken";
import { IDatabaseAdapter, IUserDocument } from "../../adapters/IDatabaseAdapter";
import { ISessionStore } from "../../stores/ISessionStore";
import { verifyToken } from "../../utils/verifyToken";
import { HTTPResponse, HttpStatus } from "../../httpResponse";
import { JWTConfig } from "../../types/config";

/**
 * Authentication Guard
 * Refactored from authMiddleware.ts:248-325
 *
 * Supports both JWT and Session-based authentication
 * Extracts token from cookies OR Authorization header based on tokenMode
 *
 * Key improvements from v3:
 * - Database agnostic (uses adapter)
 * - Supports multiple token modes (cookie, response, both)
 * - Unified logic for JWT and Session
 * - Cleaner error handling
 *
 * Usage:
 * ```typescript
 * const authGuard = requireAuth({ database, jwtConfig });
 * app.get('/protected', authGuard, handler);
 * ```
 */

export interface AuthenticatedRequest extends Request {
  user?: IUserDocument;
}

export interface RequireAuthOptions {
  database: IDatabaseAdapter;
  sessionStore: ISessionStore;
  jwtConfig?: JWTConfig;
}

/**
 * Create authentication guard middleware
 *
 * @param options - Configuration options
 * @returns Express middleware function
 */
export function requireAuth(options: RequireAuthOptions) {
  const { database, sessionStore, jwtConfig } = options;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const isJWTMode = !!jwtConfig;

    if (isJWTMode) {
      // JWT-based authentication
      return authenticateWithJWT(req, res, next, database, sessionStore, jwtConfig);
    } else {
      // Session-based authentication (Passport.js)
      return authenticateWithSession(req, res, next);
    }
  };
}

/**
 * JWT-based authentication
 * Refactored from authenticateApiJWTMiddleware (authMiddleware.ts:285-325)
 *
 * Changes from v3:
 * - User.findById → database.findUserById
 * - Supports multiple token sources (cookie + header) based on tokenMode
 * - Session validation via sessionStore for blacklist strategy
 */
async function authenticateWithJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  database: IDatabaseAdapter,
  sessionStore: ISessionStore,
  jwtConfig: JWTConfig
) {
  const tokenMode = jwtConfig.tokenMode || "cookie";

  // Extract token based on mode
  let token: string | undefined;

  if (tokenMode === "cookie") {
    // Cookie mode: Only check cookies
    token = req.cookies?.accessToken;
  } else if (tokenMode === "response") {
    // Response mode: Only check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader) {
      token = authHeader.split(" ")[1];
    }
  } else if (tokenMode === "both") {
    // Both mode: Check cookies first, then header
    token = req.cookies?.accessToken;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        token = authHeader.split(" ")[1];
      }
    }
  }

  if (!token) {
    return res.status(401).send(
      new HTTPResponse({
        statusCode: HttpStatus.UN_AUTHORISED.code,
        httpStatus: HttpStatus.UN_AUTHORISED.status,
        message: "Authentication required",
      })
    );
  }

  try {
    // ✅ REUSE: Verify token (authMiddleware.ts:309)
    const decoded: JwtPayload = verifyToken(token);

    // 🔄 CHANGE: User.findById → database.findUserById
    const user = await database.findUserById(decoded.id);

    if (!user) {
      return res.status(403).send(
        new HTTPResponse({
          statusCode: HttpStatus.FORBIDDEN.code,
          httpStatus: HttpStatus.FORBIDDEN.status,
          message: "Invalid access token",
        })
      );
    }

    // 🆕 NEW: Check session validity based on invalidation strategy
    const invalidationStrategy = jwtConfig.invalidationStrategy || "blacklist";
    if (invalidationStrategy === "blacklist" && decoded.sessionId) {
      const session = await sessionStore.getSession(decoded.id, decoded.sessionId);
      if (!session) {
        return res.status(403).send(
          new HTTPResponse({
            statusCode: HttpStatus.FORBIDDEN.code,
            httpStatus: HttpStatus.FORBIDDEN.status,
            message: "Session expired or invalidated",
          })
        );
      }
    }

    // ✅ REUSE: Attach user to request (authMiddleware.ts:318)
    req.user = user;

    // Proceed to next middleware
    next();
  } catch {
    return res.status(403).send(
      new HTTPResponse({
        statusCode: HttpStatus.FORBIDDEN.code,
        httpStatus: HttpStatus.FORBIDDEN.status,
        message: "Invalid or expired token",
      })
    );
  }
}

/**
 * Session-based authentication using Passport.js
 * Refactored from authenticateApiMiddleware (authMiddleware.ts:248-283)
 *
 * Changes from v3:
 * - Removed path-based logic (/public/, /admin/) - that's handled by requireRoles
 * - Simplified to just check req.isAuthenticated()
 */
function authenticateWithSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // ✅ REUSE: Check Passport session (authMiddleware.ts:258)
    if (req.isAuthenticated && req.isAuthenticated() && req.user?.id) {
      return next();
    }

    return res.status(401).send(
      new HTTPResponse({
        statusCode: HttpStatus.UN_AUTHORISED.code,
        httpStatus: HttpStatus.UN_AUTHORISED.status,
        message: "Authentication required",
      })
    );
  } catch (error) {
    // Log error for debugging
    console.error("[requireAuth] Session authentication error:", error);
    console.error("[requireAuth] req.isAuthenticated:", typeof req.isAuthenticated);
    console.error("[requireAuth] req.user:", req.user);

    return res.status(500).send(
      new HTTPResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR.code,
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR.status,
        message: "Internal server error during authentication",
      })
    );
  }
}
