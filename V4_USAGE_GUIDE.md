# d-auth v4.0.0 - Usage Guide

Complete guide for using the refactored v4 architecture.

## Quick Start

### 1. Installation

```bash
npm install d-auth
```

### 2. Basic Setup (JWT Mode)

```typescript
import express from 'express';
import { DAuth, MongoDBAdapter } from 'd-auth';

const app = express();

// Initialize d-auth with JWT strategy
const dAuth = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI!,
  }),
  jwt: {
    secret: process.env.JWT_SECRET!,
    tokenMode: 'both', // Supports web (cookies) and mobile (response)
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
  },
  hooks: {
    onOTPGenerated: async (data) => {
      // Queue email job
      await emailQueue.add('send-otp', {
        to: data.email,
        otp: data.otp,
        expiresIn: data.expiresInMinutes,
      });
    },
    onUserRegistered: async (data) => {
      console.log('New user registered:', data.user.email);
    },
    onUserLogin: async (data) => {
      console.log('User logged in:', data.user.email, 'from', data.ip);
    },
  },
});

// Authentication routes
app.post('/auth/register', dAuth.middleware.register);
app.post('/auth/login', dAuth.middleware.login);
app.post('/auth/logout', dAuth.middleware.logout);
app.post('/auth/refresh', dAuth.middleware.refresh);
app.post('/auth/forgot-password', dAuth.middleware.forgotPassword);
app.post('/auth/reset-password', dAuth.middleware.resetPassword);
app.post('/auth/resend-otp', dAuth.middleware.resendOTP);

// Protected routes
app.get('/profile', dAuth.requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

// Role-based routes
app.get('/admin/users', dAuth.requireRoles(['admin']), (req, res) => {
  res.json({ message: 'Admin only' });
});

app.get('/employee/dashboard', dAuth.requireRoles(['employee']), (req, res) => {
  res.json({ message: 'Employee dashboard' });
});

app.listen(3000);
```

### 3. Session-Based Setup

```typescript
import express from 'express';
import session from 'express-session';
import { DAuth, MongoDBAdapter } from 'd-auth';

const app = express();

// Setup express-session
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true },
  })
);

const dAuth = new DAuth({
  database: new MongoDBAdapter({ uri: process.env.MONGO_URI! }),
  strategy: 'session',
  session: {
    secret: process.env.SESSION_SECRET!,
    maxSessionsPerUser: 5,
    store: 'database',
  },
  hooks: {
    onUserLogin: async (data) => {
      console.log('User logged in via session:', data.user.email);
    },
  },
});

// Initialize Passport for session mode
dAuth.initializePassport(app);

// Same routes as JWT mode
app.post('/auth/register', dAuth.middleware.register);
app.post('/auth/login', dAuth.middleware.login);
// ... etc
```

## Custom Database Adapter

Create your own adapter for PostgreSQL, MySQL, or any database:

```typescript
import { IDatabaseAdapter, IUserDocument, ISessionData, IOTPData } from 'd-auth';
import { Pool } from 'pg';

export class PostgreSQLAdapter implements IDatabaseAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async findUserByEmail(email: string): Promise<IUserDocument | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async createUser(userData: Partial<IUserDocument>): Promise<IUserDocument> {
    const result = await this.pool.query(
      'INSERT INTO users (email, password, ...) VALUES ($1, $2, ...) RETURNING *',
      [userData.email, userData.password, ...]
    );
    return result.rows[0];
  }

  // Implement all other methods from IDatabaseAdapter
  // See src/adapters/IDatabaseAdapter.ts for full interface
}

// Use it
const dAuth = new DAuth({
  database: new PostgreSQLAdapter(process.env.DATABASE_URL!),
  jwt: { ... },
});
```

## Email/SMS Integration

d-auth doesn't handle email/SMS directly. You integrate your own service via hooks:

### BullMQ Example

```typescript
import { Queue } from 'bullmq';

const emailQueue = new Queue('emails', {
  connection: { host: 'localhost', port: 6379 },
});

const dAuth = new DAuth({
  database: adapter,
  jwt: { secret: '...' },
  hooks: {
    onOTPGenerated: async (data) => {
      await emailQueue.add('send-otp', {
        to: data.email,
        subject: 'Your OTP Code',
        template: 'otp-email',
        context: {
          otp: data.otp,
          expiresIn: data.expiresInMinutes,
        },
      });
    },
    onPasswordReset: async (data) => {
      await emailQueue.add('password-reset-notification', {
        to: data.user.email,
        template: 'password-changed',
      });
    },
  },
});
```

### AWS SES Example

```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: 'us-east-1' });

const dAuth = new DAuth({
  database: adapter,
  jwt: { secret: '...' },
  hooks: {
    onOTPGenerated: async (data) => {
      await sesClient.send(
        new SendEmailCommand({
          Source: 'noreply@example.com',
          Destination: { ToAddresses: [data.email] },
          Message: {
            Subject: { Data: 'Your OTP Code' },
            Body: {
              Html: { Data: `Your OTP is: <strong>${data.otp}</strong>` },
            },
          },
        })
      );
    },
  },
});
```

## Advanced Configuration

### Custom Role Hierarchy

```typescript
import { UserRole } from 'd-auth';

const dAuth = new DAuth({
  database: adapter,
  jwt: { secret: '...' },
  roleHierarchy: {
    [UserRole.SUPERADMIN]: 120,
    [UserRole.ADMIN]: 100,
    [UserRole.MANAGER]: 60,
    [UserRole.EMPLOYEE]: 20,
    [UserRole.USER]: 0,
    // Add custom roles
    MODERATOR: 80,
    PREMIUM_USER: 5,
  },
});
```

### Multiple Token Modes

```typescript
// Cookie mode (default) - for web apps
const dAuth = new DAuth({
  database: adapter,
  jwt: {
    secret: '...',
    tokenMode: 'cookie',
  },
});

// Response mode - for mobile apps
const dAuth = new DAuth({
  database: adapter,
  jwt: {
    secret: '...',
    tokenMode: 'response',
  },
});

// Both mode - for hybrid apps
const dAuth = new DAuth({
  database: adapter,
  jwt: {
    secret: '...',
    tokenMode: 'both', // Tokens in cookies AND response body
  },
});
```

### RBAC Examples

```typescript
// Public route (no auth)
app.get('/api/public/data', (req, res) => {
  res.json({ message: 'Public data' });
});

// Authenticated route
app.get('/api/profile', dAuth.requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

// Single role
app.get('/api/admin/users', dAuth.requireRoles(['admin']), (req, res) => {
  // Only admins can access
});

// Multiple roles (user needs ANY of these)
app.get('/api/staff/schedule', dAuth.requireRoles(['employee', 'staff']), (req, res) => {
  // Employees, staff, or higher roles can access
});

// Require ALL roles
app.get('/api/special', dAuth.requireAllRoles(['verified', 'premium']), (req, res) => {
  // User must have BOTH verified AND premium roles
});

// Advanced role guard
app.use(
  '/api/admin',
  dAuth.requireRolesAdvanced({
    requiredRoles: ['admin'],
    allowUnverified: false, // Require email verification
  }),
  adminRouter
);

// Router-level protection (recommended)
const employeeRouter = express.Router();
employeeRouter.get('/dashboard', handler);
employeeRouter.get('/reports', handler);
app.use('/api/employee', dAuth.requireRoles(['employee']), employeeRouter);
```

## Migration from v3

### Before (v3)

```typescript
import dAuthMiddleware from 'd-auth';

dAuthMiddleware({
  mongoDbUri: process.env.MONGO_URI!,
  sessionSecret: process.env.SESSION_SECRET!,
  nodeMailerConfig: { ... },
  companyDetails: { ... },
})(app);
```

### After (v4)

```typescript
import { DAuth, MongoDBAdapter } from 'd-auth';

const dAuth = new DAuth({
  database: new MongoDBAdapter({ uri: process.env.MONGO_URI! }),
  jwt: { secret: process.env.JWT_SECRET! },
  hooks: {
    onOTPGenerated: async (data) => {
      // Your email service
    },
  },
});

app.post('/auth/register', dAuth.middleware.register);
app.post('/auth/login', dAuth.middleware.login);
```

## Benefits of v4

1. **Database Agnostic**: Works with MongoDB, PostgreSQL, MySQL, or any database
2. **Email Independent**: Integrate your own email service (AWS SES, SendGrid, etc.)
3. **Middleware-First**: Full control over your routes
4. **Dual Strategy**: Supports both JWT and Session authentication
5. **Multi-Mode Tokens**: Cookie, response, or both modes for web and mobile
6. **Type Safe**: Full TypeScript support
7. **Hook-Based**: Extend functionality via hooks
8. **RBAC**: Role-based access control with hierarchy

## API Reference

### DAuth Class

```typescript
class DAuth {
  constructor(options: DAuthOptions);

  // Middleware
  middleware: {
    register: RequestHandler;
    login: RequestHandler;
    logout: RequestHandler;
    refresh: RequestHandler;
    forgotPassword: RequestHandler;
    resetPassword: RequestHandler;
    resendOTP: RequestHandler;
  };

  // Guards
  requireAuth(): RequestHandler;
  requireRoles(roles: string[]): RequestHandler;
  requireAllRoles(roles: string[]): RequestHandler;
  requireRolesAdvanced(options): RequestHandler;

  // Utilities
  getDatabase(): IDatabaseAdapter;
  getConfig(): DAuthOptions;
  setHooks(hooks: Partial<DAuthHooks>): void;
  initializePassport(app: Express): void;
}
```

### Configuration Options

```typescript
interface DAuthOptions {
  database: IDatabaseAdapter; // Required
  strategy?: 'jwt' | 'session'; // Default: 'jwt'
  jwt?: JWTConfig;
  session?: SessionConfig;
  oauth?: OAuthConfig;
  roleHierarchy?: RoleHierarchy;
  twoFactor?: TwoFactorConfig;
  rateLimit?: RateLimitConfig;
  cors?: CORSConfig;
  hooks?: DAuthHooks;
}
```

See [types/config.ts](src/types/config.ts) for full type definitions.
