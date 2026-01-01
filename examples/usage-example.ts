/**
 * d-auth v4.0.0 Usage Examples
 *
 * This file demonstrates different ways to use d-auth with:
 * - Cookie-based tokens (traditional web apps)
 * - Response-based tokens (mobile apps, SPAs)
 * - 2FA integration
 * - Custom email queue integration
 */

import express from "express";
import cookieParser from "cookie-parser";
import { DAuth } from "../src/DAuth";
import { MongoDBAdapter } from "../src/adapters/MongoDBAdapter";
// import { PostgresAdapter } from './PostgresAdapter.example';
import { Queue } from "bullmq";

// ============================================
// Example 1: Cookie-based auth (Traditional Web App)
// ============================================

const app1 = express();

// Required middleware setup
app1.use(express.json());
app1.use(express.urlencoded({ extended: true }));
app1.use(cookieParser());

// Setup email queue (user's own implementation)
const emailQueue = new Queue("email", {
  connection: {
    host: "localhost",
    port: 6379,
  },
});

const dAuth1 = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI!,
  }),

  jwt: {
    secret: process.env.JWT_SECRET!,
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
    tokenMode: "cookie", // Tokens sent via HTTP-only cookies
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },

  session: {
    secret: process.env.SESSION_SECRET!,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    maxSessionsPerUser: 10,
  },

  accountSecurity: {
    maxFailedLoginAttempts: 5, // Lock account after 5 failed attempts
    lockoutDurationMinutes: 15, // Lock for 15 minutes
    enableAccountLockout: true, // Enable account lockout feature
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "/auth/google/callback",
    },
  },

  roleHierarchy: {
    superadmin: 120,
    admin: 100,
    manager: 60,
    user: 0,
  },

  twoFactor: {
    enabled: true,
    issuer: "MyApp",
    backupCodesCount: 10,
  },

  hooks: {
    // User handles email sending via their own queue
    onOTPGenerated: async (data) => {
      await emailQueue.add("send-otp", {
        to: data.email,
        subject: "Your OTP Code",
        template: "otp",
        variables: {
          otp: data.otp,
          expiresInMinutes: data.expiresInMinutes,
        },
      });
    },

    onUserRegistered: async (data) => {
      if (!data.isOAuth) {
        await emailQueue.add("welcome-email", {
          to: data.user.email,
          subject: "Welcome!",
          template: "welcome",
          variables: {
            firstName: data.user.firstName,
          },
        });
      }
    },

    onPasswordReset: async (data) => {
      await emailQueue.add("password-reset-confirmation", {
        to: data.user.email,
        subject: "Password Reset Successful",
        template: "password-reset-success",
      });
    },

    on2FAEnabled: async (data) => {
      await emailQueue.add("2fa-enabled", {
        to: data.user.email,
        subject: "2FA Enabled on Your Account",
        template: "2fa-enabled",
        variables: {
          backupCodesCount: data.backupCodesCount,
        },
      });
    },
  },
});

// Initialize d-auth middleware
app1.use(dAuth1.initialize());

// Option 1: Use individual middleware functions
app1.post("/auth/register", dAuth1.middleware.register);
app1.post("/auth/login", dAuth1.middleware.login);
app1.post("/auth/logout", dAuth1.middleware.logout);
app1.post("/auth/forgot-password", dAuth1.middleware.forgotPassword);
app1.post("/auth/reset-password", dAuth1.middleware.resetPassword);
app1.post("/auth/refresh-token", dAuth1.middleware.refresh);

// 2FA endpoints (TODO: implement 2FA middleware)
// app1.post("/auth/2fa/enable", dAuth1.requireAuth(), dAuth1.middleware.enable2FA);
// app1.post("/auth/2fa/verify", dAuth1.middleware.verify2FA);
// app1.post("/auth/2fa/disable", dAuth1.requireAuth(), dAuth1.middleware.disable2FA);

// OAuth routes
app1.get("/auth/google", dAuth1.middleware.googleAuth);
app1.get("/auth/google/callback", dAuth1.middleware.googleCallback);

// Protected routes with RBAC
app1.get("/api/me", dAuth1.requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

app1.get("/api/admin/users", dAuth1.requireRoles(["admin"]), (req, res) => {
  res.json({ message: "Admin only route" });
});

// ============================================
// Example 2: Response-based JWT (Mobile/SPA)
// ============================================

const app2 = express();

// Required middleware setup
app2.use(express.json());
app2.use(express.urlencoded({ extended: true }));
// Note: cookie-parser not needed for response-based JWT mode

const dAuth2 = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI!,
  }),

  jwt: {
    secret: process.env.JWT_SECRET!,
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "30d", // Longer for mobile apps
    tokenMode: "response", // Tokens sent in response body
  },

  hooks: {
    onOTPGenerated: async (data) => {
      // Send OTP via SMS for mobile apps
      await emailQueue.add("send-sms", {
        phone: data.email, // Assuming email could be phone in mobile context
        message: `Your OTP is: ${data.otp}`,
      });
    },
  },
});

app2.use(dAuth2.initialize());

// For response-based mode, tokens are in response body
app2.post("/auth/login", dAuth2.middleware.login);
// Response: { user: {...}, accessToken: "...", refreshToken: "..." }

// Client stores tokens and sends in Authorization header
app2.get("/api/profile", dAuth2.requireAuth(), (req, res) => {
  // Client sends: Authorization: Bearer <accessToken>
  res.json({ user: req.user });
});

// ============================================
// Example 3: Both modes (Hybrid)
// ============================================

const app3 = express();

// Required middleware setup
app3.use(express.json());
app3.use(express.urlencoded({ extended: true }));
app3.use(cookieParser());

const dAuth3 = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI!,
  }),

  jwt: {
    secret: process.env.JWT_SECRET!,
    tokenMode: "both", // Tokens in both cookie AND response body
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    },
  },
});

app3.use(dAuth3.initialize());

app3.post("/auth/login", dAuth3.middleware.login);
// Response: { user: {...}, accessToken: "...", refreshToken: "..." }
// AND sets cookies: accessToken, refreshToken

// Works with both Authorization header AND cookies
app3.get("/api/data", dAuth3.requireAuth(), (req, res) => {
  res.json({ data: "Works with both auth methods" });
});

// ============================================
// Example 4: Using PostgreSQL instead of MongoDB
// ============================================

/*
import { PostgresAdapter } from './PostgresAdapter.example';

const dAuth4 = new DAuth({
  database: new PostgresAdapter({
    connectionString: process.env.DATABASE_URL!,
  }),

  jwt: {
    secret: process.env.JWT_SECRET!,
    tokenMode: 'cookie',
  },

  hooks: {
    onOTPGenerated: async (data) => {
      // Same hooks work regardless of database
      await emailQueue.add('send-otp', data);
    },
  },
});
*/

// ============================================
// Example 5: Custom User Schema with MongoDB
// ============================================

const app5 = express();

// Required middleware setup
app5.use(express.json());
app5.use(express.urlencoded({ extended: true }));
app5.use(cookieParser());

// User can provide their own Mongoose model
import mongoose from "mongoose";

const CustomUserSchema = new mongoose.Schema(
  {
    // Required fields for d-auth
    email: { type: String, required: true, unique: true },
    password: { type: String },
    roles: { type: [String], default: ["user"] },
    isVerified: { type: Boolean, default: false },

    // Password management (v4.0.0)
    isTemporaryPassword: { type: Boolean, default: false },
    mustResetPassword: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lastFailedLoginAt: { type: Date },
    accountLockedUntil: { type: Date },

    // 2FA
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    twoFactorBackupCodes: { type: [String] },

    // Sessions
    tokens: [
      {
        sessionId: String,
        refreshToken: String,
        ip: String,
        deviceName: String,
        createdAt: Date,
        expiresAt: Date,
      },
    ],

    // Custom fields specific to your app
    username: { type: String, unique: true },
    avatar: { type: String },
    bio: { type: String },
    subscriptionTier: { type: String, enum: ["free", "pro", "enterprise"] },
    credits: { type: Number, default: 0 },
    preferences: {
      theme: { type: String, default: "light" },
      language: { type: String, default: "en" },
    },
  },
  { timestamps: true }
);

const CustomUser = mongoose.model("User", CustomUserSchema);

const dAuth5 = new DAuth({
  database: new MongoDBAdapter({
    uri: process.env.MONGO_URI!,
    userModel: CustomUser, // Use custom user model
  }),

  jwt: {
    secret: process.env.JWT_SECRET!,
    tokenMode: "cookie",
  },
});

app5.use(dAuth5.initialize());

// ============================================
// Example 6: Using optional built-in router (TODO: not yet implemented)
// ============================================

/*
const app6 = express();

// Required middleware setup
app6.use(express.json());
app6.use(express.urlencoded({ extended: true }));
app6.use(cookieParser());

const dAuth6 = new DAuth({
  database: new MongoDBAdapter({ uri: process.env.MONGO_URI! }),
  jwt: { secret: process.env.JWT_SECRET!, tokenMode: "cookie" },
  basePath: "/auth", // Optional: customize base path
});

app6.use(dAuth6.initialize());

// Mount all auth routes at once
app6.use("/auth", dAuth6.router);
// This creates:
// POST /auth/register
// POST /auth/login
// POST /auth/logout
// POST /auth/forgot-password
// POST /auth/reset-password
// POST /auth/refresh-token
// POST /auth/2fa/enable
// POST /auth/2fa/verify
// POST /auth/2fa/disable
// GET /auth/google
// GET /auth/google/callback
// etc.
*/

// ============================================
// Example 7: 2FA Flow (TODO: 2FA middleware not yet implemented)
// ============================================

/*
const app7 = express();

// Required middleware setup
app7.use(express.json());
app7.use(express.urlencoded({ extended: true }));
app7.use(cookieParser());

const dAuth7 = new DAuth({
  database: new MongoDBAdapter({ uri: process.env.MONGO_URI! }),
  jwt: { secret: process.env.JWT_SECRET!, tokenMode: "cookie" },
  twoFactor: { enabled: true, issuer: "MyApp" },
});

app7.use(dAuth7.initialize());

// Step 1: User enables 2FA
app7.post("/auth/2fa/setup", dAuth7.requireAuth(), async (req, res) => {
  const result = await dAuth7.services.setup2FA(req.user!.id);
  // Returns: { qrCode: "data:image/png...", secret: "...", backupCodes: [...] }
  res.json(result);
});

// Step 2: User verifies 2FA with TOTP code from authenticator app
app7.post("/auth/2fa/enable", dAuth7.requireAuth(), dAuth7.middleware.enable2FA);
// Request: { token: "123456" }

// Step 3: Login with 2FA
app7.post("/auth/login", dAuth7.middleware.login);
// If 2FA enabled, returns: { requires2FA: true, tempToken: "..." }

app7.post("/auth/2fa/verify", dAuth7.middleware.verify2FA);
// Request: { tempToken: "...", token: "123456" }
// Or use backup code: { tempToken: "...", backupCode: "ABC123" }
*/

export { app1, app2, app3, app5 };
