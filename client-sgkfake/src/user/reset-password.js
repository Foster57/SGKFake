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

        try {
            const response = await fetch('/api/user/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    oldPassword,
                    newPassword,
                    confirmPassword
                })
            });

            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                alert(data.message || 'Password changed successfully');
                window.location.href = '/pages/user-pages/user.html';
            } else {
                alert(data.error || data.message || 'Error resetting password');
            }
        } catch (error) {
            console.error('Reset password error:', error);
            alert('Failed to connect to server');
        }
    });
});