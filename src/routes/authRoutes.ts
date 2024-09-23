import { Router } from 'express';
import passport from 'passport';
import { register, login, logout, refresh, forgotPassword, googleLoginCallback, facebookLoginCallback } from '../controllers/authController';
import { IUser } from '../models/User';

const router = Router();

// Registration and Login
router.post('/register', register);
router.post('/login', login);

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
router.post('/refresh-token', refresh)

export default router;
