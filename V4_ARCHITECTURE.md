# d-auth v4.0.0 - Architecture Documentation

## 🎯 Major Changes from v3.x

### v3.x (Route-based)
```javascript
// Routes automatically mounted at /auth/*
app.use(dAuthMiddleware(options));
// Email sending built-in with nodemailer
```

### v4.x (Middleware-first)
```javascript
// User has full control over routes
const dAuth = new DAuth({ database, jwt, hooks });
app.post('/register', dAuth.middleware.register);
// User handles email via their own queue/service
```

## 🏗️ New Architecture

### 1. Database Agnostic Design

d-auth now works with **any database** through adapters:

```typescript
interface IDatabaseAdapter {
  // User operations
  findUserByEmail(email: string): Promise<IUserDocument | null>;
  createUser(userData: Partial<IUserDocument>): Promise<IUserDocument>;
  // ... 25+ methods for complete auth operations
}
```

**Built-in Adapters:**
- ✅ `MongoDBAdapter` - MongoDB/Mongoose
- 📝 `PostgresAdapter` - PostgreSQL (example provided)
- 📝 `MySQLAdapter` - MySQL (community contribution welcome)
- 📝 `PrismaAdapter` - Prisma ORM (community contribution welcome)

### 2. Hook-Based Email Integration

No more built-in email sending! Users integrate their own email service:

```typescript
const dAuth = new DAuth({
  hooks: {
    onOTPGenerated: async (data) => {
      // User's email queue (BullMQ, RabbitMQ, etc.)
      await emailQueue.add('send-otp', {
        to: data.email,
        otp: data.otp,
      });
    },
    onUserRegistered: async (data) => {
      await emailQueue.add('welcome-email', data.user);
    },
  },
});
```

**Available Hooks:**
- `onOTPGenerated` - Send OTP via email/SMS
- `onUserRegistered` - Welcome email
- `onUserLogin` - Login notification
- `onPasswordReset` - Password reset confirmation
- `onUserLogout` - Logout notification
- `on2FAEnabled` - 2FA activation email
- `on2FADisabled` - 2FA deactivation email

### 3. Flexible Token Delivery Modes

Support for different client types:

```typescript
// Cookie-based (Web apps)
jwt: {
  tokenMode: 'cookie',
  cookieOptions: { httpOnly: true, secure: true }
}

// Response-based (Mobile apps, SPAs)
jwt: {
  tokenMode: 'response'
}
// Returns: { accessToken: "...", refreshToken: "..." }

// Both (Hybrid)
jwt: {
  tokenMode: 'both'
}
```

### 4. Built-in 2FA Support

```typescript
twoFactor: {
  enabled: true,
  issuer: 'MyApp',
  backupCodesCount: 10,
}
```

**2FA Features:**
- ✅ TOTP (Time-based One-Time Password)
- ✅ QR code generation for authenticator apps
- ✅ Backup codes (hashed storage)
- ✅ Backup code verification and consumption
- ✅ Enable/disable 2FA

## 📦 Installation & Setup

### Quick Start

```bash
npm install d-auth@4.0.0
```

### Basic Setup (MongoDB + Cookie Auth)

```typescript
import express from 'express';
import { DAuth, MongoDBAdapter } from 'd-auth';

const app = express();

const dAuth = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI,
  }),

  jwt: {
    secret: process.env.JWT_SECRET,
    tokenMode: 'cookie',
  },

  hooks: {
    onOTPGenerated: async (data) => {
      // Send email via your service
      await sendEmail({
        to: data.email,
        subject: 'Your OTP',
        text: `Your OTP is: ${data.otp}`,
      });
    },
  },
});

// Initialize middleware
app.use(dAuth.initialize());

// Define your own routes
app.post('/auth/register', dAuth.middleware.register);
app.post('/auth/login', dAuth.middleware.login);
app.post('/auth/logout', dAuth.middleware.logout);

// Or use the optional built-in router
app.use('/auth', dAuth.router);

// Protected routes
app.get('/api/profile', dAuth.requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

app.get('/admin', dAuth.requireRoles(['admin']), (req, res) => {
  res.json({ message: 'Admin only' });
});
```

## 🗄️ Database Setup

### MongoDB

```typescript
import { MongoDBAdapter } from 'd-auth';

const database = new MongoDBAdapter({
  uri: process.env.MONGO_URI,
  // Optional: provide your own Mongoose models
  userModel: CustomUserModel,
  otpModel: CustomOTPModel,
  maxSessionsPerUser: 10,
});
```

**Custom User Schema:**

```typescript
import mongoose from 'mongoose';

const CustomUserSchema = new mongoose.Schema({
  // Required fields
  email: { type: String, required: true, unique: true },
  password: { type: String },
  roles: { type: [String], default: ['user'] },
  isVerified: { type: Boolean, default: false },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  twoFactorBackupCodes: { type: [String] },
  tokens: [/* session schema */],

  // Your custom fields
  username: { type: String, unique: true },
  avatar: { type: String },
  subscriptionTier: { type: String },
  // ... any other fields
});

const database = new MongoDBAdapter({
  uri: process.env.MONGO_URI,
  userModel: mongoose.model('User', CustomUserSchema),
});
```

### PostgreSQL

```typescript
import { PostgresAdapter } from './adapters/PostgresAdapter';

const database = new PostgresAdapter({
  connectionString: process.env.DATABASE_URL,
  maxSessionsPerUser: 10,
});
```

**SQL Schema:**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  google_id VARCHAR(255),
  facebook_id VARCHAR(255),
  roles JSONB DEFAULT '["user"]',
  is_verified BOOLEAN DEFAULT false,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret VARCHAR(255),
  two_factor_backup_codes JSONB,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  refresh_token TEXT NOT NULL,
  ip VARCHAR(45) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE otps (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  otp VARCHAR(10) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  otp_type VARCHAR(50) NOT NULL,
  otp_count INT DEFAULT 0,
  otp_sent_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
```

### Custom Database Adapter

Implement `IDatabaseAdapter` for your database:

```typescript
import { IDatabaseAdapter } from 'd-auth';

export class MyCustomAdapter implements IDatabaseAdapter {
  async findUserByEmail(email: string) {
    // Your implementation
  }

  async createUser(userData) {
    // Your implementation
  }

  // ... implement all required methods
}

const dAuth = new DAuth({
  database: new MyCustomAdapter(),
  // ...
});
```

## 🔐 Authentication Modes

### Cookie-Based (Traditional Web Apps)

```typescript
const dAuth = new DAuth({
  jwt: {
    secret: process.env.JWT_SECRET,
    tokenMode: 'cookie',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  },
});
```

**Client Usage:**
```javascript
// Login
fetch('/auth/login', {
  method: 'POST',
  credentials: 'include', // Important for cookies
  body: JSON.stringify({ email, password }),
});

// Authenticated requests
fetch('/api/profile', {
  credentials: 'include', // Cookies sent automatically
});
```

### Response-Based (Mobile Apps / SPAs)

```typescript
const dAuth = new DAuth({
  jwt: {
    secret: process.env.JWT_SECRET,
    tokenMode: 'response',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '30d',
  },
});
```

**Client Usage:**
```javascript
// Login
const { accessToken, refreshToken } = await fetch('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
}).then(r => r.json());

// Store tokens
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// Authenticated requests
fetch('/api/profile', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});
```

### Hybrid Mode

```typescript
const dAuth = new DAuth({
  jwt: {
    tokenMode: 'both', // Tokens in both cookie AND response
  },
});
```

Supports both cookie-based and header-based authentication simultaneously.

## 🛡️ Role-Based Access Control (RBAC)

### Define Role Hierarchy

```typescript
const dAuth = new DAuth({
  roleHierarchy: {
    superadmin: 120,
    admin: 100,
    manager: 60,
    staff: 20,
    user: 0,
  },
});
```

### Protect Routes

```typescript
// Single role
app.get('/admin/users', dAuth.requireRoles(['admin']), handler);

// Multiple roles (OR logic - user needs ANY of these roles)
app.get('/dashboard', dAuth.requireRoles(['manager', 'admin']), handler);

// Public route (no auth required)
app.get('/public', dAuth.requireRoles([]), handler);

// Authenticated but no specific role
app.get('/profile', dAuth.requireAuth(), handler);
```

**Hierarchy Behavior:**
- Higher roles can access lower role routes
- `admin` (100) can access `manager` (60) routes
- `manager` (60) can access `staff` (20) and `user` (0) routes

## 🔑 Two-Factor Authentication (2FA)

### Enable 2FA

```typescript
const dAuth = new DAuth({
  twoFactor: {
    enabled: true,
    issuer: 'MyApp',
    backupCodesCount: 10,
    window: 1, // TOTP window tolerance
  },
});
```

### 2FA Flow

**1. Setup 2FA:**
```typescript
app.post('/auth/2fa/setup', dAuth.requireAuth(), async (req, res) => {
  const result = await dAuth.services.setup2FA(req.user.id);
  // Returns: { qrCode, secret, backupCodes }
  res.json(result);
});
```

**2. User scans QR code with authenticator app**

**3. Enable 2FA:**
```typescript
app.post('/auth/2fa/enable', dAuth.requireAuth(), dAuth.middleware.enable2FA);
// Request: { token: "123456" }
```

**4. Login with 2FA:**
```typescript
// Step 1: Login with email/password
POST /auth/login
// Response: { requires2FA: true, tempToken: "..." }

// Step 2: Verify 2FA
POST /auth/2fa/verify
// Request: { tempToken: "...", token: "123456" }
// Or: { tempToken: "...", backupCode: "ABC123" }
```

## 📧 Email Integration Examples

### BullMQ

```typescript
import { Queue } from 'bullmq';

const emailQueue = new Queue('email', {
  connection: { host: 'localhost', port: 6379 },
});

const dAuth = new DAuth({
  hooks: {
    onOTPGenerated: async (data) => {
      await emailQueue.add('send-otp', {
        to: data.email,
        subject: 'Your OTP Code',
        otp: data.otp,
        expiresInMinutes: data.expiresInMinutes,
      });
    },
  },
});
```

### AWS SES

```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: 'us-east-1' });

const dAuth = new DAuth({
  hooks: {
    onOTPGenerated: async (data) => {
      await ses.send(new SendEmailCommand({
        Source: 'noreply@myapp.com',
        Destination: { ToAddresses: [data.email] },
        Message: {
          Subject: { Data: 'Your OTP Code' },
          Body: { Text: { Data: `Your OTP is: ${data.otp}` } },
        },
      }));
    },
  },
});
```

### SendGrid

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const dAuth = new DAuth({
  hooks: {
    onOTPGenerated: async (data) => {
      await sgMail.send({
        to: data.email,
        from: 'noreply@myapp.com',
        subject: 'Your OTP Code',
        text: `Your OTP is: ${data.otp}`,
      });
    },
  },
});
```

## 🔄 Migration from v3.x to v4.x

### Breaking Changes

1. **No more automatic routes**
   - v3: Routes auto-mounted at `/auth/*`
   - v4: You define your own routes

2. **No built-in email sending**
   - v3: Nodemailer built-in
   - v4: You handle emails via hooks

3. **Database adapters required**
   - v3: MongoDB only
   - v4: Any database via adapters

4. **New initialization**
   - v3: `dAuthMiddleware(options)(app)`
   - v4: `new DAuth(options)`

### Migration Steps

**Step 1: Update initialization**

```typescript
// v3.x
app.use(dAuthMiddleware({
  mongoDbUri: process.env.MONGO_URI,
  sessionSecret: process.env.SESSION_SECRET,
  nodeMailerConfig: { /* ... */ },
  companyDetails: { /* ... */ },
}));

// v4.x
const dAuth = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI,
  }),
  jwt: {
    secret: process.env.JWT_SECRET,
    tokenMode: 'cookie',
  },
  hooks: {
    onOTPGenerated: async (data) => {
      // Your email logic
    },
  },
});

app.use(dAuth.initialize());
```

**Step 2: Define routes**

```typescript
// v3.x - Routes were automatic

// v4.x - Define explicitly or use router
app.use('/auth', dAuth.router); // Quick migration
// OR
app.post('/auth/register', dAuth.middleware.register);
app.post('/auth/login', dAuth.middleware.login);
// ... other routes
```

**Step 3: Update email handling**

```typescript
// v3.x - Email sent automatically

// v4.x - Handle via hooks
hooks: {
  onOTPGenerated: async (data) => {
    await yourEmailService.send(data);
  },
}
```

## 📝 Complete Configuration Reference

```typescript
const dAuth = new DAuth({
  // Database adapter (REQUIRED)
  database: new MongoDBAdapter({ uri: '...' }),

  // JWT configuration (REQUIRED)
  jwt: {
    secret: 'your-secret-key',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    tokenMode: 'cookie' | 'response' | 'both',
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 604800000,
    },
  },

  // Session configuration (optional)
  session: {
    secret: 'session-secret',
    sessionTTL: 24,
    maxSessionsPerUser: 10,
  },

  // OAuth providers (optional)
  oauth: {
    google: {
      clientId: '...',
      clientSecret: '...',
      callbackURL: '/auth/google/callback',
    },
    facebook: {
      clientId: '...',
      clientSecret: '...',
      callbackURL: '/auth/facebook/callback',
    },
  },

  // Role hierarchy (optional)
  roleHierarchy: {
    superadmin: 120,
    admin: 100,
    user: 0,
  },

  // 2FA configuration (optional)
  twoFactor: {
    enabled: true,
    issuer: 'MyApp',
    backupCodesCount: 10,
    window: 1,
  },

  // Rate limiting (optional)
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 900000, // 15 minutes
  },

  // CORS (optional)
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true,
  },

  // Event hooks (optional)
  hooks: {
    onOTPGenerated: async (data) => { /* ... */ },
    onUserRegistered: async (data) => { /* ... */ },
    onUserLogin: async (data) => { /* ... */ },
    onPasswordReset: async (data) => { /* ... */ },
    onUserLogout: async (data) => { /* ... */ },
    on2FAEnabled: async (data) => { /* ... */ },
    on2FADisabled: async (data) => { /* ... */ },
  },

  // Base path for optional router (optional)
  basePath: '/auth',
});
```

## 🚀 Benefits of v4.x

1. **Database Agnostic** - Use MongoDB, PostgreSQL, MySQL, or any database
2. **Lightweight** - No built-in email dependencies
3. **Flexible** - Cookie-based, response-based, or both
4. **Customizable** - Full control over routes and user schema
5. **Production Ready** - 2FA, RBAC, session management
6. **Framework Agnostic** - Just middleware functions

## 📚 API Reference

### Middleware Functions

- `dAuth.middleware.register` - User registration
- `dAuth.middleware.login` - User login
- `dAuth.middleware.logout` - User logout
- `dAuth.middleware.forgotPassword` - Request password reset OTP
- `dAuth.middleware.resetPassword` - Reset password with OTP
- `dAuth.middleware.refreshToken` - Refresh access token
- `dAuth.middleware.enable2FA` - Enable 2FA
- `dAuth.middleware.verify2FA` - Verify 2FA during login
- `dAuth.middleware.disable2FA` - Disable 2FA
- `dAuth.middleware.googleAuth` - Initiate Google OAuth
- `dAuth.middleware.googleCallback` - Google OAuth callback
- `dAuth.middleware.facebookAuth` - Initiate Facebook OAuth
- `dAuth.middleware.facebookCallback` - Facebook OAuth callback

### Guard Middleware

- `dAuth.requireAuth()` - Require authentication
- `dAuth.requireRoles([roles])` - Require specific roles

### Services

- `dAuth.services.setup2FA(userId)` - Generate 2FA QR code and secret
- `dAuth.services.generateTokens(userId, sessionId)` - Generate JWT tokens
- `dAuth.services.verifyToken(token)` - Verify JWT token

## 🤝 Contributing

We welcome contributions for:
- Additional database adapters (Prisma, MySQL, etc.)
- OAuth providers (GitHub, Twitter, etc.)
- Documentation improvements
- Bug fixes

## 📄 License

MIT
