document.addEventListener('DOMContentLoaded', () => {
    const verifyForm = document.getElementById('verifyForm');
    const emailInput = document.getElementById('email');
    const otpInput = document.getElementById('otp');
    const newPasswordInput = document.getElementById('newPassword');

    const savedEmail = sessionStorage.getItem('resetEmail');
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
    }

    if (!verifyForm) return;

    verifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput ? emailInput.value.trim() : '';
        const otp = otpInput ? otpInput.value.trim() : '';
        const newPassword = newPasswordInput ? newPasswordInput.value.trim() : '';

        if (!email || !otp || !newPassword) {
            alert('Vui lòng nhập đầy đủ thông tin.');
            return;
        }

        try {
            const response = await fetch('/api/users/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, otp, newPassword })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Xác thực OTP thất bại.');
            }

            alert(data.message || 'Mật khẩu mới đã được cập nhật thành công!');
            sessionStorage.removeItem('resetEmail');
            window.location.href = '/login';
        } catch (error) {
            console.error('Verify OTP error:', error);
            alert(error.message || 'Đã xảy ra lỗi khi xác thực OTP.');
        }
    });
});
