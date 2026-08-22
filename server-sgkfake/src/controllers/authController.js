const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
const pool = require('../config/db');
const transporter = require('../config/mailer');
const { hashPassword, comparePassword, needsRehash } = require('../utils/hash');

const ACCESS_SECRET = process.env.JWT_SECRET || 'sgkfake_secret_key_2026';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'sgkfake_refresh_secret_2026';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '30m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';
const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/users',
  maxAge: 7 * 24 * 60 * 60 * 1000
};
const ACCESS_COOKIE_NAME = 'accessToken';
const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true, // Ngăn XSS đánh cắp token qua document.cookie
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 30 * 60 * 1000 // 30 phút (match ACCESS_EXPIRES)
};

// Lưu trữ one-time code cho OAuth callback (B) — dùng 1 lần, sống 60s
const oauthCodes = new Map();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function signTokens(user) {
  const accessToken = jwt.sign(
    { id: user.user_id, account: user.user_account, email: user.email, role: user.role || 'user', type: 'access' },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
  const refreshToken = jwt.sign(
    { id: user.user_id, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES, jwtid: crypto.randomUUID() }
  );
  return { accessToken, refreshToken };
}

async function storeRefreshToken(userId, refreshToken) {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + ($3)::interval)`,
    [userId, hashToken(refreshToken), REFRESH_EXPIRES]
  );
}

// Rotation trong transaction (C): atomic UPDATE ... RETURNING.
// Token hợp lệ -> revoke cũ + cấp cặp token mới.
// Token đã bị thu hồi trước đó (reuse detected) -> thu hồi toàn bộ phiên của user.
async function rotateRefreshToken(oldTokenHash, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()
       RETURNING id`,
      [oldTokenHash, userId]
    );

    if (rows.length === 0) {
      const check = await client.query(
        `SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2`,
        [oldTokenHash, userId]
      );
      if (check.rows.length > 0 && check.rows[0].revoked_at) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId]
        );
      }
      await client.query('COMMIT');
      return { reuse: true };
    }

    const userResult = await client.query(
      `SELECT user_id, user_account, email, role FROM users WHERE user_id = $1`,
      [userId]
    );
    const user = userResult.rows[0];
    const tokens = signTokens(user);

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + ($3)::interval)`,
      [userId, hashToken(tokens.refreshToken), REFRESH_EXPIRES]
    );

    await client.query('COMMIT');
    return { reuse: false, user, tokens };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
}

function setAccessCookie(res, accessToken) {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, ACCESS_COOKIE_OPTIONS);
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
}

function clearAccessCookie(res) {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
}

// POST /api/users/login
async function login(req, res) {
  const account = req.body.user_account || req.body.account || req.body.username || req.body.email;
  const password = req.body.hashpasword || req.body.password;

  if (!account || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tài khoản/email và mật khẩu' });
  }

  try {
    const result = await pool.query(
      `SELECT user_id, user_account, hashpasword, email, role, is_active FROM users WHERE LOWER(user_account) = LOWER($1) OR LOWER(email) = LOWER($1)`,
      [account]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });
    }

    const user = result.rows[0];

    if (user.is_active === false) {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' });
    }

    const isMatch = await comparePassword(password, user.hashpasword);

    if (!isMatch) {
      return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });
    }

    if (needsRehash(user.hashpasword)) {
      const upgraded = await hashPassword(password);
      await pool.query(
        'UPDATE users SET hashpasword = $1 WHERE user_id = $2',
        [upgraded, user.user_id]
      );
      user.hashpasword = upgraded;
    }

    const { user_id, user_account, email, role } = user;
    const { accessToken, refreshToken } = signTokens(user);
    await storeRefreshToken(user_id, refreshToken);
    setRefreshCookie(res, refreshToken);
    setAccessCookie(res, accessToken);

    res.json({
      message: 'Đăng nhập thành công',
      accessToken,
      user: { user_id, user_account, email, role }
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

  if (!email) {
    return res.status(400).json({ error: 'Email là bắt buộc' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email không hợp lệ' });
  }

  try {
    const emailCheck = await pool.query(
      'SELECT user_id, is_active FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (emailCheck.rows.length > 0) {
      if (emailCheck.rows[0].is_active === false) {
        return res.status(403).json({ error: 'Email này đã bị khóa. Vui lòng liên hệ quản trị viên.' });
      }
      return res.status(409).json({ error: 'Email này đã được sử dụng!' });
    }

    const hashedPassword = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (user_account, hashpasword, email) VALUES ($1, $2, $3) RETURNING user_id, user_account, email, role`,
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
      `SELECT user_id, user_account, email, role FROM users WHERE user_id = $1`,
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

    const otpHash = hashOtp(otp);
    const updateResult = await pool.query(
      'UPDATE users SET otp = $1, otp_expires_at = $2 WHERE LOWER(email) = LOWER($3)',
      [otpHash, expiresIn, email]
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
    const inputHash = hashOtp(otp);
    const storedBuf = Buffer.from(user.otp || '', 'utf-8');
    const inputBuf = Buffer.from(inputHash, 'utf-8');
    if(!user.otp || storedBuf.length !== inputBuf.length || !crypto.timingSafeEqual(storedBuf, inputBuf)) {
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
      `SELECT user_id, user_account, email, role, is_active FROM users WHERE email = $1 OR user_account = $2`,
      [email, account]
    );

    let user;
    if (userResult.rows.length === 0) {
      const dummyPassword = await hashPassword(`google_${googleUser.id}_${Date.now()}`);
      const insertResult = await pool.query(
        `INSERT INTO users (user_account, hashpasword, email) VALUES ($1, $2, $3) RETURNING user_id, user_account, email, role`,
        [account, dummyPassword, email]
      );
      user = insertResult.rows[0];
    } else {
      user = userResult.rows[0];
      if (user.is_active === false) {
        const clientUrl = process.env.CLIENT_URL || '';
        return res.redirect(`${clientUrl}/login?error=account_disabled`);
      }
    }
    const oneTimeCode = crypto.randomBytes(32).toString('hex');
    oauthCodes.set(oneTimeCode, { userId: user.user_id, expiresAt: Date.now() + 60 * 1000 });

    const clientUrl = process.env.CLIENT_URL || '';
    res.redirect(`${clientUrl}/auth/callback?code=${oneTimeCode}`);
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).send('Lỗi máy chủ khi đăng nhập bằng Google');
  }
}

// POST /api/users/exchange — đổi one-time code (B) lấy token thật
async function exchange(req, res) {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Thiếu mã xác thực' });
  }

  const record = oauthCodes.get(code);
  if (!record) {
    return res.status(400).json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn' });
  }
  oauthCodes.delete(code);

  if (Date.now() > record.expiresAt) {
    return res.status(400).json({ error: 'Mã xác thực đã hết hạn' });
  }

  try {
    const user = await pool.query(
      `SELECT user_id, user_account, email, role, is_active FROM users WHERE user_id = $1`,
      [record.userId]
    );
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const foundUser = user.rows[0];
    if (foundUser.is_active === false) {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' });
    }
    const { accessToken, refreshToken } = signTokens(foundUser);
    await storeRefreshToken(foundUser.user_id, refreshToken);
    setRefreshCookie(res, refreshToken);
    setAccessCookie(res, accessToken);

    res.json({
      message: 'Đăng nhập thành công',
      accessToken,
      user: { user_id: foundUser.user_id, user_account: foundUser.user_account, email: foundUser.email, role: foundUser.role }
    });
  } catch (err) {
    console.error('Exchange error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi xác thực' });
  }
}

// POST /api/users/refresh
async function refresh(req, res) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    return res.status(401).json({ error: 'Thiếu refresh token' });
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    if (payload.type !== 'refresh') {
      return res.status(403).json({ error: 'Token không hợp lệ' });
    }

    const result = await rotateRefreshToken(hashToken(refreshToken), payload.id);

    if (result.reuse) {
      clearRefreshCookie(res);
      return res.status(403).json({ error: 'Phiên đã hết hạn, vui lòng đăng nhập lại' });
    }

    setRefreshCookie(res, result.tokens.refreshToken);
    setAccessCookie(res, result.tokens.accessToken);
    res.json({
      accessToken: result.tokens.accessToken,
      user: { user_id: result.user.user_id, user_account: result.user.user_account, email: result.user.email, role: result.user.role }
    });
  } catch (err) {
    clearRefreshCookie(res);
    console.error('Refresh error:', err);
    return res.status(403).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' });
  }
}

// POST /api/users/logout
async function logout(req, res) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshToken) {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(refreshToken)]
    );
  }
  clearRefreshCookie(res);
  clearAccessCookie(res);
  res.json({ message: 'Đăng xuất thành công' });
}

// GET /api/users/me — quick auth check (trả thông tin từ JWT, không query DB)
function me(req, res) {
  res.json({
    user_id: req.userID,
    user_account: req.userAccount,
    email: req.userEmail,
    role: req.userRole
  });
}

module.exports = {
  login,
  register,
  getProfile,
  changePassword,
  forgotPassword,
  verifyOtp,
  googleAuth,
  googleAuthCallback,
  exchange,
  refresh,
  logout,
  me
};
