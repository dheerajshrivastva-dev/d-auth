import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import authController from '../controllers/authController';
import forgetPasswordControlled from '../controllers/forgetPasswordControlled';
import dotenv from "dotenv";

dotenv.config();

// Create rate limits for different actions
const rateLimitConfig = {
  login: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 attempts per hour
    message: 'Too many login attempts, please try again later',
  }),
  signup: rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: 'Too many signup attempts, please try again later',
  }),
  refreshToken: rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 1 day
    max: 150,
    message: 'Too many refresh token requests, please try again later',
  }),
  forgetPassword: rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 1 day
    max: 24,
    message: 'Too many password reset requests, please try again late',
  }),
};

/**
 * Authentication Router
 * 
 * This router handles all authentication-related routes for the application.
 * 
 * Routes:
 * 
 * ### Registration and Login
 * 
 * * `POST /register`: Creates a new user account.
 * * `POST /login`: Authenticates a user and logs them in.
 * 
 * ### Google OAuth
 * 
 * * `GET /google`: Redirects the user to the Google authentication page.
 * * `GET /google/callback`: Handles the Google authentication callback and logs the user in.
 * 
 * ### Facebook OAuth
 * 
 * * `GET /facebook`: Redirects the user to the Facebook authentication page.
 * * `GET /facebook/callback`: Handles the Facebook authentication callback and logs the user in.
 * 
 * ### Password Recovery
 * 
 * * `POST /forgot-password`: Sends a password reset email to the user.
 * * `POST /reset-password`: Resets the user's password.
 * * `POST /reset-password/new-otp`: Resends a password reset OTP to the user.
 * 
 * ### Session Management
 * 
 * * `POST /logout`: Logs the user out.
 * * `POST /refresh-token`: Refreshes the user's authentication token.
 * 
 * @module authRouter
 */
const router = Router();

// Registration and Login
router.post('/register', rateLimitConfig.signup, authController.register);
router.post('/login', rateLimitConfig.login, authController.login);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', rateLimitConfig.login, passport.authenticate('google', {
  failureRedirect: process.env.SOCIAL_LOGIN_FAILURE_URL!,
  successRedirect: process.env.SOCIAL_LOGIN_SUCCESS_URL!,
}));

// Facebook OAuth
router.get('/facebook', rateLimitConfig.login, passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { session: false }), authController.facebookLoginCallback);

router.post('/forgot-password', rateLimitConfig.forgetPassword, forgetPasswordControlled.forgotPassword);

router.post('/reset-password', rateLimitConfig.forgetPassword, forgetPasswordControlled.resetPassword);

router.post('/reset-password/new-otp', rateLimitConfig.forgetPassword, forgetPasswordControlled.resendOtpForForgetPassowrd);

// Logout
router.post('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// Refresh token
router.post('/refresh-token', rateLimitConfig.refreshToken, authController.refresh)

export default router;
