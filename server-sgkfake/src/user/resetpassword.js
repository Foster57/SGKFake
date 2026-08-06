module.exports = function (app, pool, bcrypt, hashPassword) {
    app.post('/api/user/reset-password', async (req, res) => {
        const { user_account, account, oldPassword, newPassword, confirmPassword } = req.body;
        const username = user_account || account || req.body.username;

        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ error: 'Vui lòng nhập đầy đủ các trường thông tin' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Mật khẩu mới và mật khẩu xác nhận không khớp' });
        }

        try {
            let queryText = 'SELECT user_id, user_account, hashpasword FROM users';
            let queryParams = [];

            if (username) {
                queryText += ' WHERE user_account = $1';
                queryParams.push(username);
            }

            const result = await pool.query(queryText, queryParams);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Không tìm thấy người dùng' });
            }

            let targetUser = null;
            for (const u of result.rows) {
                let isMatch = false;
                if (bcrypt) {
                    isMatch = await bcrypt.compare(oldPassword, u.hashpasword);
                } else {
                    const hash = hashPassword(oldPassword);
                    isMatch = (u.hashpasword === hash || u.hashpasword === oldPassword);
                }
                if (isMatch) {
                    targetUser = u;
                    break;
                }
            }

            if (!targetUser) {
                return res.status(400).json({ error: 'Mật khẩu cũ không chính xác' });
            }

            const hashedPassword = bcrypt ? await bcrypt.hash(newPassword, 10) : hashPassword(oldPassword);
            await pool.query(
                'UPDATE users SET hashpasword = $1 WHERE user_id = $2',
                [hashedPassword, targetUser.user_id]
            );

            return res.status(200).json({ message: 'Đặt lại mật khẩu thành công!' });
        } catch (error) {
            console.error('Reset password error:', error);
            return res.status(500).json({ error: 'Lỗi máy chủ khi đổi mật khẩu' });
        }
    });
};
