app.post('/api/user/change-password', async (req, res) => {
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;
    const confirmNewPassword = req.body.confirmNewPassword;

    if (!oldPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    try {
        let comparePassword = await bcrypt.compare(oldPassword, req.body.hashpasword);
        if (!comparePassword) {
            return res.status(400).json({ error: 'Old password is incorrect' });
        }
        let hashedPassword = hashPassword(newPassword);
        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }
        let result = await pool.query(
            `UPDATE users SET hashpasword = $1 WHERE user_account = $2 RETURNING user_id, user_account, email`,
            [hashedPassword, req.body.user_account]
        );
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('DB query error:', error);
        res.status(500).json({ error: 'Database error' });
    }
    window.location.href = '/pages/user-pages/user.html';
    window.location.reload();
});