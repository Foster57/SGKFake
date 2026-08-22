/**
 * Client-side Route Guard (defense in depth)
 * 
 * Chạy trên mỗi protected page để:
 * 1. Kiểm tra localStorage hint (userData)
 * 2. Kiểm tra role phù hợp (nếu cần)
 * 3. Verify token với server qua /api/users/me (httpOnly cookie gửi tự động)
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
        // accessToken là httpOnly cookie — kiểm tra localStorage hint thay vì cookie
        if (!localStorage.getItem('userData')) {
            redirectToLogin();
            return;
        }

        try {
            // httpOnly cookie được browser gửi tự động — không cần Authorization header
            const res = await fetch('/api/users/me', {
                credentials: 'include'
            });

            if (res.status === 401) {
                // Token hết hạn, thử refresh
                if (window.SGKAuth) {
                    try {
                        await SGKAuth.refreshAccessToken();
                        // Retry — cookie mới đã được server set
                        const retryRes = await fetch('/api/users/me', {
                            credentials: 'include'
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
        // httpOnly cookie chỉ có thể clear bởi server (qua Set-Cookie)
        localStorage.removeItem('userData');
        sessionStorage.removeItem('resetEmail');
    }

    // Xử lý browser back/forward: re-check auth mỗi khi page được restore từ bfcache
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            // Page restored từ bfcache (back/forward)
            if (!localStorage.getItem('userData')) {
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
