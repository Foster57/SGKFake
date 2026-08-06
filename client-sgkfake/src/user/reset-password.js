document.addEventListener('DOMContentLoaded', () => {
    const resetPasswordForm = document.querySelector('form');
    const oldPasswordInput = document.getElementById('password');
    const newPasswordInput = document.getElementById('confirm-password');
    const confirmNewPasswordInput = document.getElementById('confirm-password');

    if (!resetPasswordForm) return;

    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = oldPasswordInput.value.trim();
        const newPassword = newPasswordInput.value.trim();
        const confirmNewPassword = confirmNewPasswordInput.value.trim();

        if (newPassword !== confirmNewPassword) {
            alert('New password and confirm new password do not match');
            return;
        }

        const response = await fetch('/api/user/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                oldPassword,
                newPassword
            })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Password changed successfully');
            window.location.href = '/pages/user-pages/user.html';
        } else {
            alert(data.message);
        }
    });
});