import axios from 'axios';

// Use environment variable VITE_API_URL if provided, else dev proxy '/api' or production backend URL
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : 'https://corrective-rag.duckdns.org');

const api = axios.create({
  baseURL: API_BASE_URL,
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
