import express, { Express, Request, Response } from "express";
import { AuthenticatedRequest, authenticateApiMiddleware, dAuthMiddleware } from "./middleware/authMiddleware";
import dotenv from "dotenv";
import path from 'path';
import userRouter from "./routes/userRouter";
import { REFRESH_TOKEN_EXP_TIME } from "./utils/generateTokens";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

dAuthMiddleware(app, {
  mongoDbUri: process.env.DATABASE_URL!,
  sessionSecret: process.env.SESSION_SECRET!,
  enableGoogleLogin: true,
  googleLoginDetails: {
    googleClientId: process.env.GOOGLE_CLIENT_ID!,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  enableFacebookLogin: false,
  authRouteinitials: "/auth",
  companyDetails: {
    name: "Bevarc pvt. ltd.",
    website: "https://bevarc.com",
    contact: "https://bevarc.com/contact-us",
    address: "https://bevarc.com/contact-us",
    support: "https://bevarc.com/contact-us",
    privacyPolicy: "https://bevarc.com/privacy-policy",
    termsOfService: "https://bevarc.com/terms-of-service",
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
  rateLimitOptions: {
    windowMs: 5 * 60 * 1000,
    limit: 500,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: "to many request please try the service after 5 minutes",
  },
  corsOptions: {
    origin: process.env.CORS_ORIGIN === "*" ? "*" : process.env.CORS_ORIGIN?.split(","),
    credentials: true,
  },
  sessionOptions: {
    name: "bevarc-auth-session",
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
});

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

app.use('/api', authenticateApiMiddleware);

app.use("/api", userRouter);

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
