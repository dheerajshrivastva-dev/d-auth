# d-auth v4.0.0 - Quick Reference

## 🚀 Installation

```bash
npm install d-auth@4.0.0
```

## ⚡ Quick Start

### JWT Cookie Auth (Most Common)

```typescript
import { DAuth, MongoDBAdapter } from 'd-auth';

const dAuth = new DAuth({
  database: new MongoDBAdapter({ uri: process.env.MONGO_URI }),
  strategy: 'jwt',
  jwt: {
    secret: process.env.JWT_SECRET,
    tokenMode: 'cookie',
  },
  hooks: {
    onOTPGenerated: async (data) => {
      await yourEmailService.send(data);
    },
  },
});

app.use(dAuth.initialize());
app.post('/auth/login', dAuth.middleware.login);
app.get('/profile', dAuth.requireAuth(), handler);
```

## 📋 Configuration Cheat Sheet

### Minimal Config

```typescript
new DAuth({
  database: new MongoDBAdapter({ uri: '...' }),
  strategy: 'jwt',
  jwt: { secret: '...' },
  hooks: { onOTPGenerated: async (data) => { /* send email */ } },
})
```

### Full Config

```typescript
new DAuth({
  // Database (REQUIRED)
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI,
    userModel: CustomUserModel, // optional
    otpModel: CustomOTPModel,    // optional
  }),

  // Strategy (REQUIRED ONE)
  strategy: 'jwt' | 'session',

  // JWT Config (if strategy: 'jwt')
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    tokenMode: 'cookie' | 'response' | 'both',
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    },
  },

  // Session Config (if strategy: 'session')
  session: {
    secret: process.env.SESSION_SECRET,
    maxAge: 24 * 60 * 60 * 1000,
    store: 'database' | 'memory' | 'redis',
    redisUrl: process.env.REDIS_URL,
    maxSessionsPerUser: 10,
  },

  // OAuth (optional)
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
  },

  // RBAC (optional)
  roleHierarchy: {
    superadmin: 120,
    admin: 100,
    user: 0,
  },

  // 2FA (optional)
  twoFactor: {
    enabled: true,
    issuer: 'MyApp',
    backupCodesCount: 10,
  },

  // Hooks (optional but recommended)
  hooks: {
    onOTPGenerated: async (data) => { /* ... */ },
    onUserRegistered: async (data) => { /* ... */ },
    onUserLogin: async (data) => { /* ... */ },
  },
})
```

## 🛣️ Available Middleware

### Authentication

```typescript
// Register
app.post('/auth/register', dAuth.middleware.register);

// Login
app.post('/auth/login', dAuth.middleware.login);

// Logout
app.post('/auth/logout', dAuth.middleware.logout);

// Forgot password
app.post('/auth/forgot-password', dAuth.middleware.forgotPassword);

// Reset password
app.post('/auth/reset-password', dAuth.middleware.resetPassword);

// Refresh token
app.post('/auth/refresh', dAuth.middleware.refreshToken);
```

### 2FA

```typescript
// Setup 2FA (returns QR code)
app.post('/auth/2fa/setup', dAuth.requireAuth(), dAuth.services.setup2FA);

// Enable 2FA
app.post('/auth/2fa/enable', dAuth.requireAuth(), dAuth.middleware.enable2FA);

// Verify 2FA during login
app.post('/auth/2fa/verify', dAuth.middleware.verify2FA);

// Disable 2FA
app.post('/auth/2fa/disable', dAuth.requireAuth(), dAuth.middleware.disable2FA);
```

### OAuth

```typescript
// Google
app.get('/auth/google', dAuth.middleware.googleAuth);
app.get('/auth/google/callback', dAuth.middleware.googleCallback);

// Facebook
app.get('/auth/facebook', dAuth.middleware.facebookAuth);
app.get('/auth/facebook/callback', dAuth.middleware.facebookCallback);
```

## 🛡️ Route Protection

### Require Authentication

```typescript
app.get('/profile', dAuth.requireAuth(), (req, res) => {
  res.json({ user: req.user });
});
```

### Require Roles (RBAC)

```typescript
// Single role
app.get('/admin', dAuth.requireRoles(['admin']), handler);

// Multiple roles (OR logic)
app.get('/dashboard', dAuth.requireRoles(['admin', 'manager']), handler);

// Public route (no auth)
app.get('/public', dAuth.requireRoles([]), handler);
```

## 📝 Request/Response Examples

### Register

**Request:**
```json
POST /auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (Cookie mode):**
```json
{
  "user": {
    "id": "123",
    "email": "user@example.com",
    "roles": ["user"]
  }
}
```

**Response (Response mode):**
```json
{
  "user": { "id": "123", "email": "user@example.com" },
  "accessToken": "eyJhbGciOiJIUz...",
  "refreshToken": "eyJhbGciOiJIUz..."
}
```

### Login

**Request:**
```json
POST /auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (with 2FA):**
```json
{
  "requires2FA": true,
  "tempToken": "eyJhbGciOiJIUz..."
}
```

**Response (without 2FA):**
```json
{
  "user": { "id": "123", "email": "user@example.com" },
  "accessToken": "...",
  "refreshToken": "..."
}
```

### Forgot Password

**Request:**
```json
POST /auth/forgot-password
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "OTP sent to email"
}
```

**Hook called:**
```typescript
onOTPGenerated({
  email: "user@example.com",
  otp: "123456",
  userId: "123",
  sessionId: "abc-def-ghi",
  expiresInMinutes: 10
})
```

### Reset Password

**Request:**
```json
POST /auth/reset-password
{
  "sessionId": "abc-def-ghi",
  "otp": "123456",
  "newPassword": "NewSecurePass123!"
}
```

## 🗄️ Database Adapters

### MongoDB

```typescript
import { MongoDBAdapter } from 'd-auth';

const database = new MongoDBAdapter({
  uri: process.env.MONGO_URI,
  userModel: CustomUserModel,  // optional
  maxSessionsPerUser: 10,
});
```

### PostgreSQL (Example)

```typescript
import { PostgresAdapter } from './adapters/PostgresAdapter';

const database = new PostgresAdapter({
  connectionString: process.env.DATABASE_URL,
});
```

### Custom Adapter

```typescript
import { IDatabaseAdapter } from 'd-auth';

class MyAdapter implements IDatabaseAdapter {
  async findUserByEmail(email: string) { /* ... */ }
  async createUser(data) { /* ... */ }
  // ... implement all 23 methods
}
```

## 🪝 Hooks Reference

```typescript
hooks: {
  // OTP generated for password reset or email verification
  onOTPGenerated: async ({ email, otp, userId, otpType, sessionId, expiresInMinutes }) => {
    // Send OTP via email/SMS
  },

  // New user registered
  onUserRegistered: async ({ user, isOAuth, provider }) => {
    // Send welcome email
  },

  // User logged in
  onUserLogin: async ({ user, ip, deviceName }) => {
    // Log login activity
  },

  // Password was reset
  onPasswordReset: async ({ user, ip }) => {
    // Send confirmation email
  },

  // User logged out
  onUserLogout: async ({ userId, sessionId }) => {
    // Cleanup tasks
  },

  // 2FA enabled
  on2FAEnabled: async ({ user, backupCodesCount }) => {
    // Send backup codes email
  },

  // 2FA disabled
  on2FADisabled: async ({ userId }) => {
    // Send notification
  },
}
```

## 🔐 Token Modes Comparison

| Mode | Cookie | Authorization Header | Mobile Apps | Web Apps |
|------|--------|---------------------|-------------|----------|
| `cookie` | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| `response` | ❌ No | ✅ Yes | ✅ Yes | ⚠️ Manual |
| `both` | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

## 🎯 Strategy Selection

```
Mobile App Only          → JWT + Response mode
Traditional Web App      → Session + Database/Redis
Modern SPA               → JWT + Cookie mode
API Backend              → JWT + Response mode
Serverless               → JWT + Response mode
Both Web & Mobile        → JWT + Both mode
Need Immediate Logout    → Session + Redis
Microservices            → JWT + Response mode
```

## 📦 Optional Router

Instead of defining routes individually:

```typescript
// Individual routes
app.post('/auth/login', dAuth.middleware.login);
app.post('/auth/register', dAuth.middleware.register);
// ... 10+ more routes

// Use built-in router
app.use('/auth', dAuth.router);
```

This creates all routes automatically:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/refresh-token`
- `POST /auth/2fa/enable`
- `POST /auth/2fa/verify`
- `POST /auth/2fa/disable`
- `GET /auth/google`
- `GET /auth/google/callback`

## 🧪 Testing

### Mock Database Adapter

```typescript
class MockAdapter implements IDatabaseAdapter {
  private users = new Map();

  async findUserByEmail(email: string) {
    return this.users.get(email) || null;
  }

  async createUser(data: any) {
    const user = { id: '123', ...data };
    this.users.set(data.email, user);
    return user;
  }

  // ... implement other methods
}

const dAuth = new DAuth({
  database: new MockAdapter(),
  // ... other config
});
```

### Mock Hooks

```typescript
const emailsSent = [];

const dAuth = new DAuth({
  hooks: {
    onOTPGenerated: async (data) => {
      emailsSent.push(data); // Collect for assertions
    },
  },
});

// In tests
expect(emailsSent).toHaveLength(1);
expect(emailsSent[0].otp).toMatch(/^\d{6}$/);
```

## 🐛 Common Issues

### Issue: "JWT must be provided"

**Solution:** Check tokenMode and ensure client sends token correctly

```typescript
// Cookie mode
fetch('/api/data', { credentials: 'include' });

// Response mode
fetch('/api/data', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

### Issue: "Session not found"

**Solution:** Ensure session store is configured

```typescript
session: {
  store: 'redis', // Not 'memory' in production
  redisUrl: process.env.REDIS_URL,
}
```

### Issue: "User not found" after login

**Solution:** Check database adapter implementation

```typescript
// Ensure findUserByEmail returns correct format
{
  id: string,
  email: string,
  password: string,
  roles: string[],
  // ... other fields
}
```

## 📚 Full Documentation

- [Architecture Guide](./V4_ARCHITECTURE.md)
- [Authentication Strategies](./AUTHENTICATION_STRATEGIES.md)
- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md)
- [Design Summary](./DESIGN_SUMMARY.md)

## 🆘 Support

- GitHub Issues: [github.com/your-org/d-auth/issues](https://github.com/your-org/d-auth/issues)
- Documentation: [docs.d-auth.dev](https://docs.d-auth.dev)
- Examples: [github.com/your-org/d-auth/examples](https://github.com/your-org/d-auth/examples)

## 📝 License

MIT
