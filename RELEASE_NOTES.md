# D-Auth Release Notes - Version 3.0.0

**Release Date:** TBD
**Type:** Major Release (Breaking Changes)

---

## 🚨 Breaking Changes

### 1. Middleware Initialization Pattern Changed

**Old Pattern (< v3.0.0):**
```typescript
dAuthMiddleware(app, options);
```

**New Pattern (>= v3.0.0):**
```typescript
dAuthMiddleware(options)(app);
```

**Migration:**
```typescript
// ❌ Old way
import { dAuthMiddleware } from '@dheerajshrivastva-dev/d-auth';
dAuthMiddleware(app, {
  mongoDbUri: process.env.MONGO_URI!,
  sessionSecret: process.env.SESSION_SECRET!,
});

// ✅ New way
import { dAuthMiddleware } from '@dheerajshrivastva-dev/d-auth';
dAuthMiddleware({
  mongoDbUri: process.env.MONGO_URI!,
  sessionSecret: process.env.SESSION_SECRET!,
})(app);
```

**Reason:** Follows proper Express middleware pattern using higher-order functions.

---

### 2. OAuth Callbacks Now Redirect Instead of JSON Response

**Old Behavior (< v3.0.0):**
```typescript
// OAuth callback returned JSON
GET /auth/google/callback
Response: { message: 'Login successful', user: {...}, accessToken: '...' }
```

**New Behavior (>= v3.0.0):**
```typescript
// OAuth callback now redirects to frontend
GET /auth/google/callback
Response: 302 Redirect to frontend with session cookie
```

**Migration:**
- Update frontend to handle redirect flow instead of JSON response
- Access tokens and user data are now available via session cookies
- Use `/auth/refresh-token` endpoint to get access tokens

---

### 3. `authenticateApiMiddleware` is Deprecated

**Deprecated:**
```typescript
app.use('/api', authenticateApiMiddleware);
```

**Use Instead:**
```typescript
// New RBAC-based approach
app.use('/api/public', requireRoles([]), publicRouter);
app.use('/api/user', requireRoles([UserRole.USER]), userRouter);
app.use('/api/admin', requireRoles([UserRole.ADMIN]), adminRouter);
```

**Reason:** The new unified `requireRoles()` middleware provides cleaner, more flexible role-based access control with hierarchy support.

---

## ✨ New Features

### 1. Role-Based Access Control (RBAC) with Hierarchy

**Major Enhancement:** Complete RBAC system with automatic role hierarchy.

```typescript
import { requireRoles, UserRole } from '@dheerajshrivastva-dev/d-auth';

// Router-level protection (Recommended)
const adminRouter = express.Router();
app.use('/api/admin', requireRoles([UserRole.ADMIN]), adminRouter);
// All routes in adminRouter require admin role

// Single route protection
app.get('/api/employee/dashboard',
  requireRoles([UserRole.EMPLOYEE]),
  handler
);

// Multiple role options (user needs ANY of these roles or higher)
app.get('/api/staff/schedule',
  requireRoles([UserRole.STAFF, UserRole.EMPLOYEE]),
  handler
);

// Public route - no authentication required
app.get('/api/public/data',
  requireRoles([]),
  handler
);
```

**Built-in Role Hierarchy:**
```
ADMIN (100)           ← Full access
  └─ MODERATOR (80)   ← Can access manager and below
      └─ MANAGER (60)
          └─ SUPERVISOR (40)
              └─ EMPLOYEE (20)
                  └─ STAFF (10)
                      └─ USER (0) ← Base level
```

**Custom Hierarchy:**
```typescript
dAuthMiddleware({
  // ... other options
  roleHierarchy: {
    'ceo': 100,
    'cto': 90,
    'manager': 50,
    'developer': 20,
    'guest': 0
  }
})(app);
```

**New Exports:**
- `UserRole` - Enum with predefined roles
- `requireRoles(roles: string[])` - Unified RBAC middleware (recommended)
  - Empty array `[]` = Public route (no auth)
  - Single role = Requires that role or higher
  - Multiple roles = Requires ANY of these roles (or higher)
- `getRoleHierarchyManager()` - Access hierarchy manager programmatically
- `initializeRoleHierarchy(config)` - Initialize custom hierarchy

---

### 2. Dynamic OAuth Redirect URLs

**Major Enhancement:** Support for multiple frontends with a single backend.

**Features:**
- Dynamic redirect URLs passed via query parameter
- Whitelist-based security validation
- OAuth 2.0 `state` parameter for reliable data passing
- Supports multiple environments (dev, staging, production)

**Configuration:**
```env
# Whitelist allowed redirect URLs (comma-separated)
ALLOWED_REDIRECT_URLS=http://localhost:3000,https://staging.myapp.com,https://myapp.com

# Default fallback URLs
SOCIAL_LOGIN_SUCCESS_URL=https://myapp.com/dashboard
SOCIAL_LOGIN_FAILURE_URL=https://myapp.com/login
```

**Frontend Usage:**
```typescript
// Frontend initiates OAuth with redirectUrl
const handleGoogleLogin = () => {
  const redirectUrl = `${window.location.origin}/dashboard`;
  window.location.href = `https://api.myapp.com/auth/google?redirectUrl=${encodeURIComponent(redirectUrl)}`;
};
```

**Backend Behavior:**
1. Validates `redirectUrl` against whitelist
2. Encodes it in OAuth `state` parameter (base64)
3. After successful auth, redirects to specified URL
4. Falls back to `SOCIAL_LOGIN_SUCCESS_URL` if not provided

**Security:**
- ✅ Whitelist validation prevents open redirect attacks
- ✅ Session-based storage as backup
- ✅ Automatic cleanup after redirect

---

### 3. User Roles Array (Multi-Role Support)

**New Schema Field:**
```typescript
interface IUser {
  roles: string[];  // NEW: Array of roles
  isAdmin: boolean; // DEPRECATED: kept for backward compatibility
}
```

**Features:**
- Users can have multiple roles simultaneously
- Backward compatible with `isAdmin` field
- New `hasRole(role)` helper method

**Usage:**
```typescript
import { User, UserRole } from '@dheerajshrivastva-dev/d-auth';

// Assign roles during creation
const user = new User({
  email: 'user@example.com',
  roles: [UserRole.USER, UserRole.EMPLOYEE]
});

// Update user roles
user.roles.push(UserRole.MANAGER);
await user.save();

// Check if user has a role
if (user.hasRole(UserRole.ADMIN)) {
  // Admin logic
}
```

---

### 4. Enhanced Session Type Safety

**New TypeScript Definitions:**
```typescript
// src/types/express-session.d.ts
declare module 'express-session' {
  interface SessionData {
    oauthRedirectUrl?: string;
  }
}
```

**Benefits:**
- Full TypeScript support for custom session properties
- No more compilation errors for session extensions
- Better IDE autocomplete

---

### 5. Role Hierarchy Manager

**New Class:** `RoleHierarchyManager`

**Methods:**
```typescript
const hierarchy = getRoleHierarchyManager();

// Get role level
const level = hierarchy.getRoleLevel('manager'); // 60

// Check if user can access a role
const canAccess = hierarchy.canAccessRole('admin', 'employee'); // true

// Check if user has any of the required roles
const hasAny = hierarchy.hasAnyAccess(['employee'], ['manager', 'employee']); // true

// Get all roles accessible to a user
const accessible = hierarchy.getAccessibleRoles('manager');
// ['manager', 'supervisor', 'employee', 'staff', 'user']
```

---

## 🔧 Improvements

### 1. OAuth Callback Logic Refactored

**Before:**
- Callbacks handled user creation, token generation, session management, AND response
- Code duplication between Google and Facebook callbacks
- Mixed concerns

**After:**
- Passport strategies handle user creation (in `passportConfig.ts`)
- Callbacks only handle redirect logic
- Clean separation of concerns
- Reduced code duplication by ~70%

**Files Changed:**
- `src/controllers/authController.ts`: Simplified callbacks
- `src/routes/authRoutes.ts`: Added state parameter handling

---

### 2. TypeScript Configuration Improved

**Changes:**
```json
{
  "include": ["src/**/*"],  // Changed from ["src"]
}
```

**Benefits:**
- Includes all type definition files in `src/types/`
- Better TypeScript error detection
- Fixes compilation errors for custom type definitions

---

### 3. Middleware Architecture Enhanced

**Before:**
- Single `authenticateApiMiddleware` for all routes
- Path-based admin checking (`/admin/*`)
- No role hierarchy

**After:**
- Unified `requireRoles(roles: string[])` middleware function
- Role-based checking with hierarchy
- Router-level and route-level protection
- Public route support (empty array)

---

### 4. Better Error Messages

**Enhanced HTTP Responses:**
```typescript
// Before
res.status(403).json({ message: 'Unauthorized' });

// After
res.status(403).send(
  new HTTPResponse({
    statusCode: HttpStatus.FORBIDDEN.code,
    httpStatus: HttpStatus.FORBIDDEN.status,
    message: 'Access denied. Required role: manager or higher'
  })
);
```

---

## 🐛 Bug Fixes

### 1. Session Data Not Persisting Through OAuth Flow

**Issue:** Custom session properties lost during Passport OAuth redirects

**Root Cause:** Passport session management overwrote custom session data

**Fix:**
- Use OAuth `state` parameter instead of session storage
- State parameter preserved by OAuth providers (Google, Facebook)
- More reliable than session-based approach

**Files:**
- `src/routes/authRoutes.ts`: Implements state parameter
- `src/controllers/authController.ts`: Decodes state parameter

---

### 2. TypeScript Compilation Errors for Session Properties

**Issue:**
```
error TS2339: Property 'oauthRedirectUrl' does not exist on type 'Session'
```

**Fix:**
- Created `src/types/express-session.d.ts` with proper type declarations
- Updated `tsconfig.json` to include type definitions
- Added triple-slash directive in routes file

---

### 3. OAuth Callbacks Created Duplicate Users

**Issue:** User creation logic in both Passport strategy AND controller

**Fix:**
- Removed user creation from controllers
- Centralized in Passport strategies
- Controllers now only handle response/redirect logic

---

## 📊 Statistics

### Code Changes:
- **Files Modified:** 10
- **Files Added:** 4
- **Lines Added:** +1,304
- **Lines Removed:** -250
- **Net Change:** +1,054 lines

### Key Files:
- `src/middleware/authMiddleware.ts`: +268 lines (RBAC implementation)
- `src/routes/authRoutes.ts`: +35 lines (OAuth redirect)
- `src/config/roleHierarchy.ts`: +157 lines (new file)
- `src/types/express-session.d.ts`: +7 lines (new file)
- `src/controllers/authController.ts`: -13 lines (simplified)

---

## 📚 Documentation

### New Documentation Files:
1. **OAUTH_REDIRECT_CHANGES.md** - Complete OAuth redirect implementation guide
2. **RBAC_HIERARCHY.md** - Role-based access control documentation
3. **RELEASE_NOTES.md** - This file

### Updated Documentation:
- **README.md** - Complete rewrite with RBAC examples

---

## 🔄 Migration Guide

### Step 1: Update Middleware Initialization

```typescript
// Old
dAuthMiddleware(app, options);

// New
dAuthMiddleware(options)(app);
```

### Step 2: Replace authenticateApiMiddleware

```typescript
// Old
app.use('/api', authenticateApiMiddleware);
app.get('/api/admin/users', handler);

// New
const adminRouter = express.Router();
adminRouter.get('/users', handler);
app.use('/api/admin', requireRoles([UserRole.ADMIN]), adminRouter);
```

### Step 3: Add Environment Variables

```env
ALLOWED_REDIRECT_URLS=http://localhost:3000,https://yourdomain.com
SOCIAL_LOGIN_SUCCESS_URL=http://localhost:3000/dashboard
SOCIAL_LOGIN_FAILURE_URL=http://localhost:3000/login
```

### Step 4: Update User Model Usage

```typescript
// Old
if (user.isAdmin) { /* ... */ }

// New (recommended)
if (user.roles.includes(UserRole.ADMIN)) { /* ... */ }
// or
if (user.hasRole(UserRole.ADMIN)) { /* ... */ }
```

### Step 5: Update Frontend OAuth Flow

```typescript
// Old
window.location.href = 'http://localhost:3000/auth/google';
// Expected JSON response

// New
const redirectUrl = window.location.origin + '/dashboard';
window.location.href = `http://localhost:3000/auth/google?redirectUrl=${encodeURIComponent(redirectUrl)}`;
// Expect redirect response with session cookie
```

---

## ⚠️ Deprecation Notices

### Deprecated Features (will be removed in v4.0.0):

1. **`authenticateApiMiddleware`**
   - Use: `requireRoles(roles: string[])`
   - Migration guide above

2. **`IUser.isAdmin` field**
   - Use: `IUser.roles` array
   - `isAdmin` still works for backward compatibility

3. **Direct OAuth JSON responses**
   - OAuth now redirects to frontend
   - Use session cookies for authentication state

---

## 🎯 Recommended Actions

### For Existing Users:

1. ✅ Update middleware initialization pattern
2. ✅ Migrate from `authenticateApiMiddleware` to `requireRoles()`
3. ✅ Add OAuth redirect environment variables
4. ✅ Update frontend OAuth flow to handle redirects
5. ✅ Test RBAC with your existing roles

### For New Users:

1. ✅ Use `requireRoles()` for all route protection
2. ✅ Configure OAuth redirect URLs in `.env`
3. ✅ Use role hierarchy for cleaner access control
4. ✅ Review RBAC examples in README.md

---

## 📦 Installation

```bash
npm install @dheerajshrivastva-dev/d-auth@3.0.0
```

---

## 🔗 Resources

- **GitHub:** https://github.com/dheerajshrivastva-dev/d-auth
- **Issues:** https://github.com/dheerajshrivastva-dev/d-auth/issues
- **Documentation:** See README.md, RBAC_HIERARCHY.md, OAUTH_REDIRECT_CHANGES.md

---

## 🙏 Credits

**Contributors:**
- Dheeraj Shrivastava - Core development

**Special Thanks:**
- All users who reported issues and provided feedback
- Express.js and Passport.js communities

---

**Release Manager:** Dheeraj Shrivastava
**Date:** TBD
**Version:** 3.0.0
