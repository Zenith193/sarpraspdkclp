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
        throw new ApiError(data.error || data.message || `Request failed (${res.status})`, res.status, data);
    }

    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
}

const api = {
    get: (endpoint) => request(endpoint),
    post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
    upload: (endpoint, formData, method = 'POST') => request(endpoint, { method, body: formData }),

    /**
     * Upload with progress callback using XMLHttpRequest.
     * @param {string} endpoint - API endpoint
     * @param {FormData} formData - form data to upload
     * @param {function} onProgress - callback(percent) where percent is 0-100
     * @param {string} method - HTTP method (default: POST)
     * @returns {Promise} resolves with parsed JSON response
     */
    uploadWithProgress: (endpoint, formData, onProgress, method = 'POST') => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, `${API_BASE}${endpoint}`);
            xhr.withCredentials = true;
            xhr.timeout = 120000; // 2 minutes

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 401) {
                    window.location.href = '/login';
                    reject(new ApiError('Unauthorized', 401));
                    return;
                }
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(data);
                    } else {
                        reject(new ApiError(data.error || `Upload gagal (${xhr.status})`, xhr.status, data));
                    }
                } catch {
                    if (xhr.status >= 200 && xhr.status < 300) resolve(null);
                    else reject(new ApiError(`Upload gagal (${xhr.status})`, xhr.status));
                }
            };

            xhr.onerror = () => reject(new ApiError('Network error — koneksi gagal', 0));
            xhr.ontimeout = () => reject(new ApiError('Upload timeout — koneksi terlalu lambat', 0));
            xhr.send(formData);
        });
    },
};

export default api;
export { ApiError };
