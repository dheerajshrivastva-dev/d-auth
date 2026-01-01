import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { DAuth } from "../../src/DAuth";
import { MockDatabaseAdapter } from "../mocks/MockDatabaseAdapter";

/**
 * E2E Authentication Flow Tests - JWT Stateless Mode
 *
 * Tests JWT authentication with 'stateless' invalidation strategy.
 * In stateless mode:
 * - Tokens remain valid until expiry even after logout
 * - No session validation on each request
 * - Pure stateless authentication
 */
describe("E2E: JWT Stateless Authentication Flows", () => {
  let app: express.Application;
  let mockDb: MockDatabaseAdapter;
  let dAuth: DAuth;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    mockDb = new MockDatabaseAdapter();

    dAuth = new DAuth({
      database: mockDb,
      jwt: {
        secret: "test-secret-key",
        tokenMode: "both",
        accessTokenExpiry: "15m",
        refreshTokenExpiry: "7d",
        invalidationStrategy: "stateless", // Pure stateless JWT
      },
      accountSecurity: {
        maxFailedLoginAttempts: 3,
        lockoutDurationMinutes: 15,
        enableAccountLockout: true,
      },
    });

    // Initialize d-auth
    app.use(dAuth.initialize());

    // Setup auth routes
    app.post("/auth/register", dAuth.middleware.register);
    app.post("/auth/login", dAuth.middleware.login);
    app.post("/auth/logout", dAuth.middleware.logout);
    app.post("/auth/refresh-token", dAuth.middleware.refresh);

    // Protected route
    app.get("/api/profile", dAuth.requireAuth(), (req, res) => {
      res.json({ user: req.user });
    });
  });

  afterEach(() => {
    mockDb.reset();
  });

  describe("Happy Path: Register → Login → Access Protected Route", () => {
    it("should complete full registration and login flow", async () => {
      const userData = {
        email: "user@example.com",
        password: "SecurePass123!",
        firstName: "John",
        lastName: "Doe",
      };

      // Step 1: Register
      const registerRes = await request(app).post("/auth/register").send(userData).expect(201);

      expect(registerRes.body.message).toContain("Registration successful");
      expect(registerRes.body.user.email).toBe(userData.email);

      // Step 2: Login
      const loginRes = await request(app)
        .post("/auth/login")
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginRes.body.message).toBe("Login successful");
      expect(loginRes.body.accessToken).toBeDefined();
      expect(loginRes.body.refreshToken).toBeDefined();

      const accessToken = loginRes.body.accessToken;

      // Step 3: Access protected route
      const profileRes = await request(app)
        .get("/api/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(profileRes.body.user.email).toBe(userData.email);
    });
  });

  describe("Account Lockout Flow", () => {
    const userData = {
      email: "lockout@example.com",
      password: "CorrectPass123!",
    };

    beforeEach(async () => {
      // Pre-register user
      await request(app)
        .post("/auth/register")
        .send({
          ...userData,
          firstName: "Test",
          lastName: "User",
        });
    });

    it("should lock account after 3 failed login attempts", async () => {
      // Attempt 1: Wrong password
      const attempt1 = await request(app)
        .post("/auth/login")
        .send({
          email: userData.email,
          password: "WrongPass1@",
        })
        .expect(401);

      expect(attempt1.body.attemptsRemaining).toBe(2);

      // Attempt 2: Wrong password
      const attempt2 = await request(app)
        .post("/auth/login")
        .send({
          email: userData.email,
          password: "WrongPass2@",
        })
        .expect(401);

      expect(attempt2.body.attemptsRemaining).toBe(1);

      // Attempt 3: Wrong password - Account should be locked
      const attempt3 = await request(app)
        .post("/auth/login")
        .send({
          email: userData.email,
          password: "WrongPass3@",
        })
        .expect(403);

      expect(attempt3.body.message).toContain("Account locked");
      expect(attempt3.body.message).toContain("15 minutes");
    });
  });

  describe("Token Refresh Flow", () => {
    it("should refresh access token using refresh token", async () => {
      // Register and login
      await request(app).post("/auth/register").send({
        email: "refresh@example.com",
        password: "TestPass123!",
        firstName: "Refresh",
        lastName: "User",
      });

      const loginRes = await request(app)
        .post("/auth/login")
        .send({
          email: "refresh@example.com",
          password: "TestPass123!",
        })
        .expect(200);

      const oldAccessToken = loginRes.body.accessToken;
      const refreshToken = loginRes.body.refreshToken;

      // Wait at least 1 second to ensure new token will have different iat (issued at) timestamp
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Refresh token
      const refreshRes = await request(app)
        .post("/auth/refresh-token")
        .set("Cookie", loginRes.headers["set-cookie"])
        .send({ refreshToken })
        .expect(200);

      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.refreshToken).toBeDefined();
      expect(refreshRes.body.accessToken).not.toBe(oldAccessToken);

      // New access token should work
      const profileRes = await request(app)
        .get("/api/profile")
        .set("Authorization", `Bearer ${refreshRes.body.accessToken}`)
        .expect(200);

      expect(profileRes.body.user.email).toBe("refresh@example.com");
    });
  });

  describe("Stateless Logout Flow", () => {
    it("should NOT invalidate tokens on logout (stateless mode)", async () => {
      // Register and login
      await request(app).post("/auth/register").send({
        email: "logout@example.com",
        password: "TestPass123!",
        firstName: "Logout",
        lastName: "User",
      });

      const loginRes = await request(app)
        .post("/auth/login")
        .send({
          email: "logout@example.com",
          password: "TestPass123!",
        })
        .expect(200);

      const accessToken = loginRes.body.accessToken;

      // Access should work before logout
      await request(app)
        .get("/api/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // Logout
      await request(app)
        .post("/auth/logout")
        .set("Cookie", loginRes.headers["set-cookie"])
        .expect(200);

      // In STATELESS mode, access token should STILL WORK after logout
      // because tokens are not invalidated - they remain valid until expiry
      await request(app)
        .get("/api/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe("Multiple Sessions - Stateless Mode", () => {
    it("should support concurrent sessions and tokens remain valid after logout", async () => {
      const email = "multi@example.com";
      const password = "TestPass123!";

      // Register
      await request(app).post("/auth/register").send({
        email,
        password,
        firstName: "Multi",
        lastName: "Session",
      });

      // Login from device 1
      const device1Login = await request(app)
        .post("/auth/login")
        .set("User-Agent", "Device1/1.0")
        .send({ email, password })
        .expect(200);

      // Login from device 2
      const device2Login = await request(app)
        .post("/auth/login")
        .set("User-Agent", "Device2/1.0")
        .send({ email, password })
        .expect(200);

      // Both sessions should be able to access protected routes
      await request(app)
        .get("/api/profile")
        .set("Authorization", `Bearer ${device1Login.body.accessToken}`)
        .expect(200);

      await request(app)
        .get("/api/profile")
        .set("Authorization", `Bearer ${device2Login.body.accessToken}`)
        .expect(200);

      // Logout from device 1
      await request(app)
        .post("/auth/logout")
        .set("Cookie", device1Login.headers["set-cookie"])
        .expect(200);

      // In STATELESS mode, device 1 token should STILL WORK after logout
      await request(app)
        .get("/api/profile")
        .set("Authorization", `Bearer ${device1Login.body.accessToken}`)
        .expect(200);

      // Device 2 should still work
      await request(app)
        .get("/api/profile")
        .set("Authorization", `Bearer ${device2Login.body.accessToken}`)
        .expect(200);
    });
  });
});
