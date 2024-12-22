# <img width="100" alt="dauthlogo" src="https://github.com/user-attachments/assets/ce5e8bfd-2e76-4048-ae7c-b0bd9cfd0203" /> D-Auth an Express Middleware



An all-in-one authentication middleware for Express.js applications that supports JWT-based authentication, OAuth with Google, email-password login, refresh tokens, rate limiting, session management, and more. Designed to be flexible and secure, this middleware can be integrated into any Express app by simply passing the server instance.

## Features

- **Local and Google OAuth login**: Seamless integration of traditional login and social login using Google.
- **JWT-based authentication**: Secure short-lived and long-lived tokens for session handling.
- **One user, one session**: Ensures users only have one active session at a time.
- **Device tracking**: Track devices, IP addresses, and session data.
- **Rate limiting**: Protect against abuse with predefined rate limits based on IP and device fingerprints.
- **CAPTCHA protection**: *Coming soon* - CAPTCHA verification triggered after too many failed login attempts.
- **Secure session management**: Persistent session management with refresh tokens.
- **MongoDB integration**: MongoDB is required to store user sessions and authentication data.

## Table of Contents

1. [Installation](#installation)
2. [Usage](#usage)
3. [Configuration](#configuration)
4. [Parameters](#parameters)
5. [Examples](#examples)
6. [Route Structure](#route-structure)

## Installation

You can install the middleware via **npm**:

```bash
npm i @dheerajshrivastva-dev/d-auth
```

**Note**: MongoDB is required to store user data and session information. Make sure you have a MongoDB instance running and available.

## Usage

### Basic Usage

Here's how to integrate the middleware into your Express app:

```typescript
import express, { Express, Request, Response } from "express";
import { AuthenticatedRequest, authenticateApiMiddleware, dAuthMiddleware } from "./middleware/authMiddleware";
import dotenv from "dotenv";
import path from 'path';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

dAuthMiddleware(app, {
  enableFacebookLogin: false,
  enableGoogleLogin: true,
  mongoDbUri: process.env.MONGO_URI!,
  sessionSecret: process.env.SESSION_SECRET!,
  authRouteinitials: "/auth"
});

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

app.use('/api', authenticateApiMiddleware);

// Define routes
app.get('/api/public/data', (req: Request, res: Response) => {
  res.send('This is a public route');
});

app.get('/api/private/data', (req: AuthenticatedRequest, res: Response) => {
  // Only authenticated users will reach here
  res.send(`Hello, ${req.user.email}`);
});

app.get('/auth/privacy-policy', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy-policy.html'));
});

app.get('/auth/terms-of-service', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, 'public', 'terms-of-service.html'));
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
```

Do not forget to export env "JWT_SECRET"

### Middleware Configuration

Pass a configuration object to the middleware to control behavior:

```typescript
dAuthMiddleware(app, {
  enableFacebookLogin: false,
  enableGoogleLogin: true,
  mongoDbUri: process.env.MONGO_URI!,
  sessionSecret: process.env.SESSION_SECRET!,
  authRouteinitials: "/auth",
  companyDetails: {
    name: "D-Auth Tester",
    website: "https://d-auth.com",
    contact: "https://d-auth.com/contact",
    privacyPolicy: "https://d-auth.com/privacy-policy",
    termsOfService: "https://d-auth.com/terms-of-service",
    support: "https://d-auth.com/support",
    address: "123 Main Street, USA"
  },
  nodeMailerConfig: {
    auth: {
      user: process.env.EMAIL_USERNAME!,
      pass: process.env.EMAIL_PASSWORD!,
    },
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: true
  }
});
```

## Configuration

You can customize the behavior of the middleware by providing the following configuration options:

| Parameter               | Type     | Description                                                                 |
|-------------------------|----------|-----------------------------------------------------------------------------|
| `jwtSecret`              | `string` | Secret used for signing JWT tokens.                                         |
| `mongoUri`               | `string` | MongoDB connection URI to store session and user data.                      |
| `googleLoginDetails`     | `object` | googleClientId, googleClientSecret, googleCallbackURL                       |
| `facebookLoginDetails`   | `object` | facebookClientId, facebookClientSecret, facebookCallbackURL                 |
| `enableGoogleLogin`      | `boolean`| Enable or disable Google social login.                                      |
| `enableFacebookLogin`    | `boolean`| Enable or disable Facebook social login.                                    |
| `deviceTracking`         | `boolean`| Track device and IP information for each login session.                     |
| `cookieOptions`          | `object` | Add cookies configuratins                                                   |
| `nodeMailerConfig`       | `object` | Nodemailer options to setup emails                                          |
| `companyDetails`         | `object` | Add company details                                                         |

## Examples

### Local Login with JWT Authentication

```typescript
import express from 'express';
import { dAuthMiddleware, authenticateMiddleware } from '@your-username/express-middleware';

const app = express();

dAuthMiddleware(app, {
  jwtSecret: 'your-jwt-secret',
  mongoUri: 'mongodb://localhost:27017/myapp',
  enableGoogleLogin: false,
  cookieOptions: {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  },
  companyDetails: {
    name: "D-Auth Tester",
    website: "https://d-auth.com",
    contact: "https://d-auth.com/contact",
    privacyPolicy: "https://d-auth.com/privacy-policy",
    termsOfService: "https://d-auth.com/terms-of-service",
    support: "https://d-auth.com/support",
    address: "123 Main Street, USA"
  },
  nodeMailerConfig: {
    auth: {
      user: process.env.EMAIL_USERNAME!,
      pass: process.env.EMAIL_PASSWORD!,
    },
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: true
  }
});

app.post('/login', authenticateMiddleware, (req, res) => {
  const user = req.user;
  res.json({ message: 'Login successful', user });
});

app.listen(3000, () => {
  console.log('Server is running');
});
```

### Google OAuth Login

```typescript
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }),
  function(req, res) {
    // Successful authentication
    res.redirect('/');
  });
```

### JWT Refresh Token

```typescript
app.post('/refresh-token', (req, res) => {
  const { refreshToken } = req.body;
  const newTokens = generateTokens(refreshToken);
  res.json(newTokens);
});
```

### Route Structure

To properly utilize the middleware, ensure that you leave the following routes empty:

* `/auth/*`: These routes are used for handling authentication requests and should be implemented according to your application's needs.

By leaving them empty, you allow the middleware to manage authentication flows without conflicts.
