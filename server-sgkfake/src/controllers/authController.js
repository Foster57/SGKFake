const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
const pool = require('../config/db');
const transporter = require('../config/mailer');
const { hashPassword, comparePassword } = require('../utils/hash');

// POST /api/users/login
async function login(req, res) {
  const account = req.body.user_account || req.body.account || req.body.username || req.body.email;
  const password = req.body.hashpasword || req.body.password;

  if (!account || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tài khoản/email và mật khẩu' });
  }

  try {
    const result = await pool.query(
      `SELECT user_id, user_account, hashpasword, email FROM users WHERE LOWER(user_account) = LOWER($1) OR LOWER(email) = LOWER($1)`,
      [account]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });
    }

    const user = result.rows[0];
    const isMatch = await comparePassword(password, user.hashpasword);

    if (!isMatch) {
      return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });
    }

    const secretKey = process.env.JWT_SECRET || 'sgkfake_secret_key_2026';
    const token = jwt.sign(
      { id: user.user_id, account: user.user_account, email: user.email },
      secretKey,
      { expiresIn: '24h' }
    );

    const { user_id, user_account, email } = user;
    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: { user_id, user_account, email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// POST /api/users (Register)
async function register(req, res) {
  const account = req.body.user_account || req.body.account || req.body.username;
  const password = req.body.hashpasword || req.body.password;
  const email = req.body.email;

  if (!account || !password) {
    return res.status(400).json({ error: 'Thiếu tài khoản hoặc mật khẩu' });
  }

  try {
    const hashedPassword = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (user_account, hashpasword, email) VALUES ($1, $2, $3) RETURNING user_id, user_account, email`,
      [account, hashedPassword, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Tài khoản này đã tồn tại!' });
    }
    res.status(500).json({ error: 'Database error' });
  }
}

// GET /api/users/profile
async function getProfile(req, res) {
  try {
    const result = await pool.query(
      `SELECT user_id, user_account, email FROM users WHERE user_id = $1`,
      [req.userID]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// POST /api/users/change-password
async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng nhập mật khẩu cũ và mật khẩu mới' });
  }

  try {
    const result = await pool.query(
      `SELECT hashpasword FROM users WHERE user_id = $1`,
      [req.userID]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const user = result.rows[0];
    const isMatch = await comparePassword(oldPassword, user.hashpasword);

    if (!isMatch) {
      return res.status(400).json({ error: 'Mật khẩu cũ không chính xác' });
    }

    const newHashedPassword = await hashPassword(newPassword);
    await pool.query(
      `UPDATE users SET hashpasword = $1 WHERE user_id = $2`,
      [newHashedPassword, req.userID]
    );

    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// POST /api/users/forgot-password
async function forgotPassword(req, res) {
  const email = req.body.email;
  if (!email) {
    return res.status(400).json({ error: 'Email là bắt buộc' });
  }

  try {
    const userResult = await pool.query(
      'SELECT email, user_id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Thông tin hoặc Email không hợp lệ' });
    }

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: true,
      lowerCaseAlphabets: false,
      digits: true,
      specialChars: false
    });
    const expiresIn = new Date(Date.now() + 5 * 60 * 1000);

    const updateResult = await pool.query(
      'UPDATE users SET otp = $1, otp_expires_at = $2 WHERE LOWER(email) = LOWER($3)',
      [otp, expiresIn, email]
    );

    if (updateResult.rowCount === 0) {
      return res.status(400).json({ error: 'Email không tồn tại trong hệ thống!' });
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset Password',
      text: `Mã OTP của bạn là: ${otp}`
    });

    res.json({ message: 'Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư!', email });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi xử lý quên mật khẩu' });
  }
}

// POST /api/users/verify-otp
async function verifyOtp(req, res) {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email và OTP là bắt buộc' });
  }

  try {
    const verifyOTPResult = await pool.query(
      'SELECT otp, otp_expires_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (verifyOTPResult.rows.length === 0) {
      return res.status(400).json({ error: 'Mã OTP hoặc thông tin không hợp lệ' });
    }

    const user = verifyOTPResult.rows[0];

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ error: 'Mã OTP không chính xác' });
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      await pool.query(
        'UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      return res.status(400).json({ error: 'Mã OTP đã hết hạn' });
    }

    if (newPassword) {
      const hashedPassword = await hashPassword(newPassword);
      await pool.query(
        'UPDATE users SET hashpasword = $1, otp = NULL, otp_expires_at = NULL WHERE LOWER(email) = LOWER($2)',
        [hashedPassword, email]
      );
      return res.json({ message: 'Đặt lại mật khẩu mới thành công!' });
    }

    res.json({ message: 'Xác thực OTP thành công!' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi xác thực OTP' });
  }
}

// GET /auth/google
function googleAuth(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const scope = encodeURIComponent('email profile');
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  res.redirect(googleAuthUrl);
}

// GET /auth/google/callback
async function googleAuthCallback(req, res) {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Không nhận được mã xác thực từ Google');
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error('Google token exchange error:', tokenData);
      return res.status(500).send('Lỗi khi đổi mã xác thực với Google');
    }

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const googleUser = await userResponse.json();

    const email = googleUser.email;
    const account = `${email}`;

    let userResult = await pool.query(
      `SELECT user_id, user_account, email FROM users WHERE email = $1 OR user_account = $2`,
      [email, account]
    );

    let user;
    if (userResult.rows.length === 0) {
      const dummyPassword = await hashPassword(`google_${googleUser.id}_${Date.now()}`);
      const insertResult = await pool.query(
        `INSERT INTO users (user_account, hashpasword, email) VALUES ($1, $2, $3) RETURNING user_id, user_account, email`,
        [account, dummyPassword, email]
      );
      user = insertResult.rows[0];
    } else {
      user = userResult.rows[0];
    }
    const secretKey = process.env.JWT_SECRET || 'sgkfake_secret_key_2026';
    const token = jwt.sign(
      { id: user.user_id, account: user.user_account, email: user.email },
      secretKey,
      { expiresIn: '24h' }
    );
    res.redirect(`/pages/user-pages/user.html?token=${token}&user=${encodeURIComponent(user.user_account)}`);
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).send('Lỗi máy chủ khi đăng nhập bằng Google');
  }
}

module.exports = {
  login,
  register,
  getProfile,
  changePassword,
  forgotPassword,
  verifyOtp,
  googleAuth,
  googleAuthCallback
};
