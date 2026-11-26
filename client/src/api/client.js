import axios from 'axios';

const TOKEN_KEY = 'gatepass_jwt_token';

export const api = axios.create({
  baseURL: '/api',
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

export function getPassPdfUrl(passId, download = false) {
  const token = encodeURIComponent(getStoredToken());
  return `/api/passes/${passId}/pdf?token=${token}${download ? '&download=true' : ''}`;
}
