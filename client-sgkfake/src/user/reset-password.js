document.addEventListener('DOMContentLoaded', () => {
    const resetPasswordForm = document.querySelector('form');
    const oldPasswordInput = document.getElementById('old-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmNewPasswordInput = document.getElementById('confirm-password');

    if (!resetPasswordForm) return;

    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = oldPasswordInput ? oldPasswordInput.value.trim() : '';
        const newPassword = newPasswordInput ? newPasswordInput.value.trim() : '';
        const confirmPassword = confirmNewPasswordInput ? confirmNewPasswordInput.value.trim() : '';

        if (newPassword !== confirmPassword) {
            alert('New password and confirm new password do not match');
            return;
        }

        const token = getCookie('accessToken');
        if (!token) {
            alert('Vui lòng đăng nhập trước khi đổi mật khẩu.');
            window.location.href = '/login';
            return;
        }

        try {
            const response = await SGKAuth.authFetch('/api/users/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    oldPassword,
                    newPassword
                })
            });

            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                alert(data.message || 'Mật khẩu đã đổi thành công!');
                window.location.href = '/user';
            } else {
                alert(data.error || data.message || 'Lỗi khi đổi mật khẩu');
            }
        } catch (error) {
            console.error('Reset password error:', error);
            alert('Failed to connect to server');
        }
    });
});