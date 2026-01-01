import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";
import { DAuth } from "../../src/DAuth";
import { MockDatabaseAdapter } from "../mocks/MockDatabaseAdapter";

describe("Register Middleware", () => {
  let app: express.Application;
  let mockDb: MockDatabaseAdapter;
  let dAuth: DAuth;
  let onUserRegisteredMock: jest.Mock;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockDb = new MockDatabaseAdapter();
    onUserRegisteredMock = jest.fn();

    dAuth = new DAuth({
      database: mockDb,
      jwt: {
        secret: "test-secret",
        tokenMode: "both",
      },
      hooks: {
        onUserRegistered: onUserRegisteredMock,
      },
    });

    app.post("/auth/register", dAuth.middleware.register);
  });

  afterEach(() => {
    mockDb.reset();
    jest.clearAllMocks();
  });

  describe("Successful Registration", () => {
    it("should register a new user with valid data", async () => {
      const userData = {
        email: "test@example.com",
        password: "SecurePass123!",
        firstName: "John",
        lastName: "Doe",
      };

      const response = await request(app).post("/auth/register").send(userData).expect(201);

      expect(response.body.message).toBe("Registration successful");
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.password).toBeUndefined(); // Password should not be returned

      // Check tokens are present (both mode)
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();

      // Check cookies are set
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      if (Array.isArray(cookies)) {
        expect(cookies.some((c: string) => c.startsWith("accessToken="))).toBe(true);
        expect(cookies.some((c: string) => c.startsWith("refreshToken="))).toBe(true);
      }

      // Verify user was created in database
      const user = await mockDb.findUserByEmail(userData.email);
      expect(user).toBeDefined();
      expect(user?.email).toBe(userData.email);

      // Verify password is hashed
      const isPasswordHashed = await bcrypt.compare(userData.password, user!.password!);
      expect(isPasswordHashed).toBe(true);

      // Verify hook was called
      expect(onUserRegisteredMock).toHaveBeenCalledWith({
        user: expect.objectContaining({
          email: userData.email,
        }),
        isOAuth: false,
      });
    });

    it("should create user session in database", async () => {
      const userData = {
        email: "test@example.com",
        password: "SecurePass123!",
        firstName: "Test",
        lastName: "User",
      };

      await request(app).post("/auth/register").send(userData).expect(201);

      const user = await mockDb.findUserByEmail(userData.email);
      const sessions = await mockDb.getAllSessions(user!.id);

      expect(sessions.length).toBe(1);
      expect(sessions[0].refreshToken).toBeDefined();
      expect(sessions[0].ip).toBeDefined();
    });
  });

  describe("Validation Errors", () => {
    it("should reject registration with missing email", async () => {
      const userData = {
        password: "SecurePass123!",
      };

      const response = await request(app).post("/auth/register").send(userData).expect(200);

      expect(response.body.statusCode).toBe(300); // WARNING status
      expect(response.body.message).toContain("email");
    });

    it("should reject registration with invalid email format", async () => {
      const userData = {
        email: "invalid-email",
        password: "SecurePass123!",
      };

      const response = await request(app).post("/auth/register").send(userData).expect(200);

      expect(response.body.statusCode).toBe(300);
      expect(response.body.message).toContain("email");
    });

    it("should reject registration with weak password", async () => {
      const userData = {
        email: "test@example.com",
        password: "123", // Too short
      };

      const response = await request(app).post("/auth/register").send(userData).expect(200);

      expect(response.body.statusCode).toBe(300);
      expect(response.body.message).toContain("Password");
    });
  });

  describe("Duplicate Email", () => {
    it("should reject registration with existing email", async () => {
      // Create existing user
      await mockDb.createUser({
        email: "existing@example.com",
        password: await bcrypt.hash("password123", 10),
        roles: ["user"],
        isVerified: false,
        twoFactorEnabled: false,
      });

      const userData = {
        email: "existing@example.com",
        password: "NewPass123!",
        firstName: "Existing",
        lastName: "User",
      };

      const response = await request(app).post("/auth/register").send(userData).expect(200);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain("already exists");
    });
  });

  describe("Token Modes", () => {
    it('should return tokens in response body for "response" mode', async () => {
      const dAuthResponse = new DAuth({
        database: mockDb,
        jwt: {
          secret: "test-secret",
          tokenMode: "response", // Response mode only
        },
      });

      const app2 = express();
      app2.use(express.json());
      app2.post("/auth/register", dAuthResponse.middleware.register);

      const userData = {
        email: "test2@example.com",
        password: "SecurePass123!",
        firstName: "Test",
        lastName: "User",
      };

      const response = await request(app2).post("/auth/register").send(userData).expect(201);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();

      // Cookies should NOT be set in response mode
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeUndefined();
    });

    it('should set cookies only for "cookie" mode', async () => {
      const dAuthCookie = new DAuth({
        database: mockDb,
        jwt: {
          secret: "test-secret",
          tokenMode: "cookie", // Cookie mode only
        },
      });

      const app3 = express();
      app3.use(express.json());
      app3.post("/auth/register", dAuthCookie.middleware.register);

      const userData = {
        email: "test3@example.com",
        password: "SecurePass123!",
        firstName: "Test",
        lastName: "User",
      };

      const response = await request(app3).post("/auth/register").send(userData).expect(201);

      // Tokens should NOT be in response body for cookie mode
      expect(response.body.accessToken).toBeUndefined();
      expect(response.body.refreshToken).toBeUndefined();

      // Cookies should be set
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      if (Array.isArray(cookies)) {
        expect(cookies.some((c: string) => c.startsWith("accessToken="))).toBe(true);
      }
    });
  });

  describe("Role Assignment", () => {
    it('should assign default "user" role if no roles specified', async () => {
      const userData = {
        email: "test@example.com",
        password: "SecurePass123!",
        firstName: "Test",
        lastName: "User",
      };

      await request(app).post("/auth/register").send(userData).expect(201);

      const user = await mockDb.findUserByEmail(userData.email);
      expect(user?.roles).toContain("user");
    });

    it("should accept custom roles in request", async () => {
      const userData = {
        email: "test-roles@example.com",
        password: "SecurePass123!",
        firstName: "Test",
        lastName: "User",
        roles: ["user", "employee"],
      };

      await request(app).post("/auth/register").send(userData).expect(201);

      const user = await mockDb.findUserByEmail(userData.email);
      expect(user?.roles).toContain("user");
      expect(user?.roles).toContain("employee");
    });
  });
});
