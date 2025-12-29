import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { IDatabaseAdapter } from "../adapters/IDatabaseAdapter";
import { DAuthHooks, JWTConfig, SessionConfig, TokenMode } from "../types/config";
import {
  generateAccessToken,
  generateRefreshToken,
  extractClientDetails,
} from "../utils/generateTokens";
import { verifyToken } from "../utils/verifyToken";

/**
 * Base class for all authentication middleware
 * Contains common helpers reused from v3 controllers
 */
export class BaseAuthMiddleware {
  protected database: IDatabaseAdapter;
  protected hooks: DAuthHooks;
  protected jwtConfig?: JWTConfig;
  protected sessionConfig?: SessionConfig;

  constructor(
    database: IDatabaseAdapter,
    hooks: DAuthHooks,
    jwtConfig?: JWTConfig,
    sessionConfig?: SessionConfig
  ) {
    this.database = database;
    this.hooks = hooks;
    this.jwtConfig = jwtConfig;
    this.sessionConfig = sessionConfig;
  }

  /**
   * Generate tokens for a user session
   * Reused from authController.ts:47-55
   */
  protected generateTokens(userId: string): {
    sessionId: string;
    accessToken: string;
    refreshToken: string;
  } {
    const sessionId = uuidv4();
    const accessToken = generateAccessToken(userId, sessionId);
    const refreshToken = generateRefreshToken(userId, sessionId);

    return { sessionId, accessToken, refreshToken };
  }

  /**
   * Set token cookies based on tokenMode configuration
   * Enhanced version of authController.ts:20-31
   */
  protected setTokenCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string }
  ): void {
    const tokenMode = this.jwtConfig?.tokenMode || "cookie";

    if (tokenMode === "cookie" || tokenMode === "both") {
      const cookieOptions = this.jwtConfig?.cookieOptions || {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      res.cookie("refreshToken", tokens.refreshToken, cookieOptions);
      res.cookie("accessToken", tokens.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // 15 minutes for access token
      });
    }
  }

  /**
   * Clear token cookies
   * Reused from authController.ts:33-40
   */
  protected clearTokenCookies(res: Response): void {
    const cookieOptions = this.jwtConfig?.cookieOptions;
    const domain = cookieOptions?.domain;
    const path = cookieOptions?.path || "/";

    res.clearCookie("refreshToken", { domain, path });
    res.clearCookie("accessToken", { domain, path });
  }

  /**
   * Format response based on tokenMode
   * Returns tokens in response body if mode is 'response' or 'both'
   */
  protected formatTokenResponse(
    tokens: { accessToken: string; refreshToken: string },
    user: any
  ): any {
    const tokenMode = this.jwtConfig?.tokenMode || "cookie";

    if (tokenMode === "response" || tokenMode === "both") {
      return {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }

    // For cookie mode, don't send tokens in response
    return { user };
  }

  /**
   * Set forget password session cookie
   * Reused from forgetPasswordControlled.ts:17-28
   */
  protected setForgetPassCookie(res: Response, sessionId: string): void {
    const cookieOptions = this.jwtConfig?.cookieOptions || {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 10 * 60 * 1000, // 10 minutes for OTP session
    };

    res.cookie("forgetPassSessionId", sessionId, cookieOptions);
  }

  /**
   * Clear forget password session cookie
   * Reused from forgetPasswordControlled.ts:30-37
   */
  protected clearForgetPassCookie(res: Response): void {
    const cookieOptions = this.jwtConfig?.cookieOptions;
    const domain = cookieOptions?.domain;
    const path = cookieOptions?.path || "/";

    res.clearCookie("forgetPassSessionId", { domain, path });
  }

  /**
   * Extract client details from request
   * Uses existing utility from v3
   */
  protected getClientDetails(req: Request): { ip: string; deviceName: string } {
    return extractClientDetails(req);
  }

  /**
   * Verify JWT token
   * Uses existing utility from v3
   */
  protected verifyJWT(token: string): any {
    return verifyToken(token);
  }

  /**
   * Calculate session expiry date
   */
  protected getSessionExpiry(): Date {
    const expiryMs = this.sessionConfig?.maxAge || 24 * 60 * 60 * 1000; // 24 hours default
    return new Date(Date.now() + expiryMs);
  }
}
