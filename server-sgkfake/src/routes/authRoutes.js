const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimiter');

// Auth routes
router.post('/login', authLimiter, authController.login);
router.post('/', authController.register); // POST /api/users
router.get('/me', authenticate, authController.me); // Quick auth check
router.get('/profile', authenticate, authController.getProfile);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/verify-otp', authLimiter, authController.verifyOtp);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/exchange', authLimiter, authController.exchange);

module.exports = router;
