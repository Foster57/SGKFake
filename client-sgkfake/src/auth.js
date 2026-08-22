
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function removeCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

// ── Auth state ──────────────────────────────────────────────
// accessToken giờ là httpOnly cookie — client không thể đọc.
// Browser tự gửi cookie cho mọi same-origin request.
// Trạng thái "đã đăng nhập" được theo dõi qua localStorage('userData') như một hint.
let refreshPromise = null;

function isLoggedIn() {
    return !!localStorage.getItem('userData');
}

/**
 * Backward-compatible getter.
 * Trả về true/false thay vì token string (vì token giờ httpOnly).
 */
function getAccessToken() {
    return isLoggedIn();
}

/**
 * Server set/clear httpOnly cookie qua Set-Cookie header.
 * Client chỉ quản lý localStorage hint — không ghi cookie.
 */
function setAccessToken(_token) {
    // No-op: server handles httpOnly cookie via Set-Cookie header.
}

async function refreshAccessToken() {
    if (!refreshPromise) {
        refreshPromise = fetch('/api/users/refresh', {
            method: 'POST',
            credentials: 'include'
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error('Refresh failed');
                }
                const data = await res.json();
                if (data.user) {
                    localStorage.setItem('userData', JSON.stringify(data.user));
                }
                return true;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
}

async function authFetch(url, options = {}) {
    // httpOnly cookie được browser gửi tự động cho same-origin requests.
    // Không cần set Authorization header thủ công.
    const opts = { ...options, credentials: 'include' };

    const res = await fetch(url, opts);

    if (res.status === 401 && isLoggedIn()) {
        try {
            await refreshAccessToken();
            return fetch(url, opts);
        } catch (err) {
            localStorage.removeItem('userData');
            throw err;
        }
    }
    return res;
}

async function logout() {
    try {
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
        console.error('Logout error:', err);
    }
    // Server clear httpOnly cookies qua Set-Cookie header
    localStorage.removeItem('userData');
    sessionStorage.removeItem('resetEmail');
}

/**
 * Kiểm tra trạng thái auth hiện tại.
 * Trả về { authenticated, user } hoặc { authenticated: false }.
 */
async function checkAuth() {
    if (!isLoggedIn()) return { authenticated: false };

    try {
        const res = await authFetch('/api/users/me');
        if (!res.ok) {
            localStorage.removeItem('userData');
            return { authenticated: false };
        }
        const user = await res.json();
        localStorage.setItem('userData', JSON.stringify(user));
        return { authenticated: true, user };
    } catch {
        localStorage.removeItem('userData');
        return { authenticated: false };
    }
}

window.SGKAuth = {
    getAccessToken,
    setAccessToken,
    refreshAccessToken,
    authFetch,
    logout,
    checkAuth,
    isLoggedIn
};
