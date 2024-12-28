import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import User from '../models/User';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import bcrypt from 'bcryptjs';

interface GoogleLoginDetails {
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackURL: string;
}

interface FacebookLoginDetails {
  facebookAppId: string;
  facebookAppSecret: string;
  facebookCallbackURL: string;
}

export interface AuthOptions {
  enableGoogleLogin: boolean;
  enableFacebookLogin: boolean;
  googleLoginDetails?: GoogleLoginDetails;
  facebookLoginDetails?: FacebookLoginDetails;
  onlyUseSession?: boolean
}

/**
 * Configures Passport.js strategies for authentication.
 *
 * @param {AuthOptions} options - Authentication options, including Google, Facebook, and local strategy settings.
 * @return {void}
 */
export function passportConfig(options: AuthOptions) {

  
}
