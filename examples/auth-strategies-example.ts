/**
 * Authentication Strategies Examples
 *
 * d-auth supports two authentication strategies:
 * 1. JWT-based (stateless) - Best for APIs, mobile apps, microservices
 * 2. Session-based (stateful) - Traditional web apps with server-side sessions
 */

import express from "express";
import { DAuth } from "../src/DAuth";
import { MongoDBAdapter } from "../src/adapters/MongoDBAdapter";
import { Queue } from "bullmq";

const emailQueue = new Queue("email", {
  connection: { host: "localhost", port: 6379 },
});

// ============================================
// Example 1: JWT Strategy with Cookie Mode
// (Modern web apps with HTTP-only cookies)
// ============================================

const app1 = express();

const dAuth1 = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI!,
  }),

  strategy: "jwt", // JWT-based authentication

  jwt: {
    secret: process.env.JWT_SECRET!,
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
    tokenMode: "cookie", // Tokens in HTTP-only cookies
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },

  hooks: {
    onOTPGenerated: async (data) => {
      await emailQueue.add("send-otp", data);
    },
  },
});

app1.use(dAuth1.initialize());
app1.post("/auth/login", dAuth1.middleware.login);

// Client usage: No need to handle tokens, sent automatically via cookies
// fetch('/auth/login', { method: 'POST', credentials: 'include', body: {...} })

// ============================================
// Example 2: JWT Strategy with Response Mode
// (Mobile apps, SPAs that manage tokens)
// ============================================

const app2 = express();

const dAuth2 = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI!,
  }),

  strategy: "jwt",

  jwt: {
    secret: process.env.JWT_SECRET!,
    accessTokenExpiry: "1h",
    refreshTokenExpiry: "30d", // Longer for mobile
    tokenMode: "response", // Tokens in response body
  },

  hooks: {
    onOTPGenerated: async (data) => {
      // Could send SMS instead of email for mobile
      await emailQueue.add("send-sms", data);
    },
  },
});

app2.use(dAuth2.initialize());
app2.post("/auth/login", dAuth2.middleware.login);
// Response: { user: {...}, accessToken: "...", refreshToken: "..." }

// Client usage: Store tokens and send in Authorization header
// localStorage.setItem('accessToken', response.accessToken);
// fetch('/api/data', { headers: { 'Authorization': `Bearer ${accessToken}` } })

// ============================================
// Example 3: Session Strategy (Traditional)
// (Traditional web apps with server-side sessions)
// ============================================

const app3 = express();

const dAuth3 = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI!,
  }),

  strategy: "session", // Session-based authentication with Passport

  session: {
    secret: process.env.SESSION_SECRET!,
    name: "sessionId",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    maxSessionsPerUser: 5,
    store: "database", // Store sessions in database
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "/auth/google/callback",
    },
  },

  hooks: {
    onOTPGenerated: async (data) => {
      await emailQueue.add("send-otp", data);
    },
    onUserLogin: async (data) => {
      console.log(`User ${data.user.email} logged in from ${data.ip}`);
    },
  },
});

app3.use(dAuth3.initialize());

// Session-based routes
app3.post("/auth/register", dAuth3.middleware.register);
app3.post("/auth/login", dAuth3.middleware.login);
app3.post("/auth/logout", dAuth3.middleware.logout);

// OAuth with sessions
app3.get("/auth/google", dAuth3.middleware.googleAuth);
app3.get("/auth/google/callback", dAuth3.middleware.googleCallback);

// Protected route
app3.get("/dashboard", dAuth3.requireAuth(), (req, res) => {
  // req.user is populated by Passport session
  res.render("dashboard", { user: req.user });
});

// Client usage: Standard form-based auth
// <form action="/auth/login" method="POST">
//   <input name="email" />
//   <input name="password" type="password" />
// </form>

// ============================================
// Example 4: Session Strategy with Redis Store
// (High-performance session storage)
// ============================================

const app4 = express();

const dAuth4 = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI!,
  }),

  strategy: "session",

  session: {
    secret: process.env.SESSION_SECRET!,
    store: "redis", // Use Redis for session storage
    redisUrl: process.env.REDIS_URL!,
    maxAge: 24 * 60 * 60 * 1000,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    },
  },
});

console.debug("TCL: dAuth4", dAuth4);

// ============================================
// Example 5: JWT Strategy with Both Mode
// (Support both cookies and Authorization header)
// ============================================

const app5 = express();

const dAuth5 = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI!,
  }),

  strategy: "jwt",

  jwt: {
    secret: process.env.JWT_SECRET!,
    tokenMode: "both", // Tokens in BOTH cookie and response body
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    },
  },
});

app5.use(dAuth5.initialize());
app5.post("/auth/login", dAuth5.middleware.login);
// Response: { user: {...}, accessToken: "...", refreshToken: "..." }
// AND sets cookies: accessToken, refreshToken

// Works with BOTH authentication methods:
app5.get("/api/data", dAuth5.requireAuth(), (req, res) => {
  // Accepts token from:
  // 1. Cookie (automatically sent by browser)
  // 2. Authorization: Bearer <token> header
  res.json({ data: "Works with both!" });
});

// ============================================
// Comparison: JWT vs Session
// ============================================

/*
JWT Strategy:
--------------
Pros:
  ✅ Stateless - No server-side storage
  ✅ Scalable - Works across multiple servers
  ✅ Great for APIs and microservices
  ✅ Mobile-friendly (tokens in response)
  ✅ Works with CDN/edge networks

Cons:
  ❌ Can't revoke tokens before expiry
  ❌ Larger cookie size
  ❌ Token refresh complexity

Best for:
  - REST APIs
  - Mobile apps
  - SPAs (React, Vue, Angular)
  - Microservices
  - Serverless architectures

Use Cases:
  - E-commerce API
  - Mobile app backend
  - Public API with rate limiting
  - Multi-tenant SaaS


Session Strategy:
-----------------
Pros:
  ✅ Easy to revoke sessions
  ✅ Small cookie size (just session ID)
  ✅ Traditional, well-understood
  ✅ Better for server-rendered apps
  ✅ Easier to manage user sessions

Cons:
  ❌ Requires session storage
  ❌ Sticky sessions or shared store needed
  ❌ Not great for mobile apps
  ❌ Scaling requires Redis/similar

Best for:
  - Traditional web apps
  - Server-rendered pages (EJS, Pug, etc.)
  - Admin dashboards
  - OAuth-heavy applications
  - Apps that need immediate logout

Use Cases:
  - WordPress-like CMS
  - Admin panels
  - Traditional e-commerce sites
  - Social media platforms
  - Banking applications
*/

// ============================================
// When to use which strategy?
// ============================================

/*
Use JWT when:
- Building a REST API
- Need horizontal scaling
- Mobile app backend
- Microservices architecture
- Serverless deployment
- Cross-domain authentication

Use Session when:
- Traditional web application
- Server-side rendering
- Need immediate session revocation
- OAuth is primary auth method
- Monolithic architecture
- Admin panels with strict security

Can't decide?
- Use JWT with 'both' tokenMode
- Supports cookies for web and Bearer tokens for mobile
*/

export { app1, app2, app3, app4, app5 };
