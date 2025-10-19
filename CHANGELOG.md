# Changelog

All notable changes to the D-Auth project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - Version 3.0.0

### 🚨 Breaking Changes

#### Middleware Initialization Pattern Changed
- **Changed**: `dAuthMiddleware(app, options)` → `dAuthMiddleware(options)(app)`
- **Reason**: Follows proper Express middleware pattern using higher-order functions
- **Migration**: Update all middleware initialization calls

#### OAuth Callbacks Now Redirect Instead of JSON
- **Changed**: OAuth callbacks (`/auth/google/callback`, `/auth/facebook/callback`) now redirect to frontend instead of returning JSON
- **Impact**: Frontend must handle redirect flow and use session cookies
- **Migration**: Update frontend OAuth flow to expect redirects

#### `authenticateApiMiddleware` Deprecated
- **Status**: Deprecated (will be removed in v4.0.0)
- **Replacement**: Use `requireRoles()`
- **Migration**: See migration guide in RELEASE_NOTES.md

### ✨ Added

#### Role-Based Access Control (RBAC) System
- Added complete RBAC system with automatic role hierarchy
- Added `requireRoles(...roles)` middleware for multiple role options
- Added `UserRole` enum with predefined roles (ADMIN, MODERATOR, MANAGER, SUPERVISOR, EMPLOYEE, STAFF, USER)
- Added `RoleHierarchyManager` class for programmatic role management
- Added `DEFAULT_ROLE_HIERARCHY` with 7-level hierarchy
- Added support for custom role hierarchy configuration
- Added role hierarchy exports: `initializeRoleHierarchy()`, `getRoleHierarchyManager()`

#### Dynamic OAuth Redirect URLs
- Added support for dynamic redirect URLs via query parameter
- Added whitelist-based security validation (`ALLOWED_REDIRECT_URLS`)
- Added OAuth `state` parameter for reliable data passing through OAuth flow
- Added support for multiple frontends with single backend
- Added fallback to environment variables when redirect URL not provided
- Added automatic session cleanup after redirect
- Added comprehensive OAuth redirect documentation (OAUTH_REDIRECT_CHANGES.md)

#### User Multi-Role Support
- Added `roles: string[]` field to User model for multiple roles per user
- Added `hasRole(role)` helper method to User model
- Added backward compatibility support for `isAdmin` field
- Added `UserRole` enum export in main index

#### TypeScript Enhancements
- Added `src/types/express-session.d.ts` for session type extensions
- Added triple-slash directive in routes for type safety
- Added full TypeScript support for custom session properties

#### New Configuration Options
- Added `roleHierarchy` option to `DAuthOptions` for custom role configuration
- Added `ALLOWED_REDIRECT_URLS` environment variable
- Added `SOCIAL_LOGIN_SUCCESS_URL` environment variable
- Added `SOCIAL_LOGIN_FAILURE_URL` environment variable

#### Documentation
- Added `RELEASE_NOTES.md` with comprehensive release information
- Added `RBAC_HIERARCHY.md` for RBAC documentation
- Added `OAUTH_REDIRECT_CHANGES.md` for OAuth redirect implementation guide
- Added migration guide in RELEASE_NOTES.md

### 🔧 Changed

#### OAuth Implementation Refactored
- Simplified `googleLoginCallback` in authController (removed user creation logic)
- Simplified `facebookLoginCallback` in authController (removed user creation logic)
- User creation now handled exclusively in Passport strategies
- Reduced callback code by ~70%
- OAuth callbacks now decode `state` parameter for redirect URLs

#### Middleware Architecture Improved
- Enhanced `authenticateApiMiddleware` with role array support
- Added role hierarchy checking to authentication middleware
- Improved error messages with specific role requirements
- Router-level protection now recommended over path-based checking

#### TypeScript Configuration
- Changed `tsconfig.json` include from `["src"]` to `["src/**/*"]`
- Now includes all type definition files in compilation

#### Route Handling
- `/auth/google` now validates redirect URL against whitelist
- `/auth/google/callback` now supports dynamic failure redirect
- `/auth/facebook` now validates redirect URL against whitelist
- `/auth/facebook/callback` now supports dynamic failure redirect
- All OAuth routes now use base64-encoded state parameter

### 🐛 Fixed

#### Session Data Persistence
- **Fixed**: Session data not persisting through OAuth flow
- **Solution**: Use OAuth `state` parameter instead of session storage
- **Impact**: More reliable redirect URL handling

#### TypeScript Compilation Errors
- **Fixed**: `Property 'oauthRedirectUrl' does not exist on type 'Session'`
- **Solution**: Added proper type definitions in `src/types/express-session.d.ts`
- **Impact**: No more compilation errors for custom session properties

#### Duplicate User Creation
- **Fixed**: OAuth callbacks creating duplicate users
- **Solution**: Removed user creation logic from controllers
- **Impact**: Cleaner code, single source of truth for user creation

#### Role Checking
- **Fixed**: Admin-only routes not supporting new roles array
- **Solution**: Enhanced `authenticateApiMiddleware` with role array checking
- **Impact**: Backward compatible with both `isAdmin` and `roles` array

### 📝 Deprecated

- `authenticateApiMiddleware` - Use `requireRoles()` instead (will be removed in v4.0.0)
- `IUser.isAdmin` field - Use `IUser.roles` array (kept for backward compatibility)
- Direct OAuth JSON responses - OAuth now redirects to frontend

### 🗑️ Removed

- User creation logic from OAuth controllers (moved to Passport strategies)
- Redundant session save logic in OAuth routes

---

## [1.2.0] - 2024-06-10
### Added
- Integrated Google login support via environment variables.
- Added company details and contact information in authentication middleware configuration.
- Implemented rate limiting for authentication routes.
- Added CORS options with dynamic origin support.
- Configured session options for authentication, including secure cookies and maxAge.
- Added routes for privacy policy and terms of service serving static HTML files.
- Added public and private API routes with authentication middleware.

### Changed
- Updated authentication middleware to support new configuration options.
- Improved session management and security settings.

### Fixed
- Minor bug fixes and improvements in authentication flow.

# Changelog

## [1.2.1] - 2025-08-18
### Changed
- Updated `app.ts` to use environment variables for Google login, session, and CORS configuration.
- Improved session cookie settings for security and compatibility.
- Refined rate limiting message and options.
- Updated privacy policy and terms of service routes to serve static HTML files from the public directory.

### Added
- Added explicit public and private API routes with authentication middleware.

### Fixed
- Minor improvements in route handling and middleware usage.

## [1.2.0] - 2024-06-10
### Added
- Integrated Google login support via environment variables.
- Added company details and contact information in authentication middleware configuration.
- Implemented rate limiting for authentication routes.
- Added CORS options with dynamic origin support.
- Configured session options for authentication, including secure cookies and maxAge.
- Added routes for privacy policy and terms of service serving static HTML files.
- Added public and private API routes with authentication middleware.

### Changed
- Updated authentication middleware to support new configuration options.
- Improved session management and security settings.

### Fixed
- Minor bug fixes and improvements in authentication flow.


## Migration Guides

### Migrating to 3.0.0 from 2.x.x

#### 1. Update Middleware Initialization
```typescript
// Before (2.x.x)
dAuthMiddleware(app, {
  mongoDbUri: process.env.MONGO_URI!,
  sessionSecret: process.env.SESSION_SECRET!,
});

// After (3.0.0)
dAuthMiddleware({
  mongoDbUri: process.env.MONGO_URI!,
  sessionSecret: process.env.SESSION_SECRET!,
})(app);
```

#### 2. Replace authenticateApiMiddleware
```typescript
// Before (2.x.x)
app.use('/api', authenticateApiMiddleware);

// After (3.0.0)
const publicRouter = express.Router();
app.use('/api/public', requireRoles([]), publicRouter);

const userRouter = express.Router();
app.use('/api/user', requireRoles([UserRole.USER]), userRouter);

const adminRouter = express.Router();
app.use('/api/admin', requireRoles([UserRole.ADMIN]), adminRouter);
```

#### 3. Add Environment Variables
```env
# Add these to your .env file
ALLOWED_REDIRECT_URLS=http://localhost:3000,https://yourdomain.com
SOCIAL_LOGIN_SUCCESS_URL=http://localhost:3000/dashboard
SOCIAL_LOGIN_FAILURE_URL=http://localhost:3000/login
```

#### 4. Update OAuth Frontend Flow
```typescript
// Before (2.x.x)
window.location.href = 'http://localhost:3000/auth/google';
// Expected JSON response with user data

// After (3.0.0)
const redirectUrl = window.location.origin + '/dashboard';
window.location.href = `http://localhost:3000/auth/google?redirectUrl=${encodeURIComponent(redirectUrl)}`;
// Expected redirect to frontend with session cookie
```

#### 5. Use Roles Array (Recommended)
```typescript
// Before (2.x.x)
if (user.isAdmin) {
  // Admin logic
}

// After (3.0.0) - Recommended
if (user.hasRole(UserRole.ADMIN)) {
  // Admin logic
}
// or
if (user.roles.includes(UserRole.ADMIN)) {
  // Admin logic
}
```

---

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to this project.

---

## Support

- **Documentation**: See README.md, RELEASE_NOTES.md, RBAC_HIERARCHY.md
- **Issues**: https://github.com/dheerajshrivastva-dev/d-auth/issues
- **Discussions**: https://github.com/dheerajshrivastva-dev/d-auth/discussions

---

**Maintained by:** Dheeraj Shrivastava
**License:** MIT
