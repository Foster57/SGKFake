require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const pool = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const bookRoutes = require('./src/routes/bookRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const authController = require('./src/controllers/authController');

const app = express();

// Body Parser Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, '..', 'client-sgkfake')));
app.use('/images', express.static(path.join(__dirname, '..', 'client-sgkfake', 'img', 'img-subject')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root route
app.get('/', (req, res) => {
  res.redirect('/pages/index.html');
});

// API Routes
app.use('/api/users', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/admin', adminRoutes);

// Google OAuth Routes
app.get('/auth/google', authController.googleAuth);
app.get('/auth/google/callback', authController.googleAuthCallback);

// Cronjob: Tự động dọn dẹp các OTP hết hạn trong DB sau mỗi 1 phút
setInterval(async () => {
  try {
    await pool.query('UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE otp_expires_at < NOW()');
  } catch (err) {
    console.error('Lỗi dọn dẹp OTP hết hạn:', err);
  }
}, 60 * 1000);

// Cronjob: Dọn dẹp các refresh token hết hạn quá 30 ngày (E)
setInterval(async () => {
  try {
    await pool.query(`DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '30 days'`);
  } catch (err) {
    console.error('Lỗi dọn dẹp refresh token hết hạn:', err);
  }
}, 24 * 60 * 60 * 1000);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
