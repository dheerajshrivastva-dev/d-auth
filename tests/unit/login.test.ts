import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";
import { DAuth } from "../../src/DAuth";
import { MockDatabaseAdapter } from "../mocks/MockDatabaseAdapter";

describe("Login Middleware", () => {
  let app: express.Application;
  let mockDb: MockDatabaseAdapter;
  let dAuth: DAuth;
  let onUserLoginMock: jest.Mock;
  let onAccountLockedMock: jest.Mock;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    mockDb = new MockDatabaseAdapter();
    onUserLoginMock = jest.fn();
    onAccountLockedMock = jest.fn();

    dAuth = new DAuth({
      database: mockDb,
      jwt: {
        secret: "test-secret",
        tokenMode: "both",
      },
      accountSecurity: {
        maxFailedLoginAttempts: 3,
        lockoutDurationMinutes: 15,
        enableAccountLockout: true,
      },
      hooks: {
        onUserLogin: onUserLoginMock,
        onAccountLocked: onAccountLockedMock,
      },
    });

    app.post("/auth/login", dAuth.middleware.login);

    // Create test user
    await mockDb.createUser({
      id: "user123",
      email: "test@example.com",
      password: await bcrypt.hash("SecurePass123!", 10),
      roles: ["user"],
      isVerified: true,
      twoFactorEnabled: false,
    });
  });

  afterEach(() => {
    mockDb.reset();
    jest.clearAllMocks();
  });

  describe("Successful Login", () => {
    it("should login user with valid credentials", async () => {
      const loginData = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const response = await request(app).post("/auth/login").send(loginData).expect(200);

      expect(response.body.message).toBe("Login successful");
      expect(response.body.user).toBeDefined();
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();

      // Verify hook was called
      expect(onUserLoginMock).toHaveBeenCalledWith({
        user: expect.objectContaining({
          email: loginData.email,
        }),
        ip: expect.any(String),
        deviceName: expect.any(String),
      });
    });

    it("should create session on successful login", async () => {
      const loginData = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      await request(app).post("/auth/login").send(loginData).expect(200);

      const sessions = await mockDb.getAllSessions("user123");
      expect(sessions.length).toBe(1);
      expect(sessions[0].refreshToken).toBeDefined();
    });

    it("should reset failed login attempts on successful login", async () => {
      // Simulate failed attempts
      await mockDb.updateUser("user123", { failedLoginAttempts: 2 });

      const loginData = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      await request(app).post("/auth/login").send(loginData).expect(200);

      const user = await mockDb.findUserById("user123");
      expect(user?.failedLoginAttempts).toBe(0);
    });
  });

  describe("Failed Login Attempts", () => {
    it("should increment failed attempts on wrong password", async () => {
      const loginData = {
        email: "test@example.com",
        password: "WrongPassword123!",
      };

      const response = await request(app).post("/auth/login").send(loginData).expect(401);

      expect(response.body.message).toContain("Incorrect email or password");
      expect(response.body.attemptsRemaining).toBe(2);

      const user = await mockDb.findUserById("user123");
      expect(user?.failedLoginAttempts).toBe(1);
    });

    it("should show remaining attempts after each failed login", async () => {
      const loginData = {
        email: "test@example.com",
        password: "WrongPassword123!",
      };

      // First failed attempt
      let response = await request(app).post("/auth/login").send(loginData);
      expect(response.body.attemptsRemaining).toBe(2);

      // Second failed attempt
      response = await request(app).post("/auth/login").send(loginData);
      expect(response.body.attemptsRemaining).toBe(1);
    });

    it("should lock account after 3 failed attempts", async () => {
      const loginData = {
        email: "test@example.com",
        password: "WrongPassword123!",
      };

      // 3 failed attempts
      await request(app).post("/auth/login").send(loginData);
      await request(app).post("/auth/login").send(loginData);
      const response = await request(app).post("/auth/login").send(loginData).expect(403);

      expect(response.body.message).toContain("Account locked");
      expect(response.body.message).toContain("15 minutes");

      // Verify hook was called
      expect(onAccountLockedMock).toHaveBeenCalledWith({
        user: expect.objectContaining({
          email: loginData.email,
        }),
        failedAttempts: 3,
        lockedUntil: expect.any(Date),
      });

      const user = await mockDb.findUserById("user123");
      expect(user?.accountLockedUntil).toBeDefined();
    });

    it("should prevent login when account is locked", async () => {
      // Lock account
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      await mockDb.lockAccount("user123", lockUntil);

      const loginData = {
        email: "test@example.com",
        password: "SecurePass123!", // Even with correct password
      };

      const response = await request(app).post("/auth/login").send(loginData).expect(403);

      expect(response.body.message).toContain("temporarily locked");
    });
  });

  describe("Temporary Password", () => {
    it("should require password reset for temporary password", async () => {
      // Create user with temporary password
      await mockDb.updateUser("user123", {
        isTemporaryPassword: true,
        mustResetPassword: true,
      });

      const loginData = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const response = await request(app).post("/auth/login").send(loginData).expect(403);

      expect(response.body.message).toContain("must reset your password");
      expect(response.body.requiresPasswordReset).toBe(true);
    });
  });

  describe("2FA Support", () => {
    it("should return 2FA requirement for enabled users", async () => {
      // Enable 2FA for user
      await mockDb.enable2FA("user123", "secret123", ["backup1", "backup2"]);

      const loginData = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const response = await request(app).post("/auth/login").send(loginData).expect(200);

      expect(response.body.requires2FA).toBe(true);
      expect(response.body.tempToken).toBeDefined();
      expect(response.body.accessToken).toBeUndefined(); // Should not get full access yet
    });
  });

  describe("Invalid Credentials", () => {
    it("should reject login with non-existent email", async () => {
      const loginData = {
        email: "nonexistent@example.com",
        password: "SomePassword123!",
      };

      const response = await request(app).post("/auth/login").send(loginData).expect(401);

      expect(response.body.message).toContain("Incorrect email or password");
    });

    it("should reject login with missing password", async () => {
      const loginData = {
        email: "test@example.com",
      };

      const response = await request(app).post("/auth/login").send(loginData).expect(200);

      expect(response.body.statusCode).toBe(300); // WARNING
    });
  });

  describe("OAuth Users", () => {
    it("should reject password login for OAuth-only users", async () => {
      // Create OAuth user without password
      await mockDb.createUser({
        id: "oauth_user",
        email: "oauth@example.com",
        googleId: "google123",
        roles: ["user"],
        isVerified: true,
        twoFactorEnabled: false,
      });

      const loginData = {
        email: "oauth@example.com",
        password: "SomePassword123!",
      };

      const response = await request(app).post("/auth/login").send(loginData).expect(401);

      expect(response.body.message).toContain("Incorrect email or password");
    });
  });
});
