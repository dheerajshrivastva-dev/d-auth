import { SessionOptions } from "express-session";
import { REFRESH_TOKEN_EXP_TIME } from "../utils/generateTokens";
import MongoStore from "connect-mongo";
import { DAuthOptions } from "../middleware/authMiddleware";
import { Options } from "express-rate-limit";
import { CorsOptions } from "cors";

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | 'strict' | 'lax' | 'none';
  domain?: string;
  path?: string;
  maxAge?: number;
}

export interface NodeMailerConfig {
  auth: {
    user: string;
    pass: string;
  };
  /**
   * Default service is "Gmail"
   */
  service?: string;
  /**
   * Default host is "smtp.gmail.com"
   */
  host?: string;
  /**
   * Default port is 587
   */
  port?: number;
  /**
   * Default secure: true
   */
  secure?: boolean;

}

export interface CompanyDetails {
  name: string;
  address: string;
  contact: string;
  website?: string;
  privacyPolicy?: string;
  termsOfService?: string;
  support?: string;
}

class AuthConfig {
  private static _instance: AuthConfig | null = null;
  cookieOptions: CookieOptions;
  nodeMailerConfig: NodeMailerConfig;
  /**
   * Default company name
   */
  companyDetails: CompanyDetails;

  sessionOptions: SessionOptions;

  sessionSecret: string;
  mongoDbUri: string;

  rateLimitOptions: Partial<Options>;

  corsOptions: CorsOptions;

  private constructor() {
    // Set default values
    this.cookieOptions = {
      httpOnly: true,
      secure: true, // Use secure cookies (HTTPS)
      sameSite: 'lax', // Default to lax
      path: '/',
      maxAge: REFRESH_TOKEN_EXP_TIME
    };
    this.nodeMailerConfig = {
      auth: {
        user: process.env.NODE_MAILER_USER!,
        pass: process.env.NODE_MAILER_PASS!,
      },
      service: 'Gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: true
    };
    this.companyDetails = {
      name: "D-Auth",
      website: "https://d-auth.com",
      contact: "https://d-auth.com/contact",
      privacyPolicy: "https://d-auth.com/privacy-policy",
      termsOfService: "https://d-auth.com/terms-of-service",
      support: "https://d-auth.com/support",
      address: "123 Main Street, Sheohar, Bihar 844416"
    };
    this.sessionSecret = process.env.SESSION_SECRET! || "secret";
    this.mongoDbUri = process.env.MONGO_URI!;
    this.sessionOptions = {
      name: 'd-auth-session',
      secret: process.env.SESSION_SECRET! || "secret",
      resave: false,
      saveUninitialized: false,
      store: new MongoStore({
        mongoUrl: process.env.MONGO_URI!,
        ttl: REFRESH_TOKEN_EXP_TIME, // 1 days
        autoRemove: 'native'
      }),
      cookie: {
      httpOnly: true,
      secure: true, // Use secure cookies (HTTPS)
      sameSite: 'lax', // Default to lax
      path: '/',
      maxAge: REFRESH_TOKEN_EXP_TIME
    }
    }
    this.rateLimitOptions = {
      windowMs: 5 * 60 * 1000, // 15 minutes
      max: 500, // Limit each IP to 2000 requests per windowMs
      message: 'Too many requests, please try again later',
      legacyHeaders: false,
    }
    this.corsOptions = {
      origin: "*",
      credentials: true,
    }
  }

  // Singleton pattern to get a single instance of AuthConfig
  static getInstance(): AuthConfig {
    if (!this._instance) {
      this._instance = new AuthConfig();
    }
    return this._instance;
  }

  setCompanyDetails(details: CompanyDetails) {
    this.companyDetails = details;
  }

  setNodeMailerConfig(config: NodeMailerConfig) {
    this.nodeMailerConfig = config;
  }

  // Update configuration with user-provided options
  setCookieOptions(options: CookieOptions) {
    this.cookieOptions = { ...this.cookieOptions, ...options };
  }

  setSessionOptions(options?: SessionOptions) {
    if (!options) {
      return;
    }
    this.sessionOptions = { ...this.cookieOptions, ...options };
  }

  setConfiguration(options: DAuthOptions) {
    if (options.cookieOptions) {
      this.cookieOptions = { ...this.cookieOptions, ...options.cookieOptions };
    }
    this.setNodeMailerConfig(options.nodeMailerConfig);
    this.setCompanyDetails(options.companyDetails);
    this.mongoDbUri = options.mongoDbUri;
    if (options.sessionSecret) {
      this.sessionSecret = options.sessionSecret;
      this.sessionOptions.secret = options.sessionSecret;
    }
    if (options.sessionOptions) {
      this.sessionOptions = { ...this.sessionOptions, ...options.sessionOptions };
    }
    if (options.rateLimitOptions) {
      this.rateLimitOptions = { ...this.rateLimitOptions, ...options.rateLimitOptions };
    }
    if (options.corsOptions) {
      this.corsOptions = { ...this.corsOptions, ...options.corsOptions };
    }
  }
}

export default AuthConfig;

