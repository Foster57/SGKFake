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
        req.userID = decoded.id;
        req.userAccount = decoded.account;
        req.userEmail = decoded.email;
        req.userRole = decoded.role || 'user';
        const oke = jwt.decode(token);
        console.log(oke);
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
}

module.exports = { authenticate };
