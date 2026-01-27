import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user and token on mount
    const storedUser = localStorage.getItem('booka_user');
    const token = localStorage.getItem('booka_token');
    
    if (storedUser && token) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      // Verify token is still valid
      authAPI.getMe()
        .then(response => {
          setUser({ ...parsedUser, ...response.data.user, business: response.data.business });
          localStorage.setItem('booka_user', JSON.stringify({ ...parsedUser, ...response.data.user, business: response.data.business }));
        })
        .catch(() => {
          // Token invalid, clear storage
          localStorage.removeItem('booka_token');
          localStorage.removeItem('booka_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { token, user: userData, business } = response.data;
      
      const fullUser = { ...userData, business };
      
      localStorage.setItem('booka_token', token);
      localStorage.setItem('booka_user', JSON.stringify(fullUser));
      setUser(fullUser);
      
      return { success: true, user: fullUser };
    } catch (error) {
      const message = error.response?.data?.detail || 'Invalid email or password';
      return { success: false, error: message };
    }
  };

  const signup = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      const { token, user: newUser, business } = response.data;
      
      const fullUser = { ...newUser, business };
      
      localStorage.setItem('booka_token', token);
      localStorage.setItem('booka_user', JSON.stringify(fullUser));
      setUser(fullUser);
      
      return { success: true, user: fullUser };
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('booka_token');
    localStorage.removeItem('booka_user');
  };

  const updateUser = (updatedData) => {
    const updatedUser = { ...user, ...updatedData };
    setUser(updatedUser);
    localStorage.setItem('booka_user', JSON.stringify(updatedUser));
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getMe();
      const fullUser = { ...response.data.user, business: response.data.business };
      setUser(fullUser);
      localStorage.setItem('booka_user', JSON.stringify(fullUser));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
