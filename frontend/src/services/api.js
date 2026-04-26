import axios from 'axios';

// In production, API calls go directly to the backend URL.
// In development, Vite proxy handles /api → localhost:8000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000,
});

// Attach token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Health ─────────────────────────────────────
export const checkHealth = () => api.get('/health');

// ── Graph structure ────────────────────────────
export const getGraphNodes = () => api.get('/graph/nodes');
export const getGraphEdges = () => api.get('/graph/edges');

// ── Node state inspection ──────────────────────
export const getNodeState = (nodeId) =>
  api.get(`/node/${nodeId}/state`);

export default api;
