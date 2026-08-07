const express = require('express');
const path = require('path');
const crypto = require('crypto');
const otpGenerator = require('otp-generator');
const app = express();

function hashPassword(password) {
  if (!password) return '';
  return crypto.createHash('sha256').update(password).digest('hex');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.redirect('/pages/index.html');
});

app.use(express.static(path.join(__dirname, '..', 'client-sgkfake')));
app.use('/images', express.static(path.join(__dirname, '..', 'client-sgkfake', 'img', 'img-subject')));

require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (e) {
  try {
    bcrypt = require('bcrypt');
  } catch (e) {
    bcrypt = null;
  }
}

// Nạp các router phụ sau khi app, pool, bcrypt đã khởi tạo
require('./src/user/resetpassword')(app, pool, bcrypt, hashPassword);

// GET /api/books?grade=1&subject=toan&type=sgk
app.get('/api/books', async (req, res) => {
  const { grade, subject, type } = req.query;

  if (!grade) {
    return res.status(400).json({ error: 'Missing required query parameter: grade' });
  }

  const gradeNum = parseInt(grade, 10);
  if (Number.isNaN(gradeNum)) {
    return res.status(400).json({ error: 'Invalid grade value; must be an integer' });
  }

  let query = `
    SELECT b.id, b.name, b.cover_image_url
    FROM books b
    LEFT JOIN subject s ON b.subject_id = s.id
    WHERE b.grade = $1
  `;
  const params = [gradeNum];

  if (subject) {
    const subjectID = parseInt(subject, 10);
    if (!isNaN(subjectID)) {
      params.push(subjectID)
      query += ` AND b.subject_id = $${params.length}`;
    }
  }
  if (type) {
    params.push(type);
    query += ` AND b.book_type = $${params.length}`;
  }

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('DB query error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/users (Login / Find user by account & password)
app.get('/api/users', async (req, res) => {
  const account = req.query.user_account || req.query.account || req.query.username;
  const password = req.query.hashpasword || req.query.password;

  if (!account || !password) {
    return res.status(400).json({ error: 'Missing account or password' });
  }

  try {
    const result = await pool.query(
      `SELECT user_id, user_account, hashpasword, email FROM users WHERE user_account = $1`,
      [account]
    );

    if (result.rows.length === 0) {
      return res.json([]);
    }

    const user = result.rows[0];
    let isMatch = false;

    if (bcrypt) {
      isMatch = await bcrypt.compare(password, user.hashpasword);
    } else {
      const hashedPassword = hashPassword(password);
      isMatch = (user.hashpasword === hashedPassword || user.hashpasword === password);
    }

    if (!isMatch) {
      return res.json([]);
    }

    const { user_account, email } = user;
    res.json([{ user_account, email }]);
  } catch (err) {
    console.error('DB query error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/users (Register new user)
app.post('/api/users', async (req, res) => {
  const account = req.body.user_account || req.body.account || req.body.username;
  const password = req.body.hashpasword || req.body.password;
  const email = req.body.email;

  if (!account || !password) {
    return res.status(400).json({ error: 'Thiếu tài khoản hoặc mật khẩu' });
  }

  try {
    let hashedPassword;
    if (bcrypt) {
      hashedPassword = await bcrypt.hash(password, 10);
    } else {
      hashedPassword = hashPassword(password);
    }

    const result = await pool.query(
      `INSERT INTO users (user_account, hashpasword, email) VALUES ($1, $2, $3) RETURNING user_id, user_account, email`,
      [account, hashedPassword, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('DB query error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Tài khoản này đã tồn tại!' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// Google OAuth Login Route
app.get('/auth/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const scope = encodeURIComponent('email profile');
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  res.redirect(googleAuthUrl);
});

// Google OAuth Callback Route
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Không nhận được mã xác thực từ Google');
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    // Đổi authorization code lấy access_token
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

    // Lấy thông tin user từ Google UserInfo API
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const googleUser = await userResponse.json();

    const email = googleUser.email;
    const account = `${email}`;

    // Kiểm tra tài khoản đã tồn tại trong DB chưa
    let userResult = await pool.query(
      `SELECT user_id, user_account, email FROM users WHERE email = $1 OR user_account = $2`,
      [email, account]
    );

    let user;
    if (userResult.rows.length === 0) {
      // Nếu chưa có, tự động tạo tài khoản mới
      const dummyPassword = bcrypt ? await bcrypt.hash(`google_${googleUser.id}_${Date.now()}`, 10) : hashPassword(`google_${googleUser.id}_${Date.now()}`);
      const insertResult = await pool.query(
        `INSERT INTO users (user_account, hashpasword, email) VALUES ($1, $2, $3) RETURNING user_id, user_account, email`,
        [account, dummyPassword, email]
      );
      user = insertResult.rows[0];
    } else {
      user = userResult.rows[0];
    }

    // Đăng nhập thành công -> chuyển hướng về trang user
    res.redirect(`/pages/user-pages/user.html?user=${encodeURIComponent(user.user_account)}`);
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).send('Lỗi máy chủ khi đăng nhập bằng Google');
  }
});

// Forgot password / Request OTP
app.post('/api/users/forgot-password', async (req, res) => {
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

    // Sinh mã OTP 6 ký tự ngẫu nhiên
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: true,
      lowerCaseAlphabets: false,
      digits: true,
      specialChars: false
    });
    const expiresIn = new Date(Date.now() + 5 * 60 * 1000); // Hết hạn sau 5 phút

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

    console.log(`[OTP CREATED] Email: ${email} | OTP: ${otp} | Expires: ${expiresIn.toISOString()}`);

    res.json({ message: `Mã OTP đã khởi tạo thành công! (Mã OTP thử nghiệm: ${otp})`, email });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi xử lý quên mật khẩu' });
  }
});

// Verify OTP & Reset Password
app.post('/api/users/verify-otp', async (req, res) => {
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
      const hashedPassword = bcrypt ? await bcrypt.hash(newPassword, 10) : hashPassword(newPassword);
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
});

// Tự động dọn dẹp các OTP hết hạn trong DB sau mỗi 1 phút
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
