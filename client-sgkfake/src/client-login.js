document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('form');
    const accountInput = document.getElementById('account') || document.getElementById('username');
    const passwordInput = document.getElementById('password');

    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const account = accountInput ? accountInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value.trim() : '';

        if (!account || !password) {
            alert('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
            return;
        }

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ account, password })
            });

            const result = await response.json();

            if (!response.ok) {
                alert(result.error || 'Đăng nhập thất bại! Vui lòng kiểm tra lại thông tin.');
                if (passwordInput) passwordInput.value = '';
                return;
            }

            // Lưu token và thông tin người dùng vào localStorage
            if (result.token) {
                localStorage.setItem('token', result.token);
            }
            if (result.user) {
                localStorage.setItem('userData', JSON.stringify(result.user));
            }

            // Đăng nhập thành công -> về trang chủ
            window.location.href = '/pages/user-pages/user.html';
        } catch (error) {
            console.error('Failed to login:', error);
            alert('Đã xảy ra lỗi khi kết nối máy chủ. Vui lòng thử lại sau.');
        }
    });
});