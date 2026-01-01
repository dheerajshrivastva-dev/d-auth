import { Express, RequestHandler, Application } from "express";
import passport from "passport";
import { DAuthOptions, DAuthHooks, JWTConfig, SessionConfig, RoleHierarchy } from "./types/config";
import { IDatabaseAdapter } from "./adapters/IDatabaseAdapter";
import { ISessionStore } from "./stores/ISessionStore";
import { DatabaseSessionStore } from "./stores/DatabaseSessionStore";

// Import middleware
import { RegisterMiddleware } from "./middleware/auth/registerMiddleware";
import { LoginMiddleware } from "./middleware/auth/loginMiddleware";
import { LogoutMiddleware } from "./middleware/auth/logoutMiddleware";
import { RefreshTokenMiddleware } from "./middleware/auth/refreshTokenMiddleware";
import { PasswordResetMiddleware } from "./middleware/auth/passwordResetMiddleware";
import { OAuthMiddleware } from "./middleware/auth/oauthMiddleware";
import { AdminCreateUserMiddleware } from "./middleware/auth/adminCreateUserMiddleware";

// Import guards
import { requireAuth, RequireAuthOptions } from "./middleware/guards/requireAuth";
import {
  requireRoles,
  requireAllRoles,
  requireRolesAdvanced,
} from "./middleware/guards/requireRoles";

// Import role hierarchy
import { initializeRoleHierarchy } from "./config/roleHierarchy";
import { passportConfig } from "./passport/passportConfig";

/**
 * DAuth - Database-agnostic authentication middleware for Express
 *
 * Main class that orchestrates all authentication functionality.
 * Supports both JWT and Session-based authentication.
 *
 * @example
 * ```typescript
 * import { DAuth, MongoDBAdapter } from 'd-auth';
 *
 * const dAuth = new DAuth({
 *   database: new MongoDBAdapter({ uri: process.env.MONGO_URI }),
 *   jwt: {
 *     secret: process.env.JWT_SECRET,
 *     tokenMode: 'both',
 *   },
 *   hooks: {
 *     onOTPGenerated: async (data) => {
 *       await emailQueue.add('send-otp', data);
 *     },
 *   },
 * });
 *
 * // Use middleware
 * app.post('/auth/register', dAuth.middleware.register);
 * app.post('/auth/login', dAuth.middleware.login);
 * app.post('/auth/logout', dAuth.middleware.logout);
 *
 * // Protect routes
 * app.get('/profile', dAuth.requireAuth(), handler);
 * app.get('/admin', dAuth.requireRoles(['admin']), handler);
 * ```
 */
export class DAuth {
  private database: IDatabaseAdapter;
  private sessionStore: ISessionStore;
  private maxSessionsPerUser: number;
  private hooks: DAuthHooks;
  private jwtConfig?: JWTConfig;
  private sessionConfig?: SessionConfig;
  private roleHierarchy?: RoleHierarchy;
  private options: DAuthOptions;

  // Middleware instances
  private registerMw: RegisterMiddleware;
  private loginMw: LoginMiddleware;
  private logoutMw: LogoutMiddleware;
  private refreshTokenMw: RefreshTokenMiddleware;
  private passwordResetMw: PasswordResetMiddleware;
  private oauthMw: OAuthMiddleware;
  private adminCreateUserMw: AdminCreateUserMiddleware;

  constructor(options: DAuthOptions) {
    this.options = options;
    this.database = options.database;
    this.hooks = options.hooks || {};
    this.jwtConfig = options.jwt;
    this.sessionConfig = options.session;
    this.roleHierarchy = options.roleHierarchy;
    this.maxSessionsPerUser = options.maxSessionsPerUser || 10;

    // Initialize session store (defaults to DatabaseSessionStore for backward compatibility)
    this.sessionStore = options.sessionStore || new DatabaseSessionStore(this.database);

    // Validate configuration
    this.validateConfig();

    // Initialize role hierarchy
    if (this.roleHierarchy) {
      initializeRoleHierarchy(this.roleHierarchy);
    }

    // Initialize middleware instances
    this.registerMw = new RegisterMiddleware(
      this.database,
      this.sessionStore,
      this.maxSessionsPerUser,
      this.hooks,
      this.jwtConfig,
      this.sessionConfig,
      options.accountSecurity,
      options.oauth
    );

    this.loginMw = new LoginMiddleware(
      this.database,
      this.sessionStore,
      this.maxSessionsPerUser,
      this.hooks,
      this.jwtConfig,
      this.sessionConfig,
      options.accountSecurity,
      options.oauth
    );

    this.logoutMw = new LogoutMiddleware(
      this.database,
      this.sessionStore,
      this.maxSessionsPerUser,
      this.hooks,
      this.jwtConfig,
      this.sessionConfig,
      options.accountSecurity,
      options.oauth
    );

    this.refreshTokenMw = new RefreshTokenMiddleware(
      this.database,
      this.sessionStore,
      this.maxSessionsPerUser,
      this.hooks,
      this.jwtConfig,
      this.sessionConfig,
      options.accountSecurity,
      options.oauth
    );

    this.passwordResetMw = new PasswordResetMiddleware(
      this.database,
      this.sessionStore,
      this.maxSessionsPerUser,
      this.hooks,
      this.jwtConfig,
      this.sessionConfig,
      options.accountSecurity,
      options.oauth
    );

    this.oauthMw = new OAuthMiddleware(
      this.database,
      this.sessionStore,
      this.maxSessionsPerUser,
      this.hooks,
      this.jwtConfig,
      this.sessionConfig,
      options.accountSecurity,
      options.oauth
    );

    this.adminCreateUserMw = new AdminCreateUserMiddleware(
      this.database,
      this.sessionStore,
      this.maxSessionsPerUser,
      this.hooks,
      this.jwtConfig,
      this.sessionConfig,
      options.accountSecurity,
      options.oauth
    );
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (!this.database) {
      throw new Error("Database adapter is required");
    }

    const strategy = this.options.strategy || "jwt";

    if (strategy === "jwt" && !this.jwtConfig) {
      throw new Error("JWT configuration is required when using JWT strategy");
    }

    if (strategy === "session" && !this.sessionConfig) {
      throw new Error("Session configuration is required when using session strategy");
    }

    if (this.jwtConfig && !this.jwtConfig.secret) {
      throw new Error("JWT secret is required");
    }

    if (this.sessionConfig && !this.sessionConfig.secret) {
      throw new Error("Session secret is required");
    }
  }

  /**
   * Initialize d-auth
   * Returns a middleware that validates required dependencies are set up
   *
   * @example
   * ```typescript
   * const app = express();
   *
   * // Required: Set up body-parser and cookie-parser BEFORE d-auth
   * app.use(express.json());
   * app.use(express.urlencoded({ extended: true }));
   * app.use(cookieParser());
   *
   * const dAuth = new DAuth({ ... });
   * app.use(dAuth.initialize());
   * ```
   */
  public initialize(): RequestHandler {
    return (req, res, next) => {
      // Check if cookie-parser is set up (for JWT cookie mode)
      if (this.jwtConfig?.tokenMode !== "response") {
        if (!req.cookies) {
          throw new Error(
            "d-auth requires cookie-parser middleware. Please add: app.use(cookieParser()) before app.use(dAuth.initialize())"
          );
        }
      }

      // Check if body-parser is set up
      if (!req.body) {
        throw new Error(
          "d-auth requires body-parser middleware. Please add: app.use(express.json()) and app.use(express.urlencoded({ extended: true })) before app.use(dAuth.initialize())"
        );
      }

      next();
    };
  }

  /**
   * Initialize Passport (for session-based authentication)
   * Call this before using session-based auth
   *
   * @example
   * ```typescript
   * const dAuth = new DAuth({ strategy: 'session', ... });
   * dAuth.initializePassport(app);
   * ```
   */
  public initializePassport(app: Express | Application): void {
    if (!this.sessionConfig) {
      console.warn("Session config not provided. Skipping Passport initialization.");
      return;
    }

    // Import and configure passport strategies
    passportConfig({
      database: this.database,
      // Add any additional passport options here
    });

    app.use(passport.initialize());
    app.use(passport.session());
  }

  /**
   * Authentication middleware
   * Access individual middleware via this object
   */
  public get middleware() {
    return {
      /**
       * User registration middleware
       */
      register: this.registerMw.register,

      /**
       * Login middleware (supports both JWT and Session)
       */
      login: this.loginMw.login,

      /**
       * Logout middleware
       */
      logout: this.logoutMw.logout,

      /**
       * Refresh token middleware
       */
      refresh: this.refreshTokenMw.refresh,

      /**
       * Password reset flow
       */
      forgotPassword: this.passwordResetMw.forgotPassword,
      resetPassword: this.passwordResetMw.resetPassword,
      resendOTP: this.passwordResetMw.resendOTP,

      /**
       * OAuth authentication (Google, Facebook, Apple)
       */
      googleAuth: this.oauthMw.googleAuth,
      googleCallback: this.oauthMw.googleCallback,
      facebookAuth: this.oauthMw.facebookAuth,
      facebookCallback: this.oauthMw.facebookCallback,
      appleAuth: this.oauthMw.appleAuth,
      appleCallback: this.oauthMw.appleCallback,

      /**
       * Admin create user with temporary password
       */
      adminCreateUser: this.adminCreateUserMw.createUser,
      forcePasswordReset: this.adminCreateUserMw.forcePasswordReset,
    };
  }

  /**
   * Create authentication guard
   * Verifies JWT token or session
   *
   * @example
   * ```typescript
   * app.get('/profile', dAuth.requireAuth(), handler);
   * ```
   */
  public requireAuth(): RequestHandler {
    const options: RequireAuthOptions = {
      database: this.database,
      sessionStore: this.sessionStore,
      jwtConfig: this.jwtConfig,
    };

    return requireAuth(options);
  }

  /**
   * Create role-based access control guard
   *
   * @param requiredRoles - Array of roles that can access the route
   * @example
   * ```typescript
   * app.get('/admin', dAuth.requireRoles(['admin']), handler);
   * app.get('/staff', dAuth.requireRoles(['staff', 'employee']), handler);
   * ```
   */
  public requireRoles(requiredRoles: string[]): RequestHandler {
    return requireRoles(requiredRoles, this.roleHierarchy);
  }

  /**
   * Require ALL specified roles (not just ANY)
   *
   * @param requiredRoles - Array of roles that user MUST have (all of them)
   * @example
   * ```typescript
   * app.get('/special', dAuth.requireAllRoles(['employee', 'verified']), handler);
   * ```
   */
  public requireAllRoles(requiredRoles: string[]): RequestHandler {
    return requireAllRoles(requiredRoles, this.roleHierarchy);
  }

  /**
   * Advanced role guard with custom options
   *
   * @param options - Configuration options
   * @example
   * ```typescript
   * app.use('/api/admin', dAuth.requireRolesAdvanced({
   *   requiredRoles: ['admin'],
   *   allowUnverified: false,
   * }), adminRouter);
   * ```
   */
  public requireRolesAdvanced(options: {
    requiredRoles: string[];
    allowUnverified?: boolean;
  }): RequestHandler {
    return requireRolesAdvanced({
      ...options,
      roleHierarchy: this.roleHierarchy,
    });
  }

  /**
   * Get database adapter instance
   */
  public getDatabase(): IDatabaseAdapter {
    return this.database;
  }

  /**
   * Get current configuration
   */
  public getConfig(): DAuthOptions {
    return { ...this.options };
  }

  /**
   * Update hooks at runtime
   */
  public setHooks(hooks: Partial<DAuthHooks>): void {
    this.hooks = { ...this.hooks, ...hooks };

    // Update hooks in all middleware instances
    this.registerMw["hooks"] = this.hooks;
    this.loginMw["hooks"] = this.hooks;
    this.logoutMw["hooks"] = this.hooks;
    this.refreshTokenMw["hooks"] = this.hooks;
    this.passwordResetMw["hooks"] = this.hooks;
  }
}

/**
 * Default export for convenience
 */
export default DAuth;
