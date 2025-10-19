import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import User from "../models/User";
import { Strategy as FacebookStrategy } from "passport-facebook";
import bcrypt from "bcryptjs";

interface GoogleLoginDetails {
  googleClientId: string;
  googleClientSecret: string;
}

interface FacebookLoginDetails {
  facebookAppId: string;
  facebookAppSecret: string;
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
  passport.serializeUser((user: any, done) => {
    return process.nextTick(function () {
      done(null, user.id);
    });
  });

  passport.deserializeUser((id: string, done) => {
    return process.nextTick(async function () {
      try {
        const existingUser = await User.findById(id);
        const user = {
          id: existingUser?.id,
          email: existingUser?.email,
          firstName: existingUser?.firstName,
          lastName: existingUser?.lastName,
          isVerified: existingUser?.isVerified,
          isAdmin: existingUser?.isAdmin,
          profileUrl: existingUser?.profileUrl,
          roles: existingUser?.roles || [],
        };
        return done(null, user);
      } catch {
        return done(new Error("No user associated with this id"));
      }
    });
  });
  // Google OAuth strategy
  if (options.enableGoogleLogin && options.googleLoginDetails) {
    if (
      !options.googleLoginDetails.googleClientId ||
      !options.googleLoginDetails.googleClientSecret
    ) {
      throw new Error("Google login is enabled but Google credentials are missing.");
    }
    passport.use(
      new GoogleStrategy(
        {
          clientID: options.googleLoginDetails.googleClientId!,
          clientSecret: options.googleLoginDetails.googleClientSecret!,
          callbackURL: `${process.env.HOSTED_DOMAIN}/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            let existingUser = await User.findOne({ googleId: profile.id });

            if (!existingUser) {
              existingUser = await User.create({
                email: profile.emails?.[0].value,
                googleId: profile.id,
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                profileUrl: profile.photos?.[0].value,
              });
            }
            const user = {
              id: existingUser.id,
              email: existingUser.email,
              firstName: existingUser.firstName,
              lastName: existingUser.lastName,
              isVerified: existingUser.isVerified,
              isAdmin: existingUser.isAdmin,
              profileUrl: existingUser.profileUrl,
            };
            return done(null, user);
          } catch (error) {
            return done(error, false);
          }
        }
      )
    );
  }

  // Local Strategy for email/password login
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passReqToCallback: true },
      async (req, email, password, done) => {
        try {
          const existingUser = await User.findOne({ email: email });
          if (!existingUser) {
            return done(null, false, {
              message: "No user found with the provided credentials. Please create register.",
            });
          }

          const { password: userPassword } = existingUser;

          if (!userPassword) {
            return done(null, false, {
              message: "Your account password is not setup, please forget your password",
            });
          }

          const isMatch = await bcrypt.compare(password, userPassword);

          if (!isMatch) {
            return done(null, false, { message: "Incorrect email or password." });
          }

          const user = {
            id: existingUser.id,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            isVerified: existingUser.isVerified,
            isAdmin: existingUser.isAdmin,
            profileUrl: existingUser.profileUrl,
          };
          // Return user and tokens
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Facebook OAuth Strategy
  if (options.enableFacebookLogin && options.facebookLoginDetails) {
    if (
      !options.facebookLoginDetails.facebookAppId ||
      !options.facebookLoginDetails.facebookAppSecret
    ) {
      throw new Error("Facebook login is enabled but Facebook credentials are missing.");
    }
    passport.use(
      new FacebookStrategy(
        {
          clientID: options.facebookLoginDetails.facebookAppId!,
          clientSecret: options.facebookLoginDetails.facebookAppSecret!,
          callbackURL: "/auth/facebook/callback",
          profileFields: ["id", "emails", "name"], // Get email and name
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
}
