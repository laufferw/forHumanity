import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

// Create the authentication context
const AuthContext = createContext(null);

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Authentication provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user from localStorage on initial render
  useEffect(() => {
    const loadUser = () => {
      setLoading(true);
      try {
        // Check if user data is in localStorage
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (err) {
        console.error('Error loading user:', err);
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Register a new user
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

  // Login a user
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

  // Logout the current user
  const logout = () => {
    authService.logout();
    setUser(null);
  };

  // Update user profile
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

  // Check if user is authenticated
  const isAuthenticated = () => {
    return authService.isAuthenticated() && !!user;
  };

  // Get current user role
  const getUserRole = () => {
    return user?.role || 'guest';
  };

  // Clear any authentication errors
  const clearError = () => {
    setError(null);
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    updateProfile,
    isAuthenticated,
    getUserRole,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;

import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, getCurrentUser } from '../services/api';

// Create the Authentication Context
const AuthContext = createContext();

// AuthProvider component to wrap around the app
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in on initial load
  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (token) {
          // Verify token and get current user data
          const userData = await getCurrentUser();
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error("Authentication error:", err);
        localStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  // Login function
  const login = async (email, password) => {
    setError(null);
    try {
      const response = await apiLogin(email, password);
      
      // Save token to localStorage
      localStorage.setItem('token', response.token);
      
      // Update state
      setUser(response.user);
      setIsAuthenticated(true);
      
      return response.user;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      throw err;
    }
  };

  // Register function
  const register = async (userData) => {
    setError(null);
    try {
      const response = await apiRegister(userData);
      
      // Save token to localStorage
      localStorage.setItem('token', response.token);
      
      // Update state
      setUser(response.user);
      setIsAuthenticated(true);
      
      return response.user;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
      throw err;
    }
  };

  // Logout function
  const logout = () => {
    // Remove token from localStorage
    localStorage.removeItem('token');
    
    // Update state
    setUser(null);
    setIsAuthenticated(false);
  };

  // Update user function
  const updateUser = (userData) => {
    setUser(userData);
  };

  // Context value
  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

