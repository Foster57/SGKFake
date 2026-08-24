const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Limiter cho các API nhạy cảm như Đăng nhập, OTP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Tối đa 10 request
  message: { error: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Security: Rate limit exceeded for API`, { ip: req.ip, url: req.url });
    res.status(options.statusCode).send(options.message);
  }
});

// Limiter chung cho API
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 100, // Tối đa 100 request/phút
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  authLimiter,
  apiLimiter
};
