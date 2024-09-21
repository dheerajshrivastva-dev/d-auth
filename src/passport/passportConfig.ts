import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import User, { IUser } from '../models/User';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { generateAccessToken, generateRefreshToken } from '../utils/generateTokens';

import { v4 as uuidv4 } from 'uuid';
// import { Strategy as AppleStrategy } from 'passport-apple';
// import jwt from 'jsonwebtoken';

export interface AuthOptions {
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackURL: string;

  facebookAppId: string;
  facebookAppSecret: string;
  facebookCallbackURL: string;

  // appleClientId: string;
  // appleClientSecret: string;
  // appleCallbackURL: string;
}

export function passportConfig(options: AuthOptions) {
  // Google OAuth strategy
  passport.use(
    new GoogleStrategy({
      clientID: options.googleClientId!,
      clientSecret: options.googleClientSecret!,
      callbackURL: options.googleCallbackURL ||'/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.create({
            googleId: profile.id,
            email: profile.emails![0].value,
            tokens: [{ accessToken, refreshToken }]
          });
        }
        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    })
  );

  // Local Strategy for email/password login
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const user = await User.findOne({ email }) as IUser;
  
        // If the user does not exist
        if (!user) {
          return done(null, false, { message: 'Incorrect email or password.' });
        }
  
        // Check if the password matches
        if (!user.password) {
          return done(null, false, { message: 'Please forgot your password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: 'Incorrect email or password.' });
        }

        // Generate unique sessionId for this session
        const sessionId = uuidv4();
  
        // Generate the tokens
        const accessToken = generateAccessToken(user.id, sessionId);
        const refreshToken = generateRefreshToken(user.id, sessionId);
  
        // Store the refresh token in the database (or update if already exists)
        // Add new session tokens to user (instead of replacing all tokens)
        user.tokens.push({ sessionId, accessToken, refreshToken });
        await user.save();
  
        // Return user and tokens
        return done(null, { accessToken, refreshToken });
      } catch (error) {
        return done(error);
      }
    })
  );

  // Facebook OAuth Strategy
  passport.use(
    new FacebookStrategy(
      {
        clientID: options.facebookAppId!,
        clientSecret: options.facebookAppSecret!,
        callbackURL: options.facebookCallbackURL || '/auth/facebook/callback',
        profileFields: ['id', 'emails', 'name'] // Get email and name
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ facebookId: profile.id });
          if (!user) {
            user = await User.create({
              facebookId: profile.id,
              email: profile.emails?.[0].value,
              tokens: [{ accessToken, refreshToken }],
            });
          }
          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

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
