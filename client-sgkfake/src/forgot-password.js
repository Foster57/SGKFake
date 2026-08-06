document.addEventListener('DOMContentLoaded', () => {
    const forgotForm = document.querySelector('form');
    const forgotEmail = document.getElementById('email');

    if (!forgotForm) return;

    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = forgotEmail ? forgotEmail.value.trim() : '';

        if (!email) {
            alert('Vui lòng nhập Email của bạn.');
            return;
        }

        try {
            const response = await fetch('/api/users/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Yêu cầu thất bại.');
            }
            sessionStorage.setItem('resetEmail', email);
            window.location.href = '/pages/verify-otp.html';
        } catch (error) {
            console.error('Forgot password error:', error);
            alert(error.message || 'Đã xảy ra lỗi khi gửi yêu cầu.');
        }
    });
});