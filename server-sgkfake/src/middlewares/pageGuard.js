const jwt = require('jsonwebtoken');

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
 * Server-side page guard: yêu cầu user đã đăng nhập.
 * Nếu chưa đăng nhập → redirect /login.
 */
function requireAuthPage(req, res, next) {
    const user = getAuthUser(req);
    if (!user) {
        return res.redirect('/login');
    }
    req.authUser = user;
    next();
}

/**
 * Server-side page guard: yêu cầu role = admin.
 * Nếu chưa đăng nhập → redirect /login.
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
    req.authUser = user;
    next();
}

module.exports = { getAuthUser, requireAuthPage, requireAdminPage };
