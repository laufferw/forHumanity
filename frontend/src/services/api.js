import axios from 'axios';

// Create axios instance with base URL from environment variable
const API_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Fired when the API rejects the stored token so the auth context can log out.
export const AUTH_EXPIRED_EVENT = 'forhumanity:auth-expired';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token in headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = Boolean(error.config?.headers?.['x-auth-token']);
    if (error.response?.status === 401 && sentToken) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

// Unwraps the response body and turns failures into { message } objects.
const call = async (promise) => {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Could not reach the server. Please try again.' };
  }
};

const storeSession = (data) => {
  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }
  return data;
};

// Authentication Service
const authService = {
  register: async (userData) => storeSession(await call(api.post('/users/register', userData))),

  login: async (credentials) => storeSession(await call(api.post('/users/login', credentials))),

  // Validates the stored token and returns a fresh one with current user data.
  refreshSession: async () => storeSession(await call(api.post('/users/session/refresh'))),

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  updateProfile: async (userData) => {
    const data = await call(api.put('/users/profile', userData));
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },
};

// Blanket Request Service
const requestService = {
  createRequest: (requestData) => call(api.post('/requests', requestData)),

  // Admin only; filters: { status }
  getAllRequests: (filters = {}) => call(api.get('/requests', { params: filters })),

  // Requests the current user submitted
  getUserRequests: () => call(api.get('/requests/user')),

  // Requests assigned to the current user
  getAssignedRequests: () => call(api.get('/requests/assigned')),

  getRequestById: (requestId) => call(api.get(`/requests/${requestId}`)),

  updateRequestStatus: (requestId, status) =>
    call(api.put(`/requests/${requestId}/status`, { status })),

  // Admin only
  assignRequest: (requestId, userId) =>
    call(api.put(`/requests/${requestId}`, { assignedTo: userId })),

  // Admin only
  deleteRequest: (requestId) => call(api.delete(`/requests/${requestId}`)),
};

// Admin Service
const adminService = {
  getAllUsers: () => call(api.get('/users')),

  // updates: { role, status, name, email, phone }
  updateUser: (userId, updates) => call(api.put(`/users/${userId}`, updates)),

  deleteUser: (userId) => call(api.delete(`/users/${userId}`)),

  getDashboardStats: () => call(api.get('/admin/dashboard')),
};

export { authService, requestService, adminService };
