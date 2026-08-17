// Client auth helper: mutex refresh (D) + wrapper tự refresh khi access token hết hạn
let accessToken = localStorage.getItem('accessToken');
let refreshPromise = null;

function getAccessToken() {
    return accessToken;
}

function setAccessToken(token) {
    accessToken = token;
    if (token) {
        localStorage.setItem('accessToken', token);
    } else {
        localStorage.removeItem('accessToken');
    }
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
                setAccessToken(data.accessToken);
                if (data.user) {
                    localStorage.setItem('userData', JSON.stringify(data.user));
                }
                return data.accessToken;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
}

async function authFetch(url, options = {}) {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    if (accessToken) {
        opts.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetch(url, opts);

    if (res.status === 401 && accessToken) {
        try {
            const newToken = await refreshAccessToken();
            opts.headers['Authorization'] = `Bearer ${newToken}`;
            return fetch(url, opts);
        } catch (err) {
            setAccessToken(null);
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
    setAccessToken(null);
    localStorage.removeItem('userData');
    sessionStorage.removeItem('resetEmail');
    // Cookie accessToken đã được server clear qua Set-Cookie
}

/**
 * Kiểm tra trạng thái auth hiện tại.
 * Trả về { authenticated, user } hoặc { authenticated: false }.
 */
async function checkAuth() {
    const token = getAccessToken();
    if (!token) return { authenticated: false };

    try {
        const res = await authFetch('/api/users/me');
        if (!res.ok) {
            setAccessToken(null);
            localStorage.removeItem('userData');
            return { authenticated: false };
        }
        const user = await res.json();
        localStorage.setItem('userData', JSON.stringify(user));
        return { authenticated: true, user };
    } catch {
        setAccessToken(null);
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
    checkAuth
};
