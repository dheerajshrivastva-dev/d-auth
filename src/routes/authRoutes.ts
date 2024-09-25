import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { register, login, logout, refresh, forgotPassword, googleLoginCallback, facebookLoginCallback } from '../controllers/authController';

// Create rate limits for different actions
const rateLimitConfig = {
  login: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 attempts per hour
    message: 'Too many login attempts, please try again later or solve CAPTCHA.',
  }),
  signup: rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many signup attempts, please try again later or solve CAPTCHA.',
  }),
  refreshToken: rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 1 day
    max: 150,
    message: 'Too many refresh token requests, please try again later or solve CAPTCHA.',
  }),
  resetPassword: rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 1 day
    max: 10,
    message: 'Too many password reset requests, please try again later or solve CAPTCHA.',
  }),
};

const router = Router();

// Registration and Login
router.post('/register', rateLimitConfig.signup, register);
router.post('/login', rateLimitConfig.login, login);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false }), googleLoginCallback);

// Facebook OAuth
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { session: false }), facebookLoginCallback);

// Apple OAuth
// router.get('/apple', passport.authenticate('apple'));
// router.get('/apple/callback', passport.authenticate('apple', { session: false }), (req, res) => {
//   res.redirect('/');
// });

router.post('/forgot-password', forgotPassword);



// Logout
router.post('/logout', logout);

// Refresh token
router.post('/refresh-token', rateLimitConfig.refreshToken, refresh)

export default router;
