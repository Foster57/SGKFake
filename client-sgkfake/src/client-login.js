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
            const response = await fetch(`/api/users?user_account=${encodeURIComponent(account)}&hashpasword=${encodeURIComponent(password)}`);
            if (!response.ok) {
                throw new Error(`Server error ${response.status}`);
            }

            const users = await response.json();
            if (!users || users.length === 0) {
                alert('Mật khẩu hoặc tài khoản không chính xác! Vui lòng nhập lại.');
                if (passwordInput) passwordInput.value = '';
                return;
            }

            // Đăng nhập thành công -> về trang chủ
            window.location.href = '/pages/user-pages/user.html';
        } catch (error) {
            console.error('Failed to login:', error);
            alert('Đã xảy ra lỗi khi kết nối máy chủ. Vui lòng thử lại sau.');
        }
    });
});