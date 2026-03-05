/**
 * API Client — centralized fetch wrapper with auth, error handling, and base URL.
 */
const API_BASE = '/api';

class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        credentials: 'include', // send cookies for Better Auth sessions
        ...options,
    };

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (config.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    let res;
    try {
        res = await fetch(url, config);
    } catch (networkErr) {
        // Network error (CORS blocked, server down, etc.)
        throw new ApiError('Network error — server mungkin belum jalan', 0);
    }

    if (res.status === 401) {
        // Only redirect if NOT already on login page and NOT an auth endpoint
        const isAuthEndpoint = endpoint.startsWith('/auth/');
        const isOnLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
        if (!isAuthEndpoint && !isOnLoginPage) {
            window.location.href = '/login';
        }
        throw new ApiError('Unauthorized', 401);
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
    }

    if (res.status === 204) return null;
    return res.json();
}

const api = {
    get: (endpoint) => request(endpoint),
    post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
    upload: (endpoint, formData, method = 'POST') => request(endpoint, { method, body: formData }),
};

export default api;
export { ApiError };
