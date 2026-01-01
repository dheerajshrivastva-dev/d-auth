import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as FacebookStrategy } from "passport-facebook";
import bcrypt from "bcryptjs";
import { IDatabaseAdapter } from "../adapters/IDatabaseAdapter";

interface GoogleLoginDetails {
  googleClientId: string;
  googleClientSecret: string;
}

interface FacebookLoginDetails {
  facebookAppId: string;
  facebookAppSecret: string;
}

export interface AuthOptions {
  database: IDatabaseAdapter;
  enableGoogleLogin?: boolean;
  enableFacebookLogin?: boolean;
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
  const { database } = options;

  passport.serializeUser((user: Express.User, done) => {
    return process.nextTick(function () {
      done(null, user.id);
    });
  });

  passport.deserializeUser((id: string, done) => {
    return process.nextTick(async function () {
      try {
        const existingUser = await database.findUserById(id);
        if (!existingUser) {
          return done(new Error("No user associated with this id"));
        }
        // Return the full user object to match IUserDocument
        return done(null, existingUser);
      } catch (error) {
        return done(error instanceof Error ? error : new Error("Failed to deserialize user"));
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
            let existingUser = await database.findUserByOAuthId("google", profile.id);

            if (!existingUser) {
              existingUser = await database.createUser({
                email: profile.emails?.[0].value,
                googleId: profile.id,
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                profileUrl: profile.photos?.[0].value,
                roles: ["user"],
                isVerified: true,
              });
            }
            // Return the full user object to match IUserDocument
            return done(null, existingUser);
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
          const existingUser = await database.findUserByEmail(email);
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

          // Return the full user object to match IUserDocument
          return done(null, existingUser);
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
