/**
 * Client-side Route Guard (defense in depth)
 * 
 * Chạy trên mỗi protected page để:
 * 1. Kiểm tra access token tồn tại
 * 2. Kiểm tra role phù hợp (nếu cần)
 * 3. Verify token với server qua /api/users/me
 * 4. Xử lý browser back/forward sau logout
 * 
 * Usage trong HTML:
 *   <script src="/src/auth.js"></script>
 *   <script src="/src/route-guard.js" data-require-auth="true" data-require-role="admin"></script>
 */
(function () {
    const script = document.currentScript;
    const requireAuth = script?.getAttribute('data-require-auth') === 'true';
    const requireRole = script?.getAttribute('data-require-role') || null;

    if (!requireAuth) return;

    // Ẩn body cho đến khi xác thực xong (tránh flash of protected content)
    document.documentElement.style.visibility = 'hidden';

    async function checkAuth() {
        const token = localStorage.getItem('accessToken');

        // Không có token → chuyển login ngay
        if (!token) {
            redirectToLogin();
            return;
        }

        try {
            // Verify token với server
            const res = await fetch('/api/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 401) {
                // Token hết hạn, thử refresh
                if (window.SGKAuth) {
                    try {
                        await SGKAuth.refreshAccessToken();
                        // Retry
                        const retryRes = await fetch('/api/users/me', {
                            headers: { 'Authorization': `Bearer ${SGKAuth.getAccessToken()}` }
                        });
                        if (!retryRes.ok) throw new Error('Refresh failed');
                        const user = await retryRes.json();
                        return handleAuthResult(user);
                    } catch {
                        clearAuthData();
                        redirectToLogin();
                        return;
                    }
                }
                clearAuthData();
                redirectToLogin();
                return;
            }

            if (!res.ok) {
                clearAuthData();
                redirectToLogin();
                return;
            }

            const user = await res.json();
            handleAuthResult(user);
        } catch {
            clearAuthData();
            redirectToLogin();
        }
    }

    function handleAuthResult(user) {
        // Check role
        if (requireRole && user.role !== requireRole) {
            if (user.role === 'admin') {
                window.location.replace('/admin');
            } else {
                window.location.replace('/403');
            }
            return;
        }

        // Cập nhật localStorage cho các page khác sử dụng
        localStorage.setItem('userData', JSON.stringify(user));

        // Auth OK → hiện page
        document.documentElement.style.visibility = 'visible';
    }

    function redirectToLogin() {
        window.location.replace('/login');
    }

    function clearAuthData() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userData');
        sessionStorage.removeItem('resetEmail');
    }

    // Xử lý browser back/forward: re-check auth mỗi khi page được restore từ bfcache
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            // Page restored từ bfcache (back/forward)
            const token = localStorage.getItem('accessToken');
            if (!token) {
                redirectToLogin();
            }
        }
    });

    // Chạy check
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAuth);
    } else {
        checkAuth();
    }
})();
