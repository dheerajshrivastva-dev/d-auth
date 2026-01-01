# 🎣 D-Auth Hooks Reference

Complete guide to all authentication hooks and when they're triggered.

## 📋 Available Hooks

### 1. `onUserRegistered`
**Triggered when:** A new user successfully registers (both standard and OAuth)

**Fired from:**
- `RegisterMiddleware.register()` - Line 75 (standard registration)
- `OAuthMiddleware` - Multiple OAuth flows (Google, Facebook, Apple)

**Data provided:**
```typescript
{
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  isOAuth: boolean;
  provider?: "google" | "facebook" | "apple";
}
```

**Example usage:**
```typescript
hooks: {
  onUserRegistered: async (data) => {
    if (data.isOAuth) {
      console.log(`New ${data.provider} user: ${data.user.email}`);
    } else {
      // Send welcome email
      await emailService.sendWelcomeEmail(data.user.email);
    }
  }
}
```

---

### 2. `onUserLogin`
**Triggered when:** A user successfully logs in (both JWT and Session strategies)

**Fired from:**
- `LoginMiddleware.loginWithJWT()` - Line 147
- `LoginMiddleware.loginWithSession()` - Line 222
- `OAuthMiddleware` - All OAuth callback handlers

**Data provided:**
```typescript
{
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  ip: string;
  deviceName: string;
}
```

**Example usage:**
```typescript
hooks: {
  onUserLogin: async (data) => {
    // Log login activity
    await auditLog.create({
      userId: data.user.id,
      action: 'LOGIN',
      ip: data.ip,
      device: data.deviceName,
      timestamp: new Date()
    });

    // Send security notification
    await emailService.sendLoginNotification(data.user.email, {
      ip: data.ip,
      device: data.deviceName
    });
  }
}
```

---

### 3. `onUserLogout`
**Triggered when:** A user logs out

**Fired from:**
- `LogoutMiddleware.logoutWithJWT()` - Line 46
- `LogoutMiddleware.logoutAllSessionsWithJWT()` - Line 93

**Data provided:**
```typescript
{
  userId: string;
  sessionId: string;
}
```

**Example usage:**
```typescript
hooks: {
  onUserLogout: async (data) => {
    // Clear user cache
    await cache.del(`user:${data.userId}:session:${data.sessionId}`);

    // Log logout event
    console.log(`User ${data.userId} logged out from session ${data.sessionId}`);
  }
}
```

---

### 4. `onUserCreatedWithTempPassword`
**Triggered when:** Admin creates a user with a temporary password

**Fired from:**
- `AdminCreateUserMiddleware.adminCreateUser()` - Line 95

**Data provided:**
```typescript
{
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  temporaryPassword: string;
  email: string;
}
```

**Example usage:**
```typescript
hooks: {
  onUserCreatedWithTempPassword: async (data) => {
    // Send welcome email with temporary password
    await emailService.sendWelcomeEmailWithTempPassword({
      to: data.email,
      subject: 'Welcome! Your account has been created',
      temporaryPassword: data.temporaryPassword,
      user: data.user
    });

    console.log(`Temporary password sent to ${data.email}`);
  }
}
```

---

### 5. `onPasswordReset`
**Triggered when:** User successfully resets their password

**Fired from:**
- `PasswordResetMiddleware.verifyOTPAndResetPassword()` - Line 131
- `AdminCreateUserMiddleware.forcePasswordReset()` - Line 212

**Data provided:**
```typescript
{
  user: {
    id: string;
    email: string;
  };
  ip: string;
}
```

**Example usage:**
```typescript
hooks: {
  onPasswordReset: async (data) => {
    // Send confirmation email
    await emailService.sendPasswordResetConfirmation(data.user.email);

    // Log security event
    await auditLog.create({
      userId: data.user.id,
      action: 'PASSWORD_RESET',
      ip: data.ip,
      timestamp: new Date()
    });
  }
}
```

---

### 6. `onOTPGenerated`
**Triggered when:** An OTP is generated for various purposes

**Fired from:**
- `PasswordResetMiddleware.generateOTP()` - Line 52 (forget password)
- `PasswordResetMiddleware.verify2FASetup()` - Line 213 (2FA verification)

**Data provided:**
```typescript
{
  email: string;
  otp: string;
  userId: string;
  otpType: "ForgetPassword" | "VerifyEmail" | "Verify2FA" | "VerifyPhone";
  sessionId: string;
  expiresInMinutes: number;
}
```

**Example usage:**
```typescript
hooks: {
  onOTPGenerated: async (data) => {
    if (data.otpType === 'ForgetPassword') {
      // Send password reset OTP email
      await emailService.sendPasswordResetOTP({
        to: data.email,
        otp: data.otp,
        expiresInMinutes: data.expiresInMinutes
      });
    } else if (data.otpType === 'Verify2FA') {
      // Send 2FA setup verification OTP
      await emailService.send2FAVerificationOTP({
        to: data.email,
        otp: data.otp
      });
    }
  }
}
```

---

### 7. `onAccountLocked`
**Triggered when:** Account is locked due to multiple failed login attempts

**Fired from:**
- `LoginMiddleware.loginWithJWT()` - Line 87

**Data provided:**
```typescript
{
  user: {
    id: string;
    email: string;
  };
  failedAttempts: number;
  lockedUntil: Date;
}
```

**Example usage:**
```typescript
hooks: {
  onAccountLocked: async (data) => {
    // Send security alert email
    await emailService.sendAccountLockedNotification({
      to: data.user.email,
      failedAttempts: data.failedAttempts,
      lockedUntil: data.lockedUntil
    });

    // Alert security team
    await securityAlerts.accountLocked(data.user.id);
  }
}
```

---

### 8. `on2FAEnabled`
**Triggered when:** User enables two-factor authentication

**Fired from:**
- Currently not implemented (TODO)

**Data provided:**
```typescript
{
  user: {
    id: string;
    email: string;
  };
  backupCodesCount: number;
}
```

---

### 9. `on2FADisabled`
**Triggered when:** User disables two-factor authentication

**Fired from:**
- Currently not implemented (TODO)

**Data provided:**
```typescript
{
  userId: string;
}
```

---

## 📊 Hook Execution Summary

| Hook | Implementation Status | Middleware | Frequency |
|------|---------------------|------------|-----------|
| `onUserRegistered` | ✅ Implemented | Register, OAuth | Once per registration |
| `onUserLogin` | ✅ Implemented | Login, OAuth | Every login |
| `onUserLogout` | ✅ Implemented | Logout | Every logout |
| `onUserCreatedWithTempPassword` | ✅ Implemented | AdminCreateUser | Admin user creation |
| `onPasswordReset` | ✅ Implemented | PasswordReset, AdminForceReset | Password reset |
| `onOTPGenerated` | ✅ Implemented | PasswordReset | OTP generation |
| `onAccountLocked` | ✅ Implemented | Login | Account lockout |
| `on2FAEnabled` | ⏳ TODO | TwoFactorAuth | 2FA setup |
| `on2FADisabled` | ⏳ TODO | TwoFactorAuth | 2FA removal |

---

## 🎯 Complete Implementation Example

```typescript
import { DAuth } from 'd-auth';
import { MongoDBAdapter } from 'd-auth/adapters';
import emailService from './services/emailService';
import auditLogger from './services/auditLogger';

const dAuth = new DAuth({
  database: new MongoDBAdapter(process.env.MONGODB_URI!),
  strategy: 'jwt',
  jwt: {
    secret: process.env.JWT_SECRET!,
    tokenMode: 'cookie',
    invalidationStrategy: 'blacklist',
  },
  hooks: {
    // User Registration
    onUserRegistered: async (data) => {
      if (data.isOAuth) {
        await emailService.sendOAuthWelcome(data.user.email, data.provider!);
      } else {
        await emailService.sendWelcomeEmail(data.user.email);
      }
      await auditLogger.log('USER_REGISTERED', data.user.id);
    },

    // User Login
    onUserLogin: async (data) => {
      await emailService.sendLoginNotification(data.user.email, {
        ip: data.ip,
        device: data.deviceName,
      });
      await auditLogger.log('USER_LOGIN', data.user.id, {
        ip: data.ip,
        device: data.deviceName,
      });
    },

    // User Logout
    onUserLogout: async (data) => {
      await auditLogger.log('USER_LOGOUT', data.userId, {
        sessionId: data.sessionId,
      });
    },

    // Admin Created User with Temp Password
    onUserCreatedWithTempPassword: async (data) => {
      await emailService.sendWelcomeWithTempPassword({
        to: data.email,
        user: data.user,
        temporaryPassword: data.temporaryPassword,
      });
      await auditLogger.log('ADMIN_USER_CREATED', data.user.id);
    },

    // Password Reset
    onPasswordReset: async (data) => {
      await emailService.sendPasswordResetConfirmation(data.user.email);
      await auditLogger.log('PASSWORD_RESET', data.user.id, { ip: data.ip });
    },

    // OTP Generated
    onOTPGenerated: async (data) => {
      if (data.otpType === 'ForgetPassword') {
        await emailService.sendPasswordResetOTP(data.email, data.otp, data.expiresInMinutes);
      } else if (data.otpType === 'Verify2FA') {
        await emailService.send2FASetupOTP(data.email, data.otp);
      }
    },

    // Account Locked
    onAccountLocked: async (data) => {
      await emailService.sendAccountLockedAlert(data.user.email, {
        failedAttempts: data.failedAttempts,
        lockedUntil: data.lockedUntil,
      });
      await auditLogger.log('ACCOUNT_LOCKED', data.user.id, {
        failedAttempts: data.failedAttempts,
      });
    },
  },
});

export default dAuth;
```

---

## ✅ Best Practices

1. **Always handle errors in hooks** - Don't let hook failures break auth flow
2. **Keep hooks fast** - Use background jobs for heavy operations
3. **Log hook failures** - For debugging and monitoring
4. **Use async/await** - All hooks support async operations
5. **Don't modify request/response** - Hooks are for side effects only

Example with error handling:

```typescript
hooks: {
  onUserLogin: async (data) => {
    try {
      await emailService.sendLoginNotification(data.user.email, {
        ip: data.ip,
        device: data.deviceName,
      });
    } catch (error) {
      // Log but don't fail the login
      console.error('Failed to send login notification:', error);
      await logger.error('HOOK_ERROR', { hook: 'onUserLogin', error });
    }
  }
}
```
