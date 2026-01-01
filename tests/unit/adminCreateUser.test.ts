import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";
import { DAuth } from "../../src/DAuth";
import { MockDatabaseAdapter } from "../mocks/MockDatabaseAdapter";

describe("Admin Create User & Force Password Reset", () => {
  let app: express.Application;
  let mockDb: MockDatabaseAdapter;
  let dAuth: DAuth;
  let onUserCreatedWithTempPasswordMock: jest.Mock;
  let onPasswordResetMock: jest.Mock;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockDb = new MockDatabaseAdapter();
    onUserCreatedWithTempPasswordMock = jest.fn();
    onPasswordResetMock = jest.fn();

    dAuth = new DAuth({
      database: mockDb,
      jwt: {
        secret: "test-secret",
        tokenMode: "both",
      },
      hooks: {
        onUserCreatedWithTempPassword: onUserCreatedWithTempPasswordMock,
        onPasswordReset: onPasswordResetMock,
      },
    });

    app.post("/admin/create-user", dAuth.middleware.adminCreateUser);
    app.post("/auth/force-password-reset", dAuth.middleware.forcePasswordReset);
  });

  afterEach(() => {
    mockDb.reset();
    jest.clearAllMocks();
  });

  describe("Admin Create User", () => {
    it("should create user with temporary password", async () => {
      const userData = {
        email: "newuser@example.com",
        firstName: "Jane",
        lastName: "Smith",
        roles: ["user", "employee"],
      };

      const response = await request(app).post("/admin/create-user").send(userData).expect(201);

      expect(response.body.message).toContain("Temporary password sent");
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.mustResetPassword).toBe(true);

      // Verify user was created
      const user = await mockDb.findUserByEmail(userData.email);
      expect(user).toBeDefined();
      expect(user?.isTemporaryPassword).toBe(true);
      expect(user?.mustResetPassword).toBe(true);
      expect(user?.password).toBeDefined(); // Password should be hashed

      // Verify hook was called with temporary password
      expect(onUserCreatedWithTempPasswordMock).toHaveBeenCalledWith({
        user: expect.objectContaining({
          email: userData.email,
        }),
        temporaryPassword: expect.any(String),
        email: userData.email,
      });

      // Get the temp password from hook call
      const tempPassword = onUserCreatedWithTempPasswordMock.mock.calls[0][0].temporaryPassword;

      // Verify temp password is strong (12 chars, mixed case, numbers, special)
      expect(tempPassword.length).toBe(12);
      expect(tempPassword).toMatch(/[A-Z]/); // Uppercase
      expect(tempPassword).toMatch(/[a-z]/); // Lowercase
      expect(tempPassword).toMatch(/[0-9]/); // Number
      expect(tempPassword).toMatch(/[!@#$%^&*]/); // Special char
    });

    it("should create user with default roles if not specified", async () => {
      const userData = {
        email: "newuser@example.com",
        firstName: "John",
      };

      await request(app).post("/admin/create-user").send(userData).expect(201);

      const user = await mockDb.findUserByEmail(userData.email);
      expect(user?.roles).toContain("user");
    });

    it("should reject creation of user with existing email", async () => {
      // Create existing user
      await mockDb.createUser({
        email: "existing@example.com",
        password: "hashed",
        roles: ["user"],
        isVerified: false,
        twoFactorEnabled: false,
      });

      const userData = {
        email: "existing@example.com",
        firstName: "Test",
      };

      const response = await request(app).post("/admin/create-user").send(userData).expect(400);

      expect(response.body.message).toContain("already exists");
    });

    it("should require email field", async () => {
      const userData = {
        firstName: "John",
        lastName: "Doe",
      };

      const response = await request(app).post("/admin/create-user").send(userData).expect(400);

      expect(response.body.message).toContain("Email is required");
    });
  });

  describe("Force Password Reset", () => {
    let tempPassword: string;
    let userEmail: string;

    beforeEach(async () => {
      // Create user with temp password
      userEmail = "tempuser@example.com";
      tempPassword = "TempPass123!";
      const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

      await mockDb.createUser({
        id: "temp_user",
        email: userEmail,
        password: hashedTempPassword,
        roles: ["user"],
        isVerified: false,
        isTemporaryPassword: true,
        mustResetPassword: true,
        twoFactorEnabled: false,
      });
    });

    it("should allow user to reset temporary password", async () => {
      const resetData = {
        email: userEmail,
        temporaryPassword: tempPassword,
        newPassword: "MyNewSecurePass456!",
      };

      const response = await request(app)
        .post("/auth/force-password-reset")
        .send(resetData)
        .expect(200);

      expect(response.body.message).toContain("reset successfully");

      // Verify password was changed
      const user = await mockDb.findUserById("temp_user");
      expect(user?.isTemporaryPassword).toBe(false);
      expect(user?.mustResetPassword).toBe(false);
      expect(user?.isVerified).toBe(true); // Auto-verified

      // Verify new password works
      const isNewPasswordValid = await bcrypt.compare(resetData.newPassword, user!.password!);
      expect(isNewPasswordValid).toBe(true);

      // Verify old password doesn't work
      const isOldPasswordValid = await bcrypt.compare(tempPassword, user!.password!);
      expect(isOldPasswordValid).toBe(false);

      // Verify hook was called
      expect(onPasswordResetMock).toHaveBeenCalledWith({
        user: expect.objectContaining({
          email: userEmail,
        }),
        ip: expect.any(String),
      });
    });

    it("should reject reset with wrong temporary password", async () => {
      const resetData = {
        email: userEmail,
        temporaryPassword: "WrongTempPass123!",
        newPassword: "MyNewSecurePass456!",
      };

      const response = await request(app)
        .post("/auth/force-password-reset")
        .send(resetData)
        .expect(401);

      expect(response.body.message).toContain("Invalid temporary password");

      // Verify password wasn't changed
      const user = await mockDb.findUserById("temp_user");
      expect(user?.isTemporaryPassword).toBe(true);
      expect(user?.mustResetPassword).toBe(true);
    });

    it("should reject reset for non-existent user", async () => {
      const resetData = {
        email: "nonexistent@example.com",
        temporaryPassword: tempPassword,
        newPassword: "NewPass123!",
      };

      const response = await request(app)
        .post("/auth/force-password-reset")
        .send(resetData)
        .expect(400);

      expect(response.body.message).toContain("User not found");
    });

    it("should reject reset for user without temporary password", async () => {
      // Create normal user
      await mockDb.createUser({
        id: "normal_user",
        email: "normal@example.com",
        password: await bcrypt.hash("normalpass", 10),
        roles: ["user"],
        isVerified: true,
        isTemporaryPassword: false,
        mustResetPassword: false,
        twoFactorEnabled: false,
      });

      const resetData = {
        email: "normal@example.com",
        temporaryPassword: "somepass",
        newPassword: "NewPass123!",
      };

      const response = await request(app)
        .post("/auth/force-password-reset")
        .send(resetData)
        .expect(400);

      expect(response.body.message).toContain("does not have a temporary password");
    });

    it("should require all fields", async () => {
      const resetData = {
        email: userEmail,
        // Missing temporaryPassword and newPassword
      };

      const response = await request(app)
        .post("/auth/force-password-reset")
        .send(resetData)
        .expect(400);

      expect(response.body.message).toContain("required");
    });
  });

  describe("Integration: Create User -> Force Reset -> Login", () => {
    it("should complete full workflow", async () => {
      // Step 1: Admin creates user
      const createResponse = await request(app)
        .post("/admin/create-user")
        .send({
          email: "workflow@example.com",
          firstName: "Test",
        })
        .expect(201);

      expect(createResponse.body.data.user.mustResetPassword).toBe(true);

      // Get temp password from hook
      const tempPassword = onUserCreatedWithTempPasswordMock.mock.calls[0][0].temporaryPassword;

      // Step 2: User resets password
      const resetResponse = await request(app)
        .post("/auth/force-password-reset")
        .send({
          email: "workflow@example.com",
          temporaryPassword: tempPassword,
          newPassword: "MyNewPass123!",
        })
        .expect(200);

      expect(resetResponse.body.message).toContain("reset successfully");

      // Step 3: User can now login
      const app2 = express();
      app2.use(express.json());
      app2.post("/auth/login", dAuth.middleware.login);

      const loginResponse = await request(app2)
        .post("/auth/login")
        .send({
          email: "workflow@example.com",
          password: "MyNewPass123!",
        })
        .expect(200);

      expect(loginResponse.body.message).toBe("Login successful");
      expect(loginResponse.body.accessToken).toBeDefined();
    });
  });
});
