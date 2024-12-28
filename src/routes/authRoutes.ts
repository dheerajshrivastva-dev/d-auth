import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import authController from '../controllers/authController';
import forgetPasswordControlled from '../controllers/forgetPasswordControlled';
import AuthConfig from '../config/authConfig';

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
router.post('/register', rateLimitConfig.signup, authController.register);
// router.post('/login', rateLimitConfig.login, authController.login);
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  console.debug('req.body', req.body)
  passport.authenticate('local', (err: any, user: any, info: any) => {
    console.debug('authenticate', err, user, info)
    if (err) {
      return res.status(401).json({ message: info ? info.message : 'Incorrect email or password.' });
    }
    if (!user) {
      return res.status(401).json({ message: info ? info.message : 'No user found with the provided credentials. Please create register' });
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.status(200).json({ message: 'Login successful', user });
    })
  })(req, res, next);
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', {
  session: false,
  failureRedirect: AuthConfig.getInstance().socialLoginRedirectUrl?.failureUrl,
  successRedirect: AuthConfig.getInstance().socialLoginRedirectUrl?.successUrl,
}));

// Facebook OAuth
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { session: false }), authController.facebookLoginCallback);

router.post('/forgot-password', forgetPasswordControlled.forgotPassword);

router.post('/reset-password', forgetPasswordControlled.resetPassword);

router.post('/reset-password/new-otp', forgetPasswordControlled.resendOtpForForgetPassowrd);

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to log out' });
    }
  });
  res.status(200).json({ message: 'Logout successful' }).redirect(AuthConfig.getInstance().socialLoginRedirectUrl?.failureUrl!);
});

router.get('/login/success', (req: Request, res: Response) => {
  console.debug(req.session.id, req.user)
  if (req.user) {
    return res.status(200).json({ message: 'Login successful', user: req.user });
  } else {
    return res.status(401).json({ message: 'Unauthorized' });
  }
});

export default router;
