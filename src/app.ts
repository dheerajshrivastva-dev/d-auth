import express, { Express, Request, Response } from "express";
import { AuthenticatedRequest, dAuthMiddleware, requireRoles } from "./middleware/authMiddleware";
import { UserRole } from "./models/User";
import dotenv from "dotenv";
import path from "path";
import userRouter from "./routes/userRouter";
import userController from "./controllers/userController";
import { REFRESH_TOKEN_EXP_TIME } from "./utils/generateTokens";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

dAuthMiddleware({
  enableFacebookLogin: false,
  enableGoogleLogin: true,
  googleLoginDetails: {
    googleClientId: process.env.GOOGLE_CLIENT_ID!,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
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
    address: "123 Main Street",
  },
  nodeMailerConfig: {
    auth: {
      user: process.env.EMAIL_USERNAME!,
      pass: process.env.EMAIL_PASSWORD!,
    },
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: true,
  },
  corsOptions: {
    origin: "http://localhost:5173",
  },
  sessionOptions: {
    name: "dauth-auth-session",
    secret: process.env.SESSION_SECRET! || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Use secure cookies (HTTPS)
      sameSite: "lax", // Default to lax
      path: "/",
      maxAge: REFRESH_TOKEN_EXP_TIME,
    },
  },
  // Optional: Custom role hierarchy (if not provided, uses default)
  // roleHierarchy: {
  //   [UserRole.ADMIN]: 100,
  //   [UserRole.MANAGER]: 50,
  //   [UserRole.EMPLOYEE]: 20,
  //   [UserRole.USER]: 0,
  // }
})(app);

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

// User router - requires USER role or higher
app.use("/api", requireRoles([UserRole.USER]), userRouter);

// Public route - no authentication required
app.get("/api/public/data", requireRoles([]), (req: Request, res: Response) => {
  res.send("This is a public route");
});

// Private route - requires authentication
app.get(
  "/api/private/data",
  requireRoles([UserRole.USER]),
  (req: AuthenticatedRequest, res: Response) => {
    res.send(`Hello, ${req.user.email}`);
  }
);

app.get("/auth/privacy-policy", (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, "public", "privacy-policy.html"));
});

app.get("/auth/terms-of-service", (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, "public", "terms-of-service.html"));
});

app.get("/api/v1/user/me", requireRoles([UserRole.USER]), userController.me);

// ============================================
// RBAC Examples - Role-Based Access Control with HIERARCHY
// ============================================

// Example 1: Admin-only route (highest level)
app.get(
  "/api/admin/stats",
  requireRoles([UserRole.ADMIN]),
  (req: AuthenticatedRequest, res: Response) => {
    res.send(`Admin Stats - Welcome ${req.user.email}`);
    // Only ADMIN can access (level 100)
  }
);

// Example 2: Manager route - Hierarchy means Admin can also access!
app.get(
  "/api/manager/reports",
  requireRoles([UserRole.MANAGER]),
  (req: AuthenticatedRequest, res: Response) => {
    res.send(`Manager Reports - Role: ${req.user.roles?.join(", ")}`);
    // ADMIN (100), MODERATOR (80), MANAGER (60) can access
    // Supervisor, Employee, Staff, User CANNOT
  }
);

// Example 3: Employee route - All higher roles can access
app.get(
  "/api/employee/dashboard",
  requireRoles([UserRole.EMPLOYEE]),
  (req: AuthenticatedRequest, res: Response) => {
    res.send(`Employee Dashboard - Role: ${req.user.roles?.join(", ")}`);
    // ADMIN, MODERATOR, MANAGER, SUPERVISOR, EMPLOYEE can access
    // NO NEED to list multiple roles! Hierarchy handles it automatically
  }
);

// Example 4: Staff route - Even more roles can access
app.get(
  "/api/staff/schedule",
  requireRoles([UserRole.STAFF]),
  (req: AuthenticatedRequest, res: Response) => {
    res.send(`Staff Schedule - User: ${req.user.firstName}`);
    // ADMIN, MODERATOR, MANAGER, SUPERVISOR, EMPLOYEE, STAFF can access
    // Only USER cannot access
  }
);

// Example 5: User route - Everyone authenticated can access
app.get(
  "/api/user/profile",
  requireRoles([UserRole.USER]),
  (req: AuthenticatedRequest, res: Response) => {
    res.send(`Your Profile - ${req.user.email}`);
    // ALL authenticated users can access (USER is base level)
  }
);

// Example 6: Multiple roles - User needs ANY of these roles (or higher)
app.get(
  "/api/schedule",
  requireRoles([UserRole.STAFF, UserRole.EMPLOYEE]),
  (req: AuthenticatedRequest, res: Response) => {
    res.send("Staff/Employee Schedule");
    // Staff, Employee, Supervisor, Manager, Moderator, Admin can access
  }
);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
