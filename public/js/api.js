/**
 * API Service — Centralized HTTP client
 */
const API = {
  baseUrl: '/api',
  token: localStorage.getItem('token'),

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers },
        body: options.body instanceof FormData
          ? options.body
          : options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          API.setToken(null);
          if (typeof App !== 'undefined') App.navigate('login');
        }
        throw { status: res.status, ...data };
      }
      return data;
    } catch (err) {
      if (err.status) throw err;
      throw { error: 'Network error. Please check your connection.' };
    }
  },

  get: (url, params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return API.request(`${url}${qs}`);
  },
  post: (url, body) => API.request(url, { method: 'POST', body }),
  put: (url, body) => API.request(url, { method: 'PUT', body }),
  delete: (url) => API.request(url, { method: 'DELETE' }),
  upload: (url, formData) => API.request(url, { method: 'POST', body: formData }),
};
