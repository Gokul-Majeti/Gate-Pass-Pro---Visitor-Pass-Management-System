import axios from 'axios';

const TOKEN_KEY = 'gatepass_jwt_token';
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
});

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function extractErrorMessage(err, fallback = 'Something went wrong') {
  if (err?.response?.data?.details?.length) {
    return err.response.data.details.map((d) => `${d.path}: ${d.message}`).join('; ');
  }
  return err?.response?.data?.message || err?.message || fallback;
}

export function resolveAssetUrl(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function getPassPdfUrl(passId, download = false) {
  const token = encodeURIComponent(getStoredToken());
  return `${API_ORIGIN}/api/passes/${passId}/pdf?token=${token}${download ? '&download=true' : ''}`;
}

export function getReportExportUrl(queryString = '') {
  const token = encodeURIComponent(getStoredToken());
  return `${API_ORIGIN}/api/reports/export?token=${token}${queryString ? `&${queryString}` : ''}`;
}
