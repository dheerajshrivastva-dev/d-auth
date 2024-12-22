import { REFRESH_TOKEN_EXP_TIME } from "../utils/generateTokens";

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
  companyDetails: CompanyDetails = {
    name: "D-Auth",
    website: "https://d-auth.com",
    contact: "https://d-auth.com/contact",
    privacyPolicy: "https://d-auth.com/privacy-policy",
    termsOfService: "https://d-auth.com/terms-of-service",
    support: "https://d-auth.com/support",
    address: "123 Main Street, Sheohar, Bihar 844416"
  }

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
    }
    this.companyDetails = {
      name: "D-Auth",
      website: "https://d-auth.com",
      contact: "https://d-auth.com/contact",
      privacyPolicy: "https://d-auth.com/privacy-policy",
      termsOfService: "https://d-auth.com/terms-of-service",
      support: "https://d-auth.com/support",
      address: "123 Main Street, Sheohar, Bihar 844416"
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
}

export default AuthConfig;

