/**
 * d-auth v4.0.0 - Database-agnostic authentication middleware
 *
 * Main exports for the refactored v4 architecture
 */

// ========================================
// Core Classes
// ========================================
export { DAuth, default } from "./DAuth";

// ========================================
// Database Adapters
// ========================================
export {
  IDatabaseAdapter,
  IUserDocument,
  ISessionData,
  IOTPData,
} from "./adapters/IDatabaseAdapter";
export { MongoDBAdapter } from "./adapters/MongoDBAdapter";

// ========================================
// Configuration Types
// ========================================
export {
  DAuthOptions,
  DAuthHooks,
  AuthStrategy,
  TokenMode,
  JWTConfig,
  SessionConfig,
  OAuthConfig,
  TwoFactorConfig,
  RateLimitConfig,
  CORSConfig,
  RoleHierarchy,
} from "./types/config";

// ========================================
// Guards (Authentication & Authorization)
// ========================================
export {
  requireAuth,
  requireRoles,
  requireAllRoles,
  requireRolesAdvanced,
  AuthenticatedRequest,
  RequireAuthOptions,
  RequireRolesOptions,
} from "./middleware/guards";

// ========================================
// Middleware (Optional - for advanced usage)
// ========================================
export { BaseAuthMiddleware } from "./middleware/BaseAuthMiddleware";
export { RegisterMiddleware } from "./middleware/auth/registerMiddleware";
export { LoginMiddleware } from "./middleware/auth/loginMiddleware";
export { LogoutMiddleware } from "./middleware/auth/logoutMiddleware";
export { RefreshTokenMiddleware } from "./middleware/auth/refreshTokenMiddleware";
export { PasswordResetMiddleware } from "./middleware/auth/passwordResetMiddleware";

// ========================================
// Role Hierarchy System
// ========================================
export {
  DEFAULT_ROLE_HIERARCHY,
  RoleHierarchyManager,
  initializeRoleHierarchy,
  getRoleHierarchyManager,
} from "./config/roleHierarchy";

// ========================================
// Models (for backward compatibility)
// ========================================
export { default as User, IUser, UserRole } from "./models/User";

// ========================================
// HTTP Response Utilities
// ========================================
export { HTTPResponse, HttpStatus } from "./httpResponse";

// ========================================
// Token Utilities
// ========================================
export { generateAccessToken, generateRefreshToken } from "./utils/generateTokens";
export { verifyToken } from "./utils/verifyToken";
