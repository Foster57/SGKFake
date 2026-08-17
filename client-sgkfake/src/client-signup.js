document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.querySelector('form');
    const usernameInput = document.getElementById('username') || document.getElementById('account');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const emailInput = document.getElementById('email');

    if (!signupForm) return;

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user_account = usernameInput ? usernameInput.value.trim() : '';
        const hashpasword = passwordInput ? passwordInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';

        // Chỉ kiểm tra confirmPassword nếu input này tồn tại trên giao diện
        if (confirmPasswordInput && hashpasword !== confirmPasswordInput.value.trim()) {
            alert('Mật khẩu xác nhận không khớp!');
            return;
        }

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_account, hashpasword, email })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error ${response.status}`);
            }

            const newUser = await response.json();
            alert('Đăng ký tài khoản thành công!');
            window.location.href = '/login';
        } catch (error) {
            console.error('Failed to sign up:', error);
            alert(error.message || 'Đã xảy ra lỗi khi đăng ký. Vui lòng thử lại sau.');
        }
    });
});
