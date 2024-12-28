import express, { Express, Request, Response } from "express";
import { AuthenticatedRequest, authenticateApiMiddleware, dAuthMiddleware } from "./middleware/authMiddleware";
import dotenv from "dotenv";
import path from 'path';
import cookieParser from "cookie-parser";
import cors from "cors";
import session from "express-session";
import { REFRESH_TOKEN_EXP_TIME } from "./utils/generateTokens";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

app.use(session({
    name: 'd-auth-session',
    secret: [process.env.SESSION_SECRET!],
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: false, // Use secure cookies (HTTPS)
      sameSite: 'lax', // Default to lax
      path: '/',
      maxAge: REFRESH_TOKEN_EXP_TIME
    }
  }));

const allowlist = ['http://localhost:5173', 'https://web.bevarc.com/', 'https://bevarc.com/', "*"];

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());


dAuthMiddleware(app, {
  enableFacebookLogin: false,
  enableGoogleLogin: true,
  googleLoginDetails: {
    googleClientId: process.env.GOOGLE_CLIENT_ID!,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    googleCallbackURL: "/auth/google/callback",
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
    address: "123 Main Street, Sheohar, Bihar 844416"
  },
  nodeMailerConfig: {
    auth: {
      user: process.env.EMAIL_USERNAME!,
      pass: process.env.EMAIL_PASSWORD!,
    },
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: true
  },
  onlyUseSession: true,

});

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

// Define routes
app.get('/api/public/data', (req: Request, res: Response) => {
  res.send('This is a public route');
});

app.get('/api/private/data', (req: AuthenticatedRequest, res: Response) => {
  // Only authenticated users will reach here
  res.send(`Hello, ${req.user.email}`);
});

app.get('/auth/privacy-policy', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy-policy.html'));
});

app.get('/auth/terms-of-service', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, 'public', 'terms-of-service.html'));
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
