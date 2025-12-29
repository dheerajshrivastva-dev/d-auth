import { IDatabaseAdapter } from "../adapters/IDatabaseAdapter";
import { CookieOptions } from "express";

/**
 * Authentication strategy
 * - 'jwt': JWT-based authentication (stateless)
 * - 'session': Session-based authentication with Passport (stateful)
 */
export type AuthStrategy = "jwt" | "session";

/**
 * Token delivery mode (for JWT strategy only)
 * - 'cookie': Tokens sent via HTTP-only cookies (more secure)
 * - 'response': Tokens sent in response body (for mobile apps, SPAs)
 * - 'both': Tokens in both cookie and response body
 */
export type TokenMode = "cookie" | "response" | "both";

/**
 * Authentication hooks for custom logic
 */
export interface DAuthHooks {
  /**
   * Called when an OTP is generated
   * User should queue/send the OTP email
   */
  onOTPGenerated?: (data: {
    email: string;
    otp: string;
    userId: string;
    otpType: "ForgetPassword" | "VerifyEmail" | "Verify2FA" | "VerifyPhone";
    sessionId: string;
    expiresInMinutes: number;
  }) => Promise<void> | void;

  /**
   * Called when a user registers successfully
   */
  onUserRegistered?: (data: {
    user: any;
    isOAuth: boolean;
    provider?: "google" | "facebook" | "apple";
  }) => Promise<void> | void;

  /**
   * Called when admin creates a user with temporary password
   * User should send the temporary password via email
   */
  onUserCreatedWithTempPassword?: (data: {
    user: any;
    temporaryPassword: string;
    email: string;
  }) => Promise<void> | void;

  /**
   * Called when user logs in successfully
   */
  onUserLogin?: (data: { user: any; ip: string; deviceName: string }) => Promise<void> | void;

  /**
   * Called when password is reset
   */
  onPasswordReset?: (data: { user: any; ip: string }) => Promise<void> | void;

  /**
   * Called when user logs out
   */
  onUserLogout?: (data: { userId: string; sessionId: string }) => Promise<void> | void;

  /**
   * Called when account is locked due to failed login attempts
   */
  onAccountLocked?: (data: {
    user: any;
    failedAttempts: number;
    lockedUntil: Date;
  }) => Promise<void> | void;

  /**
   * Called when 2FA is enabled
   */
  on2FAEnabled?: (data: { user: any; backupCodesCount: number }) => Promise<void> | void;

  /**
   * Called when 2FA is disabled
   */
  on2FADisabled?: (data: { userId: string }) => Promise<void> | void;
}

/**
 * OAuth provider configuration
 */
export interface OAuthConfig {
  google?: {
    clientId: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
  };
  facebook?: {
    clientId: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
  };
  apple?: {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
    callbackURL: string;
  };
}

/**
 * Role hierarchy configuration
 */
export type RoleHierarchy = Record<string, number>;

/**
 * JWT configuration (for 'jwt' auth strategy)
 */
export interface JWTConfig {
  /**
   * Secret for signing JWT tokens
   */
  secret: string;

  /**
   * Access token expiry (default: '15m')
   */
  accessTokenExpiry?: string;

  /**
   * Refresh token expiry (default: '7d')
   */
  refreshTokenExpiry?: string;

  /**
   * Token delivery mode
   */
  tokenMode?: TokenMode;

  /**
   * Cookie options (used when tokenMode is 'cookie' or 'both')
   */
  cookieOptions?: CookieOptions;
}

/**
 * Session configuration (for 'session' auth strategy)
 * Uses express-session + Passport.js for traditional session-based auth
 */
export interface SessionConfig {
  /**
   * Session secret for signing cookies
   */
  secret: string;

  /**
   * Session name (default: 'connect.sid')
   */
  name?: string;

  /**
   * Cookie options
   */
  cookie?: CookieOptions;

  /**
   * Session TTL in milliseconds (default: 24 hours)
   */
  maxAge?: number;

  /**
   * Max sessions per user (default: 10)
   * Used for limiting concurrent sessions
   */
  maxSessionsPerUser?: number;

  /**
   * Session store configuration
   * By default uses database adapter for session storage
   */
  store?: "database" | "memory" | "redis";

  /**
   * Redis connection string (if store is 'redis')
   */
  redisUrl?: string;
}

/**
 * 2FA configuration
 */
export interface TwoFactorConfig {
  /**
   * Enable 2FA support (default: false)
   */
  enabled?: boolean;

  /**
   * Issuer name for authenticator apps
   */
  issuer?: string;

  /**
   * Number of backup codes to generate (default: 10)
   */
  backupCodesCount?: number;

  /**
   * Window for TOTP validation (default: 1)
   */
  window?: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /**
   * Enable rate limiting (default: true)
   */
  enabled?: boolean;

  /**
   * Max requests per window
   */
  maxRequests?: number;

  /**
   * Time window in milliseconds
   */
  windowMs?: number;
}

/**
 * CORS configuration
 */
export interface CORSConfig {
  /**
   * Allowed origins
   */
  origin?: string | string[] | boolean;

  /**
   * Allow credentials
   */
  credentials?: boolean;

  /**
   * Allowed methods
   */
  methods?: string[];

  /**
   * Allowed headers
   */
  allowedHeaders?: string[];
}

/**
 * Main d-auth configuration
 */
export interface DAuthOptions {
  /**
   * Database adapter implementation
   */
  database: IDatabaseAdapter;

  /**
   * Authentication strategy
   * - 'jwt': Stateless JWT-based auth (default)
   * - 'session': Stateful session-based auth with Passport
   */
  strategy?: AuthStrategy;

  /**
   * JWT configuration (required if strategy is 'jwt')
   */
  jwt?: JWTConfig;

  /**
   * Session configuration (required if strategy is 'session')
   */
  session?: SessionConfig;

  /**
   * OAuth providers configuration
   */
  oauth?: OAuthConfig;

  /**
   * Role hierarchy (role -> privilege level)
   */
  roleHierarchy?: RoleHierarchy;

  /**
   * 2FA configuration
   */
  twoFactor?: TwoFactorConfig;

  /**
   * Rate limiting configuration
   */
  rateLimit?: RateLimitConfig;

  /**
   * CORS configuration
   */
  cors?: CORSConfig;

  /**
   * Custom hooks for events
   */
  hooks?: DAuthHooks;

  /**
   * Base path for auth routes (if using built-in router)
   */
  basePath?: string;
}
