import { REFRESH_TOKEN_EXP_TIME } from "../utils/generateTokens";

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | 'strict' | 'lax' | 'none';
  domain?: string;
  path?: string;
  maxAge?: number;
}

class AuthConfig {
  private static _instance: AuthConfig | null = null;
  cookieOptions: CookieOptions;

  private constructor() {
    // Set default values
    this.cookieOptions = {
      httpOnly: true,
      secure: true, // Use secure cookies (HTTPS)
      sameSite: 'lax', // Default to lax
      path: '/',
      maxAge: REFRESH_TOKEN_EXP_TIME
    };
  }

  // Singleton pattern to get a single instance of AuthConfig
  static getInstance(): AuthConfig {
    if (!this._instance) {
      this._instance = new AuthConfig();
    }
    return this._instance;
  }

  // Update configuration with user-provided options
  setCookieOptions(options: CookieOptions) {
    this.cookieOptions = { ...this.cookieOptions, ...options };
  }
}

export default AuthConfig;

