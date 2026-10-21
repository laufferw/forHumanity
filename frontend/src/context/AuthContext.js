import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, AUTH_EXPIRED_EVENT } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => authService.getCurrentUser());
  // True until a stored session has been checked with the server.
  const [initializing, setInitializing] = useState(() => authService.isAuthenticated());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (authService.isAuthenticated()) {
      authService
        .refreshSession()
        .then((response) => {
          if (!cancelled) setUser(response.user);
        })
        .catch(() => {
          // A 401 clears the session via AUTH_EXPIRED_EVENT; on network errors
          // keep the cached user so the app still works offline-ish.
          if (!cancelled && !authService.isAuthenticated()) setUser(null);
        })
        .finally(() => {
          if (!cancelled) setInitializing(false);
        });
    }

    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const register = async (userData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.register(userData);
      setUser(response.user);
      return response;
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
      return response;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const updateProfile = async (userData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.updateProfile(userData);
      setUser(response.user);
      return response;
    } catch (err) {
      setError(err.message || 'Failed to update profile');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = () => authService.isAuthenticated() && !!user;
  const getUserRole = () => user?.role || 'guest';
  const clearError = () => setError(null);

  const value = {
    user,
    initializing,
    loading,
    error,
    register,
    login,
    logout,
    updateProfile,
    isAuthenticated,
    getUserRole,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
