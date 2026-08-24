const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `[${timestamp}] ${level}: ${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    // 1. Ghi riêng các log liên quan đến bảo mật (auth, OTP, token...)
    new DailyRotateFile({
      dirname: path.join(__dirname, '../../logs/security'),
      filename: 'security-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d', // Giữ log bảo mật 1 tháng
      level: 'warn',
    }),
    // 2. Ghi toàn bộ các log chung của ứng dụng
    new DailyRotateFile({
      dirname: path.join(__dirname, '../../logs/app'),
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d'
    })
  ]
});

// Ở development, in ra màn hình console cho dễ nhìn
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
} else {
  // Ở production vẫn in ra stdout/stderr nếu dùng Docker / PM2
  logger.add(new winston.transports.Console({
    format: logFormat
  }));
}

module.exports = logger;
