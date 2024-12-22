import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import User from '../models/User';
import { Strategy as FacebookStrategy } from 'passport-facebook';

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
}

/**
 * Configures Passport.js strategies for authentication.
 *
 * @param {AuthOptions} options - Authentication options, including Google, Facebook, and local strategy settings.
 * @return {void}
 */
export function passportConfig(options: AuthOptions) {
  // Google OAuth strategy
  if (options.enableGoogleLogin && options.googleLoginDetails) {
    if (!options.googleLoginDetails.googleClientId || !options.googleLoginDetails.googleClientSecret || !options.googleLoginDetails.googleCallbackURL) {
      throw new Error('Google login is enabled but Google credentials are missing.');
    }
    passport.use(
      new GoogleStrategy({
        clientID: options.googleLoginDetails.googleClientId!,
        clientSecret: options.googleLoginDetails.googleClientSecret!,
        callbackURL: options.googleLoginDetails.googleCallbackURL ||'/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = {
            googleId: profile.id,
            accessToken,
            email: profile.emails?.[0].value,
          }
          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      })
    );
  }

  // Local Strategy for email/password login
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        // const isMatch = await bcrypt.compare(password, user.password);
        const user = {
          email,
          password
        }
        // Return user and tokens
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  // Facebook OAuth Strategy
  if (options.enableFacebookLogin && options.facebookLoginDetails) {
    if (!options.facebookLoginDetails.facebookAppId || !options.facebookLoginDetails.facebookAppSecret || !options.facebookLoginDetails.facebookCallbackURL) {
      throw new Error('Facebook login is enabled but Facebook credentials are missing.');
    }
    passport.use(
      new FacebookStrategy(
        {
          clientID: options.facebookLoginDetails.facebookAppId!,
          clientSecret: options.facebookLoginDetails.facebookAppSecret!,
          callbackURL: options.facebookLoginDetails.facebookCallbackURL || '/auth/facebook/callback',
          profileFields: ['id', 'emails', 'name'] // Get email and name
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
  
            const user = {
              facebookId: profile.id,
              email: profile.emails?.[0].value,
              accessToken,
            };
  
            return done(null, user);
          } catch (error) {
            return done(error, null);
          }
        }
      )
    );
  }

  // Apple OAuth Strategy
  // passport.use(
  //   new AppleStrategy(
  //     {
  //       clientID: process.env.APPLE_CLIENT_ID!,
  //       teamID: process.env.APPLE_TEAM_ID!,
  //       keyID: process.env.APPLE_KEY_ID!,
  //       privateKeyString: process.env.APPLE_PRIVATE_KEY!,
  //       callbackURL: '/auth/apple/callback',
  //     },
  //     async (accessToken, refreshToken, profile, done) => {
  //       try {
  //         let user = await User.findOne({ appleId: profile.id });
  //         if (!user) {
  //           user = await User.create({
  //             appleId: profile.id,
  //             email: profile.email,
  //             tokens: [{ accessToken, refreshToken }],
  //           });
  //         }
  //         return done(null, user);
  //       } catch (error) {
  //         return done(error, null);
  //       }
  //     }
  //   )
  // );


  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}
