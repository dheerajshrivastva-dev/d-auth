Here’s the updated `README.md` based on your new requirements:

```md
# ![Logo](./path-to-your-logo.png) D-Auth an Express Middleware

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
6. [Keywords](#keywords)

## Installation

You can install the middleware via **npm**:

```bash
npm install @your-username/express-middleware
```

**Note**: MongoDB is required to store user data and session information. Make sure you have a MongoDB instance running and available.

## Usage

### Basic Usage

Here's how to integrate the middleware into your Express app:

```typescript
import express from 'express';
import { dAuthMiddleware } from '@your-username/express-middleware';

const app = express();

// Use dAuthMiddleware with default configuration
dAuthMiddleware(app, {
  jwtSecret: process.env.JWT_SECRET,
  mongoUri: process.env.MONGO_URI,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
```

### Middleware Configuration

Pass a configuration object to the middleware to control behavior:

```typescript
dAuthMiddleware(app, {
  jwtSecret: 'your-jwt-secret',
  mongoUri: 'mongodb-connection-uri',
  googleClientId: 'your-google-client-id',
  googleClientSecret: 'your-google-client-secret',
  enableGoogleLogin: true,
  enableFacebookLogin: false,  // Enable/disable social login providers
});
```

## Configuration

You can customize the behavior of the middleware by providing the following configuration options:

| Parameter               | Type     | Description                                                                 |
|-------------------------|----------|-----------------------------------------------------------------------------|
| `jwtSecret`              | `string` | Secret used for signing JWT tokens.                                         |
| `mongoUri`               | `string` | MongoDB connection URI to store session and user data.                      |
| `googleClientId`         | `string` | Google OAuth client ID for social login.                                    |
| `googleClientSecret`     | `string` | Google OAuth client secret.                                                 |
| `enableGoogleLogin`      | `boolean`| Enable or disable Google social login.                                      |
| `enableFacebookLogin`    | `boolean`| Enable or disable Facebook social login.                                    |
| `deviceTracking`         | `boolean`| Track device and IP information for each login session.                     |

## Examples

### Local Login with JWT Authentication

```typescript
import express from 'express';
import { dAuthMiddleware, authenticateMiddleware } from '@your-username/express-middleware';

const app = express();

dAuthMiddleware(app, {
  jwtSecret: 'your-jwt-secret',
  mongoUri: 'mongodb://localhost:27017/myapp',
  enableGoogleLogin: true,
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
