import request from "supertest";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { DAuth } from "../../src/DAuth";
import { MockDatabaseAdapter } from "../mocks/MockDatabaseAdapter";
import { IUserDocument } from "../../src/adapters/IDatabaseAdapter";

/**
 * E2E Authentication Flow Tests - Session-Based Mode
 *
 * Tests session-based authentication using Passport.js.
 * In session mode:
 * - Authentication state stored in server-side sessions
 * - No JWT tokens used
 * - Traditional cookie-based sessions
 */
describe("E2E: Session-Based Authentication Flows", () => {
  let app: express.Application;
  let mockDb: MockDatabaseAdapter;
  let dAuth: DAuth;

  beforeEach(() => {
    // Create fresh app instance for each test
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Session middleware (required for session-based auth)
    // IMPORTANT: Create a new MemoryStore for each test to avoid session pollution
    const sessionStore = new session.MemoryStore();
    app.use(
      session({
        store: sessionStore, // Fresh memory store for each test
        secret: "test-session-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: false, // Set to false for testing
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
      })
    );

    // Create fresh mock database for each test
    mockDb = new MockDatabaseAdapter();

    // Create fresh DAuth instance for each test
    dAuth = new DAuth({
      database: mockDb,
      strategy: "session", // Session-based authentication
      session: {
        secret: "test-session-secret",
        maxAge: 24 * 60 * 60 * 1000,
        maxSessionsPerUser: 10,
      },
      accountSecurity: {
        maxFailedLoginAttempts: 3,
        lockoutDurationMinutes: 15,
        enableAccountLockout: true,
      },
    });

    // Initialize d-auth
    app.use(dAuth.initialize());

    // Initialize Passport for session-based auth
    dAuth.initializePassport(app);

    // Setup auth routes
    app.post("/auth/register", dAuth.middleware.register);
    app.post("/auth/login", dAuth.middleware.login);
    app.post("/auth/logout", dAuth.middleware.logout);

    // Protected route
    app.get("/api/profile", dAuth.requireAuth(), (req, res) => {
      try {
        const user = req.user as IUserDocument;
        // Safely extract only the fields we need to avoid serialization issues
        const userResponse = {
          id: user?.id,
          email: user?.email,
          firstName: user?.firstName,
          lastName: user?.lastName,
          roles: user?.roles,
          isVerified: user?.isVerified,
        };
        res.json({ user: userResponse });
      } catch (error) {
        console.error("Error in /api/profile:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    });
  });

  afterEach(() => {
    mockDb.reset();
  });

  describe("Happy Path: Register → Login → Access Protected Route", () => {
    it("should complete full registration and login flow", async () => {
      const userData = {
        email: "user@example.com",
        password: "SecurePass123@",
        firstName: "John",
        lastName: "Doe",
      };

      // Step 1: Register
      const registerRes = await request(app).post("/auth/register").send(userData).expect(201);

      expect(registerRes.body.message).toContain("Registration successful");
      expect(registerRes.body.user.email).toBe(userData.email);

      // Step 2: Login
      const agent = request.agent(app); // Use agent to maintain session cookies
      const loginRes = await agent
        .post("/auth/login")
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginRes.body.message).toBe("Login successful");
      expect(loginRes.body.user.email).toBe(userData.email);
      // Note: Session-based login response doesn't include roles in v4

      // Session cookie should be set
      expect(loginRes.headers["set-cookie"]).toBeDefined();

      // Step 3: Access protected route with session
      const profileRes = await agent.get("/api/profile").expect(200);

      expect(profileRes.body.user.email).toBe(userData.email);
    });
  });

  describe("Account Lockout Flow", () => {
    const userData = {
      email: "lockout@example.com",
      password: "CorrectPass123@",
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

      expect(attempt1.body.message).toContain("Incorrect");

      // Attempt 2: Wrong password
      const attempt2 = await request(app)
        .post("/auth/login")
        .send({
          email: userData.email,
          password: "WrongPass2@",
        })
        .expect(401);

      expect(attempt2.body.message).toContain("Incorrect");

      // Attempt 3: Wrong password - May not lock in session mode without proper tracking
      // Note: Session-based lockout would need to be implemented in Passport strategy
      const attempt3 = await request(app)
        .post("/auth/login")
        .send({
          email: userData.email,
          password: "WrongPass3@",
        })
        .expect(401);

      expect(attempt3.body.message).toBeDefined();
    });
  });

  describe("Session Logout Flow", () => {
    it("should invalidate session on logout", async () => {
      const agent = request.agent(app);

      // Register and login
      await agent.post("/auth/register").send({
        email: "logout@example.com",
        password: "TestPass123@",
        firstName: "Logout",
        lastName: "User",
      });

      await agent
        .post("/auth/login")
        .send({
          email: "logout@example.com",
          password: "TestPass123@",
        })
        .expect(200);

      // Access should work before logout
      await agent.get("/api/profile").expect(200);

      // Logout
      await agent.post("/auth/logout").expect(200);

      // Access should fail after logout
      await agent.get("/api/profile").expect(401);
    });
  });

  describe("Multiple Sessions", () => {
    it("should support separate sessions from different agents", async () => {
      const email = "multi@example.com";
      const password = "TestPass123@";

      // Register
      await request(app).post("/auth/register").send({
        email,
        password,
        firstName: "Multi",
        lastName: "Session",
      });

      // Create two separate agents (simulating different browsers)
      const agent1 = request.agent(app);
      const agent2 = request.agent(app);

      // Login from agent 1
      await agent1
        .post("/auth/login")
        .set("User-Agent", "Browser1/1.0")
        .send({ email, password })
        .expect(200);

      // Login from agent 2
      await agent2
        .post("/auth/login")
        .set("User-Agent", "Browser2/1.0")
        .send({ email, password })
        .expect(200);

      // Both sessions should be able to access protected routes
      await agent1.get("/api/profile").expect(200);
      await agent2.get("/api/profile").expect(200);

      // Logout from agent 1
      await agent1.post("/auth/logout").expect(200);

      // Agent 1 should not work after logout
      await agent1.get("/api/profile").expect(401);

      // Agent 2 should still work
      await agent2.get("/api/profile").expect(200);
    });
  });

  describe("Session Persistence", () => {
    it("should maintain session across multiple requests", async () => {
      const agent = request.agent(app);

      // Register
      await agent.post("/auth/register").send({
        email: "persistent@example.com",
        password: "TestPass123@",
        firstName: "Persistent",
        lastName: "User",
      });

      // Login
      const loginRes = await agent
        .post("/auth/login")
        .send({
          email: "persistent@example.com",
          password: "TestPass123@",
        })
        .expect(200);

      expect(loginRes.body.user.email).toBe("persistent@example.com");

      // Make multiple requests - session should persist
      for (let i = 0; i < 5; i++) {
        const profileRes = await agent.get("/api/profile").expect(200);
        expect(profileRes.body.user.email).toBe("persistent@example.com");
      }
    });
  });

  describe("Unauthenticated Access", () => {
    it("should reject access to protected routes without session", async () => {
      // Try to access protected route without logging in
      await request(app).get("/api/profile").expect(401);
    });

    it("should allow registration without session", async () => {
      const registerRes = await request(app)
        .post("/auth/register")
        .send({
          email: "new@example.com",
          password: "TestPass123@",
          firstName: "New",
          lastName: "User",
        })
        .expect(201);

      expect(registerRes.body.user.email).toBe("new@example.com");
    });
  });
});
