const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const ACCESS_SECRET = process.env.JWT_SECRET || 'sgkfake_secret_key_2026';

/**
 * Kiểm tra JWT từ cookie hoặc query/header.
 * Trả về decoded user nếu hợp lệ, null nếu không.
 */
function getAuthUser(req) {
    // Ưu tiên lấy access token từ cookie 'accessToken', fallback header Authorization
    const token = req.cookies?.accessToken
        || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, ACCESS_SECRET);
        if (decoded.type !== 'access') return null;
        return decoded;
    } catch {
        return null;
    }
}

/**
 * Server-side page guard: yêu cầu user đã đăng nhập và is_active = true.
 * Nếu chưa đăng nhập → redirect /login.
 * Nếu tài khoản bị khóa → redirect /login?error=account_disabled.
 */
function requireAuthPage(req, res, next) {
    const user = getAuthUser(req);
    if (!user) {
        return res.redirect('/login');
    }
    pool.query('SELECT is_active FROM users WHERE user_id = $1', [user.id])
        .then(result => {
            if (result.rows.length === 0 || result.rows[0].is_active === false) {
                return res.redirect('/login?error=account_disabled');
            }
            req.authUser = user;
            next();
        })
        .catch(() => res.redirect('/login'));
}

/**
 * Server-side page guard: yêu cầu role = admin và is_active = true.
 * Nếu chưa đăng nhập → redirect /login.
 * Nếu tài khoản bị khóa → redirect /login?error=account_disabled.
 * Nếu đăng nhập nhưng không phải admin → redirect /403.
 */
function requireAdminPage(req, res, next) {
    const user = getAuthUser(req);
    if (!user) {
        return res.redirect('/login');
    }
    if (user.role !== 'admin') {
        return res.redirect('/403');
    }
    pool.query('SELECT is_active FROM users WHERE user_id = $1', [user.id])
        .then(result => {
            if (result.rows.length === 0 || result.rows[0].is_active === false) {
                return res.redirect('/login?error=account_disabled');
            }
            req.authUser = user;
            next();
        })
        .catch(() => res.redirect('/login'));
}

module.exports = { getAuthUser, requireAuthPage, requireAdminPage };
