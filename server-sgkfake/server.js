require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const bookRoutes = require('./src/routes/bookRoutes');
const authController = require('./src/controllers/authController');

const app = express();

// Body Parser Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '..', 'client-sgkfake')));
app.use('/images', express.static(path.join(__dirname, '..', 'client-sgkfake', 'img', 'img-subject')));

// Root route
app.get('/', (req, res) => {
  res.redirect('/pages/index.html');
});

// API Routes
app.use('/api/users', authRoutes);
app.use('/api/books', bookRoutes);

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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
