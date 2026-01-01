import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import { DAuth } from "../../src/DAuth";
import { MockDatabaseAdapter } from "../mocks/MockDatabaseAdapter";
import { generateAccessToken } from "../../src/utils/generateTokens";

describe("Authentication Guards", () => {
  let app: express.Application;
  let mockDb: MockDatabaseAdapter;
  let dAuth: DAuth;
  let testUserId: string;
  let testAccessToken: string;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    mockDb = new MockDatabaseAdapter();

    dAuth = new DAuth({
      database: mockDb,
      jwt: {
        secret: "test-secret",
        tokenMode: "both",
      },
      roleHierarchy: {
        admin: 100,
        manager: 60,
        employee: 20,
        user: 0,
      },
    });

    // Create test user
    const user = await mockDb.createUser({
      email: "test@example.com",
      password: await bcrypt.hash("password", 10),
      roles: ["user"],
      isVerified: true,
      twoFactorEnabled: false,
    });

    testUserId = user.id;
    testAccessToken = generateAccessToken(testUserId, "session123");

    // Add session to database for blacklist validation
    await mockDb.addSession(testUserId, {
      sessionId: "session123",
      refreshToken: "test-refresh-token",
      ip: "127.0.0.1",
      deviceName: "test-device",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Protected route
    app.get("/protected", dAuth.requireAuth(), (req, res) => {
      res.json({ message: "Protected data", user: req.user });
    });

    // Role-based routes (must use requireAuth first, then requireRoles)
    app.get("/user-route", dAuth.requireAuth(), dAuth.requireRoles(["user"]), (req, res) => {
      res.json({ message: "User route" });
    });

    app.get(
      "/employee-route",
      dAuth.requireAuth(),
      dAuth.requireRoles(["employee"]),
      (req, res) => {
        res.json({ message: "Employee route" });
      }
    );

    app.get("/admin-route", dAuth.requireAuth(), dAuth.requireRoles(["admin"]), (req, res) => {
      res.json({ message: "Admin route" });
    });

    app.get(
      "/multi-role",
      dAuth.requireAuth(),
      dAuth.requireRoles(["employee", "manager"]),
      (req, res) => {
        res.json({ message: "Multi-role route" });
      }
    );
  });

  afterEach(() => {
    mockDb.reset();
    jest.clearAllMocks();
  });

  describe("requireAuth Guard", () => {
    it("should allow access with valid token in Authorization header", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.message).toBe("Protected data");
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe("test@example.com");
    });

    it("should allow access with valid token in cookie", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Cookie", [`accessToken=${testAccessToken}`])
        .expect(200);

      expect(response.body.message).toBe("Protected data");
    });

    it("should reject access without token", async () => {
      const response = await request(app).get("/protected").expect(401);

      expect(response.body.message).toBe("Authentication required");
    });

    it("should reject access with invalid token", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", "Bearer invalid-token")
        .expect(403);

      expect(response.body.message).toContain("Invalid or expired token");
    });

    it("should reject access with token for non-existent user", async () => {
      const fakeToken = generateAccessToken("nonexistent-user", "session");

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${fakeToken}`)
        .expect(403);

      expect(response.body.message).toContain("Invalid access token");
    });
  });

  describe("requireRoles Guard", () => {
    it("should allow user with exact role", async () => {
      const response = await request(app)
        .get("/user-route")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.message).toBe("User route");
    });

    it("should deny user without required role", async () => {
      const response = await request(app)
        .get("/employee-route")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(403);

      expect(response.body.message).toContain("Access denied");
      expect(response.body.message).toContain("employee");
    });

    it("should allow higher role to access lower role routes (hierarchy)", async () => {
      // Update user to admin
      await mockDb.updateUser(testUserId, { roles: ["admin"] });

      // Admin should access user route
      const response = await request(app)
        .get("/user-route")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.message).toBe("User route");
    });

    it("should allow access with ANY of the required roles", async () => {
      // Update user to employee
      await mockDb.updateUser(testUserId, { roles: ["employee"] });

      // Should access multi-role route (employee OR manager)
      const response = await request(app)
        .get("/multi-role")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.message).toBe("Multi-role route");
    });

    it("should require authentication before checking roles", async () => {
      const response = await request(app).get("/admin-route").expect(401);

      expect(response.body.message).toBe("Authentication required");
    });
  });

  describe("Role Hierarchy", () => {
    it("should enforce role hierarchy (admin > manager > employee > user)", async () => {
      // Admin user
      const adminUser = await mockDb.createUser({
        email: "admin@example.com",
        password: await bcrypt.hash("password", 10),
        roles: ["admin"],
        isVerified: true,
        twoFactorEnabled: false,
      });
      const adminToken = generateAccessToken(adminUser.id, "admin-session");

      // Add admin session to database
      await mockDb.addSession(adminUser.id, {
        sessionId: "admin-session",
        refreshToken: "admin-refresh-token",
        ip: "127.0.0.1",
        deviceName: "test-device",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Admin can access employee route
      let response = await request(app)
        .get("/employee-route")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe("Employee route");

      // Admin can access user route
      response = await request(app)
        .get("/user-route")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe("User route");
    });

    it("should deny lower roles from accessing higher role routes", async () => {
      // User cannot access admin route
      const response = await request(app)
        .get("/admin-route")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(403);

      expect(response.body.message).toContain("Access denied");
      expect(response.body.message).toContain("admin");
    });
  });

  describe("Multiple Roles", () => {
    it("should grant access if user has any of the required roles", async () => {
      // Update user to have manager role
      await mockDb.updateUser(testUserId, { roles: ["manager"] });

      // Manager can access multi-role route (employee OR manager)
      const response = await request(app)
        .get("/multi-role")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.message).toBe("Multi-role route");
    });

    it("should work with user having multiple roles", async () => {
      // User with multiple roles
      await mockDb.updateUser(testUserId, { roles: ["user", "employee", "manager"] });

      // Can access all routes
      await request(app)
        .get("/user-route")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      await request(app)
        .get("/employee-route")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);

      await request(app)
        .get("/multi-role")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);
    });
  });

  describe("Token Modes", () => {
    it("should work with cookie-only mode", async () => {
      const dAuthCookie = new DAuth({
        database: mockDb,
        jwt: {
          secret: "test-secret",
          tokenMode: "cookie",
          invalidationStrategy: "stateless", // Stateless for this test
        },
      });

      const app2 = express();
      app2.use(express.json());
      app2.use(cookieParser());
      app2.get("/protected", dAuthCookie.requireAuth(), (req, res) => {
        res.json({ message: "OK" });
      });

      // Should work with cookie
      await request(app2)
        .get("/protected")
        .set("Cookie", [`accessToken=${testAccessToken}`])
        .expect(200);

      // Should NOT work with header in cookie mode (only cookies allowed)
      await request(app2)
        .get("/protected")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(401);
    });

    it("should work with response-only mode", async () => {
      const dAuthResponse = new DAuth({
        database: mockDb,
        jwt: {
          secret: "test-secret",
          tokenMode: "response",
          invalidationStrategy: "stateless", // Stateless for this test
        },
      });

      const app3 = express();
      app3.use(express.json());
      app3.get("/protected", dAuthResponse.requireAuth(), (req, res) => {
        res.json({ message: "OK" });
      });

      // Should work with Authorization header
      await request(app3)
        .get("/protected")
        .set("Authorization", `Bearer ${testAccessToken}`)
        .expect(200);
    });
  });

  describe("JWT Invalidation Strategies", () => {
    describe("Blacklist Mode (default)", () => {
      let blacklistApp: express.Application;
      let blacklistDAuth: DAuth;
      let blacklistUserId: string;
      let blacklistToken: string;
      const blacklistSessionId = "blacklist-session-123";

      beforeEach(async () => {
        blacklistApp = express();
        blacklistApp.use(express.json());
        blacklistApp.use(cookieParser());

        blacklistDAuth = new DAuth({
          database: mockDb,
          jwt: {
            secret: "test-secret",
            tokenMode: "both",
            invalidationStrategy: "blacklist", // Explicitly set blacklist mode
          },
        });

        // Create user
        const user = await mockDb.createUser({
          email: "blacklist@example.com",
          password: await bcrypt.hash("password", 10),
          roles: ["user"],
          isVerified: true,
          twoFactorEnabled: false,
        });

        blacklistUserId = user.id;
        blacklistToken = generateAccessToken(blacklistUserId, blacklistSessionId);

        // Add session to database
        await mockDb.addSession(blacklistUserId, {
          sessionId: blacklistSessionId,
          refreshToken: "blacklist-refresh-token",
          ip: "127.0.0.1",
          deviceName: "test-device",
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        blacklistApp.get("/protected", blacklistDAuth.requireAuth(), (req, res) => {
          res.json({ message: "Protected data", user: req.user });
        });
      });

      it("should allow access with valid token and active session", async () => {
        const response = await request(blacklistApp)
          .get("/protected")
          .set("Authorization", `Bearer ${blacklistToken}`)
          .expect(200);

        expect(response.body.message).toBe("Protected data");
        expect(response.body.user.email).toBe("blacklist@example.com");
      });

      it("should reject access when session is removed (blacklist)", async () => {
        // Remove session (simulates logout)
        await mockDb.removeSession(blacklistUserId, blacklistSessionId);

        const response = await request(blacklistApp)
          .get("/protected")
          .set("Authorization", `Bearer ${blacklistToken}`)
          .expect(403);

        expect(response.body.message).toContain("Session expired or invalidated");
      });

      it("should reject access when all sessions are cleared", async () => {
        // Clear all sessions
        await mockDb.clearAllSessions(blacklistUserId);

        const response = await request(blacklistApp)
          .get("/protected")
          .set("Authorization", `Bearer ${blacklistToken}`)
          .expect(403);

        expect(response.body.message).toContain("Session expired or invalidated");
      });
    });

    describe("Stateless Mode", () => {
      let statelessApp: express.Application;
      let statelessDAuth: DAuth;
      let statelessUserId: string;
      let statelessToken: string;
      const statelessSessionId = "stateless-session-123";

      beforeEach(async () => {
        statelessApp = express();
        statelessApp.use(express.json());

        statelessDAuth = new DAuth({
          database: mockDb,
          jwt: {
            secret: "test-secret",
            tokenMode: "response",
            invalidationStrategy: "stateless", // Stateless mode
          },
        });

        // Create user
        const user = await mockDb.createUser({
          email: "stateless@example.com",
          password: await bcrypt.hash("password", 10),
          roles: ["user"],
          isVerified: true,
          twoFactorEnabled: false,
        });

        statelessUserId = user.id;
        statelessToken = generateAccessToken(statelessUserId, statelessSessionId);

        // Note: No session added to database in stateless mode

        statelessApp.get("/protected", statelessDAuth.requireAuth(), (req, res) => {
          res.json({ message: "Protected data", user: req.user });
        });
      });

      it("should allow access with valid token (no session check)", async () => {
        const response = await request(statelessApp)
          .get("/protected")
          .set("Authorization", `Bearer ${statelessToken}`)
          .expect(200);

        expect(response.body.message).toBe("Protected data");
        expect(response.body.user.email).toBe("stateless@example.com");
      });

      it("should still allow access even if session is removed (stateless)", async () => {
        // Add a session first
        await mockDb.addSession(statelessUserId, {
          sessionId: statelessSessionId,
          refreshToken: "stateless-refresh-token",
          ip: "127.0.0.1",
          deviceName: "test-device",
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        // Remove session
        await mockDb.removeSession(statelessUserId, statelessSessionId);

        // Should still work in stateless mode
        const response = await request(statelessApp)
          .get("/protected")
          .set("Authorization", `Bearer ${statelessToken}`)
          .expect(200);

        expect(response.body.message).toBe("Protected data");
      });

      it("should reject access with invalid token", async () => {
        const response = await request(statelessApp)
          .get("/protected")
          .set("Authorization", "Bearer invalid-token")
          .expect(403);

        expect(response.body.message).toContain("Invalid or expired token");
      });
    });
  });
});
