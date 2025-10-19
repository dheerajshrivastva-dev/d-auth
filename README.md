# <img width="100" alt="dauthlogo" src="https://github.com/user-attachments/assets/ce5e8bfd-2e76-4048-ae7c-b0bd9cfd0203" /> D-Auth

**An all-in-one authentication middleware for Express.js with Role-Based Access Control (RBAC)**

[![npm version](https://img.shields.io/npm/v/@dheerajshrivastva-dev/d-auth.svg)](https://www.npmjs.com/package/@dheerajshrivastva-dev/d-auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

D-Auth is a complete authentication solution providing cookie-session based authentication, OAuth (Google/Facebook), role-based access control with hierarchy, session management, rate limiting, and more.

---

## ✨ Features

- 🔐 **Cookie-Session Authentication**: Secure session-based authentication with MongoDB
- 🌐 **OAuth Integration**: Google and Facebook OAuth support
- 👥 **Role-Based Access Control (RBAC)**: Hierarchical role system with 7 built-in roles
- 🛡️ **Route Protection**: Simple middleware to guard routes by role
- 📧 **Email Verification**: Built-in email verification with customizable templates
- 🔑 **Password Reset**: Secure OTP-based password recovery via email
- 🚦 **Rate Limiting**: Protect against brute-force attacks
- 🍪 **Session Management**: Secure session storage with MongoDB
- 📊 **User Management**: Built-in CRUD operations for user administration
- 🌐 **Multi-Frontend Support**: Dynamic OAuth redirects for multiple frontends
- ⚡ **Easy Integration**: Plug-and-play setup with Express.js

**Note:** JWT-based authentication is not supported in v3.0 but is planned for v4.0.

---

## 📦 Installation

```bash
npm install @dheerajshrivastva-dev/d-auth
```

**Requirements:**
- Node.js 14+
- MongoDB (for session and user storage)
- Express.js

---

## 🚀 Quick Start

### 1. Setup Environment Variables

Create a `.env` file:

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/your-database

# Session Secret
SESSION_SECRET=your-super-secret-session-key

# CORS
CORS_ORIGIN=http://localhost:3000

# Email (for verification and password reset)
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# OAuth Dynamic Redirects (Optional)
ALLOWED_REDIRECT_URLS=http://localhost:3000,https://yourdomain.com
SOCIAL_LOGIN_SUCCESS_URL=http://localhost:3000/dashboard
SOCIAL_LOGIN_FAILURE_URL=http://localhost:3000/login
```

### 2. Basic Server Setup

```typescript
import express, { Express, Request, Response } from "express";
import {
  AuthenticatedRequest,
  dAuthMiddleware,
  requireRoles
} from "@dheerajshrivastva-dev/d-auth";
import { UserRole } from "@dheerajshrivastva-dev/d-auth";
import dotenv from "dotenv";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Initialize D-Auth middleware
dAuthMiddleware({
  // Required: MongoDB connection
  mongoDbUri: process.env.MONGO_URI!,
  sessionSecret: process.env.SESSION_SECRET!,
  authRouteinitials: "/auth", // Auth routes at /auth/*

  // Required: Email configuration for password reset
  nodeMailerConfig: {
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: true,
    auth: {
      user: process.env.EMAIL_USERNAME!,
      pass: process.env.EMAIL_PASSWORD!,
    }
  },

  // Required: Company details for emails
  companyDetails: {
    name: "Your Company",
    website: "https://yourcompany.com",
    contact: "support@yourcompany.com",
    privacyPolicy: "https://yourcompany.com/privacy",
    termsOfService: "https://yourcompany.com/terms",
    support: "https://yourcompany.com/support",
    address: "123 Main Street"
  },

  // Optional: OAuth configuration
  enableGoogleLogin: true,
  googleLoginDetails: {
    googleClientId: process.env.GOOGLE_CLIENT_ID!,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },

  enableFacebookLogin: false, // Set to true if using Facebook

  // Optional: CORS configuration
  corsOptions: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  // Optional: Session options
  sessionOptions: {
    name: "dauth-session",
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set true in production (HTTPS)
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },

  // Optional: Custom role hierarchy
  // roleHierarchy: {
  //   [UserRole.ADMIN]: 100,
  //   [UserRole.MANAGER]: 50,
  //   [UserRole.EMPLOYEE]: 20,
  //   [UserRole.USER]: 0
  // }
})(app);

// Public route - no authentication
app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to D-Auth!");
});

// Protected route - requires USER role (any authenticated user)
app.get('/profile', requireRoles([UserRole.USER]), (req: AuthenticatedRequest, res: Response) => {
  res.send(`Welcome ${req.user.email}`);
});

// Admin route - requires ADMIN role
app.get('/admin/dashboard', requireRoles([UserRole.ADMIN]), (req: AuthenticatedRequest, res: Response) => {
  res.send(`Admin Dashboard - ${req.user.email}`);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
```
---

## 🔐 Authentication Routes

D-Auth automatically creates these routes at your configured prefix (default `/auth`):

| Route | Method | Description |
|-------|--------|-------------|
| `/auth/register` | POST | Register new user with email/password |
| `/auth/login` | POST | Login with email/password |
| `/auth/logout` | POST | Logout current user |
| `/auth/refresh-token` | POST | Refresh authentication session |
| `/auth/forgot-password` | POST | Request password reset OTP |
| `/auth/reset-password` | POST | Reset password with OTP |
| `/auth/reset-password/new-otp` | POST | Resend OTP |
| `/auth/google` | GET | Initiate Google OAuth |
| `/auth/google/callback` | GET | Google OAuth callback |
| `/auth/facebook` | GET | Initiate Facebook OAuth |
| `/auth/facebook/callback` | GET | Facebook OAuth callback |

### Example: Register

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Example: Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

Response sets HTTP-only session cookie for subsequent authenticated requests.

---

## 👥 Role-Based Access Control (RBAC)

### Built-in Role Hierarchy

D-Auth includes automatic role hierarchy where higher roles can access lower role routes:

```
ADMIN (100)           ← Full access
  └─ MODERATOR (80)
      └─ MANAGER (60)
          └─ SUPERVISOR (40)
              └─ EMPLOYEE (20)
                  └─ STAFF (10)
                      └─ USER (0) ← Base level
```

###  Protecting Routes

**Recommended: Router-Level Protection**

```typescript
import { requireRoles, UserRole } from '@dheerajshrivastva-dev/d-auth';

// Admin router - all routes require admin
const adminRouter = express.Router();
adminRouter.get('/users', (req, res) => { /* ... */ });
adminRouter.delete('/user/:id', (req, res) => { /* ... */ });
app.use('/api/admin', requireRoles([UserRole.ADMIN]), adminRouter);

// User router - all routes require authenticated user
const userRouter = express.Router();
userRouter.get('/profile', (req, res) => { /* ... */ });
app.use('/api/user', requireRoles([UserRole.USER]), userRouter);

// Public router - no authentication required
const publicRouter = express.Router();
publicRouter.get('/info', (req, res) => { /* ... */ });
app.use('/api/public', requireRoles([]), publicRouter);
```

**Single Route Protection**

```typescript
// Single role - user needs this role or higher
app.get('/employee/dashboard',
  requireRoles([UserRole.EMPLOYEE]),
  (req, res) => { /* ... */ }
);

// Multiple role options (user needs ANY of these roles or higher)
app.get('/schedule',
  requireRoles([UserRole.STAFF, UserRole.EMPLOYEE]),
  (req, res) => { /* ... */ }
);

// Public route - no authentication required
app.get('/public/data',
  requireRoles([]),
  (req, res) => { /* ... */ }
);
```

### Available Roles

```typescript
import { UserRole } from '@dheerajshrivastva-dev/d-auth';

UserRole.ADMIN       // Level 100
UserRole.MODERATOR   // Level 80
UserRole.MANAGER     // Level 60
UserRole.SUPERVISOR  // Level 40
UserRole.EMPLOYEE    // Level 20
UserRole.STAFF       // Level 10
UserRole.USER        // Level 0 (base)
```

### Managing User Roles

```typescript
import { User, UserRole } from '@dheerajshrivastva-dev/d-auth';

// Default role on registration
const user = new User({
  email: 'user@example.com',
  password: hashedPassword,
  roles: [UserRole.USER] // Default
});

// Promote to employee
user.roles.push(UserRole.EMPLOYEE);
await user.save();

// Make admin
user.roles = [UserRole.ADMIN];
await user.save();

// Check role
if (user.hasRole(UserRole.ADMIN)) {
  // Admin logic
}
```

---

## 🌐 OAuth with Dynamic Redirects

Support multiple frontends (dev, staging, prod) with a single backend.

### Frontend Usage

```typescript
// Your frontend
const handleGoogleLogin = () => {
  const redirectUrl = `${window.location.origin}/dashboard`;
  window.location.href = `https://api.myapp.com/auth/google?redirectUrl=${encodeURIComponent(redirectUrl)}`;
};
```

### Configuration

```env
# Whitelist (comma-separated)
ALLOWED_REDIRECT_URLS=http://localhost:3000,https://staging.myapp.com,https://myapp.com

# Fallback URLs
SOCIAL_LOGIN_SUCCESS_URL=https://myapp.com/dashboard
SOCIAL_LOGIN_FAILURE_URL=https://myapp.com/login
```

### How It Works

1. Frontend calls `/auth/google?redirectUrl=http://localhost:3000/dashboard`
2. Backend validates against whitelist
3. Stores in OAuth `state` parameter
4. After auth, redirects to specified URL

**Security:** Only whitelisted URLs accepted (prevents open redirect attacks).

---

## 🔧 Configuration Reference

### Required Options

| Option | Type | Description |
|--------|------|-------------|
| `mongoDbUri` | string | MongoDB connection URI |
| `sessionSecret` | string | Session encryption secret |
| `nodeMailerConfig` | object | Email configuration (service, auth, etc) |
| `companyDetails` | object | Company info for emails (name, website, etc) |

### Optional Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `authRouteinitials` | string | `''` | Auth routes prefix |
| `enableGoogleLogin` | boolean | `false` | Enable Google OAuth |
| `googleLoginDetails` | object | - | Google client ID/secret |
| `enableFacebookLogin` | boolean | `false` | Enable Facebook OAuth |
| `facebookLoginDetails` | object | - | Facebook app ID/secret |
| `corsOptions` | object | - | CORS configuration |
| `sessionOptions` | object | - | Session configuration |
| `cookieOptions` | object | - | Cookie configuration |
| `roleHierarchy` | object | `DEFAULT_ROLE_HIERARCHY` | Custom role levels |

---

## 📚 Complete Example

See [src/app.ts](src/app.ts) for a working example with:
- RBAC route protection
- Public and protected routes
- Admin routes
- Role hierarchy in action

---

## 🔄 Migration from v2.x

### Breaking Change: Middleware Initialization

```typescript
// ❌ v2.x
dAuthMiddleware(app, options);

// ✅ v3.0
dAuthMiddleware(options)(app);
```

### Deprecated: `authenticateApiMiddleware`

```typescript
// ❌ v2.x (deprecated)
app.use('/api', authenticateApiMiddleware);

// ✅ v3.0 (recommended)
app.use('/api/admin', requireRoles([UserRole.ADMIN]), adminRouter);
app.use('/api/user', requireRoles([UserRole.USER]), userRouter);
```

See [CHANGELOG.md](CHANGELOG.md) for complete migration guide.

---

## 📖 Documentation

- **[CHANGELOG.md](CHANGELOG.md)** - Version history & migration
- **[RELEASE_NOTES.md](RELEASE_NOTES.md)** - v3.0 release details
- **[OAUTH_REDIRECT_CHANGES.md](OAUTH_REDIRECT_CHANGES.md)** - OAuth implementation guide

---

## 🐛 Issues & Support

- **Issues:** [GitHub Issues](https://github.com/dheerajshrivastva-dev/d-auth/issues)
- **Email:** dheerajshrivastva2@gmail.com

---

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

## 🙏 Acknowledgments

Built with [Express.js](https://expressjs.com/), [Passport.js](http://www.passportjs.org/), [MongoDB](https://www.mongodb.com/), [Nodemailer](https://nodemailer.com/)

---

**Made with ❤️ by [Dheeraj Shrivastava](https://github.com/dheerajshrivastva-dev)**

**Version:** 3.0.0 | **NPM:** [@dheerajshrivastva-dev/d-auth](https://www.npmjs.com/package/@dheerajshrivastva-dev/d-auth)
