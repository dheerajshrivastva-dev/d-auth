# d-auth v4.0.0 - Implementation Roadmap

## 📋 Overview

This document outlines the implementation plan for transforming d-auth from a route-based library to a middleware-first, database-agnostic authentication system.

## ✅ Completed (Design Phase)

- [x] Database adapter interface (`IDatabaseAdapter`)
- [x] Configuration types with JWT modes and hooks
- [x] MongoDB adapter implementation
- [x] PostgreSQL adapter example
- [x] Comprehensive usage examples
- [x] Architecture documentation

## 🚧 Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

#### 1.1 Token & Auth Utilities
- [ ] Create `src/utils/tokenUtils.ts`
  - `generateAccessToken(userId, sessionId)`
  - `generateRefreshToken(userId, sessionId)`
  - `verifyAccessToken(token)`
  - `verifyRefreshToken(token)`
  - Support for different token modes (cookie/response/both)

- [ ] Create `src/utils/otpUtils.ts`
  - `generateOTP()` - 6-digit random OTP
  - `hashOTP(otp)` - Optional hashing
  - `validateOTPFormat(otp)`

- [ ] Create `src/utils/sessionUtils.ts`
  - `generateSessionId()` - UUID v4
  - `parseUserAgent(userAgent)` - Device name extraction
  - `getClientIp(req)` - IP extraction
  - `calculateExpiryDate(ttl)` - Session expiry calculation

- [ ] Create `src/utils/passwordUtils.ts`
  - `hashPassword(password)` - bcrypt hashing
  - `comparePassword(password, hash)` - bcrypt comparison
  - `validatePasswordStrength(password)` - Strength validation

#### 1.2 2FA Services
- [ ] Create `src/services/twoFactorService.ts`
  - `generateTOTPSecret()` - Generate TOTP secret
  - `generateQRCode(secret, email, issuer)` - QR code generation
  - `verifyTOTP(secret, token, window)` - Verify TOTP token
  - `generateBackupCodes(count)` - Generate backup codes
  - `hashBackupCodes(codes)` - Hash backup codes

#### 1.3 Role Hierarchy Manager
- [ ] Refactor `src/config/roleHierarchy.ts`
  - Make it accept custom hierarchy on initialization
  - Keep singleton pattern
  - Add `resetInstance()` for testing

### Phase 2: Middleware Functions (Week 2-3)

#### 2.1 Registration Middleware
- [ ] Create `src/middleware/registerMiddleware.ts`
  ```typescript
  export const createRegisterMiddleware(options: {
    database: IDatabaseAdapter;
    hooks: DAuthHooks;
    jwt: JWTConfig;
  }) => RequestHandler
  ```
  - Validate email and password
  - Check if user exists
  - Hash password
  - Create user via database adapter
  - Generate tokens based on tokenMode
  - Set cookies if tokenMode is 'cookie' or 'both'
  - Call `onUserRegistered` hook
  - Return response

#### 2.2 Login Middleware
- [ ] Create `src/middleware/loginMiddleware.ts`
  ```typescript
  export const createLoginMiddleware(options: {
    database: IDatabaseAdapter;
    hooks: DAuthHooks;
    jwt: JWTConfig;
    twoFactor: TwoFactorConfig;
  }) => RequestHandler
  ```
  - Find user by email
  - Verify password
  - Check if 2FA is enabled
    - If yes: generate temp token and return `{ requires2FA: true, tempToken }`
    - If no: proceed with login
  - Generate session and tokens
  - Add session to database
  - Set cookies if needed
  - Call `onUserLogin` hook
  - Return response

#### 2.3 Logout Middleware
- [ ] Create `src/middleware/logoutMiddleware.ts`
  - Extract sessionId from token
  - Remove session from database
  - Clear cookies if tokenMode is 'cookie' or 'both'
  - Call `onUserLogout` hook
  - Return success response

#### 2.4 Forgot Password Middleware
- [ ] Create `src/middleware/forgotPasswordMiddleware.ts`
  - Validate email
  - Find user by email
  - Generate OTP via database adapter
  - Call `onOTPGenerated` hook (user handles email)
  - Return success response

#### 2.5 Reset Password Middleware
- [ ] Create `src/middleware/resetPasswordMiddleware.ts`
  - Validate OTP, sessionId, new password
  - Find and verify OTP via database adapter
  - Hash new password
  - Update password in database
  - Delete OTP
  - Call `onPasswordReset` hook
  - Return success response

#### 2.6 Refresh Token Middleware
- [ ] Create `src/middleware/refreshTokenMiddleware.ts`
  - Extract refresh token (from cookie or body based on tokenMode)
  - Verify refresh token
  - Find session in database
  - Check session expiry
  - Generate new access token
  - Update refresh token in session
  - Set cookies if needed
  - Return new tokens

#### 2.7 2FA Middlewares
- [ ] Create `src/middleware/twoFactor/setupMiddleware.ts`
  - Generate TOTP secret
  - Generate QR code
  - Generate backup codes
  - Return to user (DON'T save yet)

- [ ] Create `src/middleware/twoFactor/enableMiddleware.ts`
  - Verify TOTP token from user
  - Save secret and backup codes to database
  - Enable 2FA for user
  - Call `on2FAEnabled` hook
  - Return success

- [ ] Create `src/middleware/twoFactor/verifyMiddleware.ts`
  - Extract temp token from request
  - Verify temp token
  - Get user and 2FA secret
  - Verify TOTP token OR backup code
  - If backup code: remove from list
  - Generate session and tokens
  - Return tokens

- [ ] Create `src/middleware/twoFactor/disableMiddleware.ts`
  - Require authentication
  - Disable 2FA in database
  - Call `on2FADisabled` hook
  - Return success

#### 2.8 OAuth Middlewares
- [ ] Create `src/middleware/oauth/googleMiddleware.ts`
  - Passport Google strategy integration
  - Handle OAuth flow
  - Find or create user
  - Generate session and tokens
  - Call `onUserRegistered` or `onUserLogin` hook

- [ ] Create `src/middleware/oauth/facebookMiddleware.ts`
  - Similar to Google

### Phase 3: Guard Middlewares (Week 3)

#### 3.1 Authentication Guard
- [ ] Create `src/middleware/guards/requireAuth.ts`
  ```typescript
  export const createAuthGuard(options: {
    database: IDatabaseAdapter;
    jwt: JWTConfig;
  }) => RequestHandler
  ```
  - Extract token (from cookie or Authorization header based on tokenMode)
  - Verify token
  - Find user by ID
  - Attach user to `req.user`
  - Call next()

#### 3.2 Role-Based Guard
- [ ] Create `src/middleware/guards/requireRoles.ts`
  ```typescript
  export const createRoleGuard(options: {
    database: IDatabaseAdapter;
    jwt: JWTConfig;
    roleHierarchy: RoleHierarchy;
  }) => (roles: string[]) => RequestHandler
  ```
  - Require authentication first
  - Check if user has required roles using hierarchy
  - Return 403 if insufficient privileges

### Phase 4: Main DAuth Class (Week 4)

#### 4.1 DAuth Class
- [ ] Create `src/DAuth.ts`
  ```typescript
  export class DAuth {
    private config: DAuthOptions;
    private database: IDatabaseAdapter;

    constructor(options: DAuthOptions);

    // Initialize method
    initialize(): RequestHandler[];

    // Middleware getters
    get middleware(): {
      register: RequestHandler;
      login: RequestHandler;
      logout: RequestHandler;
      forgotPassword: RequestHandler;
      resetPassword: RequestHandler;
      refreshToken: RequestHandler;
      enable2FA: RequestHandler;
      verify2FA: RequestHandler;
      disable2FA: RequestHandler;
      googleAuth: RequestHandler;
      googleCallback: RequestHandler;
      facebookAuth: RequestHandler;
      facebookCallback: RequestHandler;
    };

    // Guard methods
    requireAuth(): RequestHandler;
    requireRoles(roles: string[]): RequestHandler;

    // Optional router
    get router(): Router;

    // Services
    get services(): {
      setup2FA(userId: string): Promise<{...}>;
      generateTokens(userId: string, sessionId: string): {...};
      verifyToken(token: string): {...};
    };
  }
  ```

#### 4.2 Optional Router
- [ ] Create `src/router/authRouter.ts`
  - Creates Express Router with all auth routes
  - Configurable base path
  - Mounted like: `app.use('/auth', dAuth.router)`

### Phase 5: Exports & Package (Week 4)

#### 5.1 Main Index
- [ ] Update `src/index.ts`
  ```typescript
  // Main class
  export { DAuth } from './DAuth';

  // Adapters
  export { MongoDBAdapter } from './adapters/MongoDBAdapter';
  export { IDatabaseAdapter, IUserDocument, ISessionData, IOTPData } from './adapters/IDatabaseAdapter';

  // Types
  export * from './types/config';

  // Utilities (optional exports)
  export * from './utils/tokenUtils';
  export * from './utils/passwordUtils';

  // Services
  export * from './services/twoFactorService';

  // Role hierarchy
  export { RoleHierarchyManager } from './config/roleHierarchy';
  ```

#### 5.2 Package.json Updates
- [ ] Update version to `4.0.0`
- [ ] Update dependencies
  - Remove: `nodemailer`, `@types/nodemailer`
  - Keep: `express`, `passport`, `passport-google-oauth20`, `passport-facebook`, `bcryptjs`, `jsonwebtoken`, `mongoose`
  - Add: `speakeasy` (for TOTP), `qrcode` (for QR generation)
- [ ] Update scripts
- [ ] Update description

### Phase 6: Testing (Week 5)

#### 6.1 Unit Tests
- [ ] Test database adapters
- [ ] Test utilities (token, OTP, password)
- [ ] Test 2FA service
- [ ] Test role hierarchy

#### 6.2 Integration Tests
- [ ] Test registration flow
- [ ] Test login flow (with/without 2FA)
- [ ] Test password reset flow
- [ ] Test OAuth flows
- [ ] Test token refresh
- [ ] Test RBAC guards

#### 6.3 E2E Tests
- [ ] Test with MongoDB
- [ ] Test with PostgreSQL (using example adapter)
- [ ] Test cookie mode
- [ ] Test response mode
- [ ] Test both mode

### Phase 7: Documentation & Examples (Week 6)

#### 7.1 Documentation
- [ ] Update main README.md
- [ ] Create MIGRATION_GUIDE.md (v3 to v4)
- [ ] Create API reference
- [ ] Create troubleshooting guide

#### 7.2 Examples
- [ ] Example: MongoDB + Cookie auth + BullMQ
- [ ] Example: PostgreSQL + Response auth + AWS SES
- [ ] Example: Custom user schema
- [ ] Example: Full 2FA implementation
- [ ] Example: Multi-tenant setup

### Phase 8: Migration Path (Week 6)

#### 8.1 Backward Compatibility Layer (Optional)
- [ ] Create `src/legacy/v3compat.ts`
  - Wrapper around v4 that mimics v3 API
  - Helps users migrate gradually
  - Deprecated warnings

#### 8.2 Migration Tools
- [ ] CLI tool to update config format
- [ ] Code snippets for common patterns

## 📦 Dependencies

### Production Dependencies
```json
{
  "express": "^4.18.0",
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "passport-facebook": "^3.0.0",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.0",
  "uuid": "^9.0.0",
  "speakeasy": "^2.0.0",
  "qrcode": "^1.5.0",
  "mongoose": "^8.0.0" // peer dependency
}
```

### Dev Dependencies
```json
{
  "typescript": "^5.0.0",
  "@types/express": "^4.17.0",
  "@types/passport": "^1.0.0",
  "@types/bcryptjs": "^2.4.0",
  "@types/jsonwebtoken": "^9.0.0",
  "@types/uuid": "^9.0.0",
  "@types/qrcode": "^1.5.0",
  "jest": "^29.0.0",
  "ts-jest": "^29.0.0",
  "supertest": "^6.3.0"
}
```

## 🎯 Success Criteria

1. **Database Agnostic**: Works with MongoDB and PostgreSQL out of the box
2. **Zero Built-in Email**: All email/notifications via hooks
3. **Flexible Token Delivery**: Cookie, response, or both modes
4. **Full 2FA Support**: TOTP + backup codes
5. **RBAC**: Role hierarchy with privilege levels
6. **Middleware-First**: Users control their own routes
7. **Type Safe**: Full TypeScript support
8. **Well Documented**: Comprehensive docs and examples
9. **Production Ready**: Session management, rate limiting, security
10. **Backward Compatible**: Migration path from v3.x

## 📊 Estimated Timeline

- **Phase 1-3**: 3 weeks (Core implementation)
- **Phase 4-5**: 1 week (Integration)
- **Phase 6**: 1 week (Testing)
- **Phase 7-8**: 1 week (Documentation & Migration)

**Total**: ~6 weeks

## 🚀 Next Steps

1. Review and approve this roadmap
2. Set up development branch (`feat/v4-refactor`)
3. Start with Phase 1.1 (Token utilities)
4. Implement incrementally with tests
5. Create beta releases for testing
6. Gather community feedback
7. Official v4.0.0 release

## 📝 Notes

- Keep v3.x maintained during v4 development
- Consider creating `@d-auth/mongodb`, `@d-auth/postgres` as separate packages
- Community adapters: Prisma, MySQL, Redis, etc.
- Future: WebAuthn/Passkey support, magic link auth
