# d-auth v4.0.0 - New Features

This document describes the additional features added to d-auth v4.0.0.

## 1. OAuth Authentication (Google, Facebook, Apple)

Complete OAuth login/registration support for major providers.

### Features

- Auto-creates user account on first OAuth login
- Links OAuth account to existing email if found
- Generates JWT/session tokens after OAuth
- Calls `onUserRegistered` hook for new OAuth users
- Supports both JWT and Session modes

### Usage

```typescript
import { DAuth, MongoDBAdapter } from 'd-auth';

const dAuth = new DAuth({
  database: new MongoDBAdapter({ uri: process.env.MONGO_URI }),
  jwt: { secret: process.env.JWT_SECRET },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
    facebook: {
      clientId: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: '/auth/facebook/callback',
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
      callbackURL: '/auth/apple/callback',
    },
  },
  hooks: {
    onUserRegistered: async (data) => {
      if (data.isOAuth) {
        console.log(`New ${data.provider} user:`, data.user.email);
      }
    },
  },
});

// Google OAuth routes
app.get('/auth/google', dAuth.middleware.googleAuth);
app.get('/auth/google/callback', dAuth.middleware.googleCallback);

// Facebook OAuth routes
app.get('/auth/facebook', dAuth.middleware.facebookAuth);
app.get('/auth/facebook/callback', dAuth.middleware.facebookCallback);

// Apple OAuth routes
app.get('/auth/apple', dAuth.middleware.appleAuth);
app.post('/auth/apple/callback', dAuth.middleware.appleCallback);
```

## 2. Temporary Password for Admin-Created Users

Admins can create users with auto-generated temporary passwords that must be reset before first login.

### Features

- Auto-generates secure 12-character temporary password
- Marks password as temporary in database
- Forces password reset before first login
- Sends temporary password via `onUserCreatedWithTempPassword` hook
- Auto-verifies user after password reset

### Usage

```typescript
const dAuth = new DAuth({
  database: adapter,
  jwt: { secret: '...' },
  hooks: {
    // Send temporary password via email
    onUserCreatedWithTempPassword: async (data) => {
      await emailQueue.add('send-temp-password', {
        to: data.email,
        subject: 'Welcome! Your Temporary Password',
        template: 'temp-password',
        context: {
          name: data.user.firstName,
          email: data.email,
          temporaryPassword: data.temporaryPassword,
        },
      });
    },
  },
});

// Admin creates user (requires admin role)
app.post(
  '/admin/create-user',
  dAuth.requireRoles(['admin']),
  dAuth.middleware.adminCreateUser
);

// User must reset password before login
app.post('/auth/force-password-reset', dAuth.middleware.forcePasswordReset);
```

### Request/Response Examples

**Admin creates user:**

```bash
POST /admin/create-user
{
  "email": "newuser@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "roles": ["user", "employee"]
}
```

**Response:**

```json
{
  "statusCode": 200,
  "httpStatus": "OK",
  "message": "User created successfully. Temporary password sent to email.",
  "data": {
    "user": {
      "id": "user123",
      "email": "newuser@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "roles": ["user", "employee"],
      "mustResetPassword": true
    }
  }
}
```

**User resets password:**

```bash
POST /auth/force-password-reset
{
  "email": "newuser@example.com",
  "temporaryPassword": "aB3$xY9@zK2p",
  "newPassword": "MyNewSecurePassword123!"
}
```

## 3. Failed Login Attempts Tracking & Account Locking

Automatically locks accounts after 3 failed login attempts to prevent brute force attacks.

### Features

- Tracks failed login attempts per user
- Locks account for 15 minutes after 3 failed attempts
- Auto-resets counter on successful login
- Allows password reset to unlock account
- Calls `onAccountLocked` hook when account is locked
- Shows remaining attempts to user

### Database Fields Added

```typescript
interface IUserDocument {
  // ... existing fields
  failedLoginAttempts?: number; // Count of failed login attempts
  lastFailedLoginAt?: Date; // Timestamp of last failed login
  accountLockedUntil?: Date; // Lock account until this time
}
```

### Login Flow

1. **First Failed Attempt**: Returns "Incorrect email or password. Attempts remaining: 2"
2. **Second Failed Attempt**: Returns "Incorrect email or password. Attempts remaining: 1"
3. **Third Failed Attempt**: Account locked for 15 minutes
4. **Successful Login**: Resets failed attempts counter to 0
5. **Password Reset**: Unlocks account immediately

### Hook Example

```typescript
const dAuth = new DAuth({
  database: adapter,
  jwt: { secret: '...' },
  hooks: {
    onAccountLocked: async (data) => {
      // Notify user via email
      await emailQueue.add('account-locked', {
        to: data.user.email,
        subject: 'Account Locked - Security Alert',
        template: 'account-locked',
        context: {
          email: data.user.email,
          failedAttempts: data.failedAttempts,
          lockedUntil: data.lockedUntil,
        },
      });

      // Log security event
      await securityLogger.log({
        event: 'ACCOUNT_LOCKED',
        userId: data.user.id,
        failedAttempts: data.failedAttempts,
        lockedUntil: data.lockedUntil,
      });
    },
  },
});
```

### Login Response Examples

**Failed login (1st attempt):**

```json
{
  "message": "Incorrect email or password.",
  "attemptsRemaining": 2
}
```

**Failed login (3rd attempt - account locked):**

```json
{
  "message": "Account locked due to multiple failed login attempts. Your account will be unlocked in 15 minutes or you can reset your password."
}
```

**Login attempt while locked:**

```json
{
  "message": "Account is temporarily locked due to multiple failed login attempts. Please try again later or reset your password."
}
```

**Login with temporary password:**

```json
{
  "message": "You must reset your password before logging in. Please use the force password reset endpoint.",
  "requiresPasswordReset": true
}
```

## Updated Database Adapter Interface

The `IDatabaseAdapter` interface now includes methods for the new features:

```typescript
interface IDatabaseAdapter {
  // ... existing methods

  // Failed login tracking
  incrementFailedLoginAttempts(userId: string): Promise<number>;
  resetFailedLoginAttempts(userId: string): Promise<void>;
  lockAccount(userId: string, lockUntil: Date): Promise<void>;
  isAccountLocked(userId: string): Promise<boolean>;
}
```

## Updated Hooks Interface

New hooks available:

```typescript
interface DAuthHooks {
  // ... existing hooks

  /**
   * Called when admin creates a user with temporary password
   */
  onUserCreatedWithTempPassword?: (data: {
    user: any;
    temporaryPassword: string;
    email: string;
  }) => Promise<void> | void;

  /**
   * Called when account is locked due to failed login attempts
   */
  onAccountLocked?: (data: {
    user: any;
    failedAttempts: number;
    lockedUntil: Date;
  }) => Promise<void> | void;
}
```

## Complete Middleware List

The `dAuth.middleware` object now includes:

```typescript
{
  // Basic auth
  register: RequestHandler;
  login: RequestHandler;
  logout: RequestHandler;
  refresh: RequestHandler;

  // Password reset
  forgotPassword: RequestHandler;
  resetPassword: RequestHandler;
  resendOTP: RequestHandler;

  // OAuth
  googleAuth: RequestHandler;
  googleCallback: RequestHandler;
  facebookAuth: RequestHandler;
  facebookCallback: RequestHandler;
  appleAuth: RequestHandler;
  appleCallback: RequestHandler;

  // Admin features
  adminCreateUser: RequestHandler;
  forcePasswordReset: RequestHandler;
}
```

## Complete Example

```typescript
import express from 'express';
import { DAuth, MongoDBAdapter } from 'd-auth';
import { emailQueue } from './services/emailQueue';

const app = express();
const dAuth = new DAuth({
  database: new MongoDBAdapter({ uri: process.env.MONGO_URI }),
  jwt: {
    secret: process.env.JWT_SECRET,
    tokenMode: 'both',
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
  },
  hooks: {
    onUserCreatedWithTempPassword: async (data) => {
      await emailQueue.add('temp-password', {
        to: data.email,
        temporaryPassword: data.temporaryPassword,
      });
    },
    onAccountLocked: async (data) => {
      await emailQueue.add('account-locked', {
        to: data.user.email,
        lockedUntil: data.lockedUntil,
      });
    },
    onUserRegistered: async (data) => {
      if (data.isOAuth) {
        console.log(`OAuth user registered via ${data.provider}`);
      }
    },
  },
});

// Basic auth routes
app.post('/auth/register', dAuth.middleware.register);
app.post('/auth/login', dAuth.middleware.login);
app.post('/auth/logout', dAuth.middleware.logout);
app.post('/auth/refresh', dAuth.middleware.refresh);

// Password reset routes
app.post('/auth/forgot-password', dAuth.middleware.forgotPassword);
app.post('/auth/reset-password', dAuth.middleware.resetPassword);
app.post('/auth/resend-otp', dAuth.middleware.resendOTP);

// OAuth routes
app.get('/auth/google', dAuth.middleware.googleAuth);
app.get('/auth/google/callback', dAuth.middleware.googleCallback);
app.get('/auth/facebook', dAuth.middleware.facebookAuth);
app.get('/auth/facebook/callback', dAuth.middleware.facebookCallback);

// Admin routes
app.post(
  '/admin/create-user',
  dAuth.requireRoles(['admin']),
  dAuth.middleware.adminCreateUser
);

// Force password reset (for users with temporary password)
app.post('/auth/force-password-reset', dAuth.middleware.forcePasswordReset);

// Protected routes
app.get('/profile', dAuth.requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

app.listen(3000);
```

## Security Benefits

1. **OAuth Support**: Reduces password fatigue, leverages trusted providers
2. **Temporary Passwords**: Ensures admin-created accounts are secure from day one
3. **Failed Login Protection**: Prevents brute force attacks automatically
4. **Account Locking**: Temporary lockout discourages attackers
5. **Forced Password Reset**: Ensures new users choose strong, unique passwords
6. **Automatic Notifications**: Users are informed of security events via hooks

## Migration Notes

### Existing Users

Existing users are **not affected** by these changes. The new fields (`failedLoginAttempts`, `isTemporaryPassword`, etc.) are optional and will default to safe values.

### Database Updates

If using MongoDBAdapter, no migration is needed. The new fields are optional.

If using a custom adapter, implement the new methods:

```typescript
class MyCustomAdapter implements IDatabaseAdapter {
  // ... existing methods

  async incrementFailedLoginAttempts(userId: string): Promise<number> {
    // Increment and return new count
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    // Reset to 0
  }

  async lockAccount(userId: string, lockUntil: Date): Promise<void> {
    // Set accountLockedUntil field
  }

  async isAccountLocked(userId: string): Promise<boolean> {
    // Check if accountLockedUntil > now
  }
}
```
