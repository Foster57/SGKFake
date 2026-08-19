const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies?.token;
    if (!token) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập' });
    }
    try {
        const secretKey = process.env.JWT_SECRET || 'sgkfake_secret_key_2026';
        const decoded = jwt.verify(token, secretKey);

        if (decoded.type !== 'access') {
            return res.status(403).json({ error: 'Token không hợp lệ' });
        }

        pool.query('SELECT is_active FROM users WHERE user_id = $1', [decoded.id])
            .then(result => {
                if (result.rows.length === 0 || result.rows[0].is_active === false) {
                    return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
                }
                req.userID = decoded.id;
                req.userAccount = decoded.account;
                req.userEmail = decoded.email;
                req.userRole = decoded.role || 'user';
                next();
            })
            .catch(() => res.status(500).json({ error: 'Lỗi máy chủ' }));
    } catch (err) {
        return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
}

function requireAdmin(req, res, next) {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập' });
    }
    next();
}

function requireUser(req, res, next) {
    if (!req.userRole || !['user', 'admin'].includes(req.userRole)) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập' });
    }
    next();
}

module.exports = { authenticate, requireUser, requireAdmin };
