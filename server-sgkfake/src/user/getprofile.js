module.exports = function (app, pool, bcrypt, email, user_account) {
    app.get('/api/user/profile', async (req, res) => {
        const { user_account, email } = req.body;
        try {
            const result = await pool.query('SELECT user_account, email FROM users WHERE user_account = $1', [user_account]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Không tìm thấy người dùng' });
            }
            const user = result.rows[0];
            return res.status(200).json({ user });
        } catch (error) {
            console.error('Get profile error:', error);
            return res.status(500).json({ error: 'Lỗi máy chủ khi lấy thông tin cá nhân' });
        }
    });
}
