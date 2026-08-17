const jwt = require('jsonwebtoken');

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

        req.userID = decoded.id;
        req.userAccount = decoded.account;
        req.userEmail = decoded.email;
        req.userRole = decoded.role || 'user';

        next();
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
