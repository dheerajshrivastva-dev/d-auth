import express, { Express, Request, Response } from "express";
import { AuthenticatedRequest, authenticateApiMiddleware, dAuthMiddleware } from "./middleware/authMiddleware";
import dotenv from "dotenv";
import path from 'path';
import cookieParser from "cookie-parser";
import cors from "cors";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin:"*" , 
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());


dAuthMiddleware(app, {
  enableFacebookLogin: false,
  enableGoogleLogin: true,
  mongoDbUri: process.env.MONGO_URI!,
  sessionSecret: process.env.SESSION_SECRET!,
  authRouteinitials: "/auth"
});

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

app.use('/api', authenticateApiMiddleware);

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
