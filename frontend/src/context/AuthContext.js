import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockUsers, mockBusinesses, addBusiness } from '../data/mock';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user on mount
    const storedUser = localStorage.getItem('booka_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // Mock login - find user in mock data
    const foundUser = mockUsers.find(
      u => u.email === email && u.password === password
    );
    
    if (foundUser) {
      const { password: _, ...userWithoutPassword } = foundUser;
      
      // If business owner, attach their business info
      if (foundUser.role === 'business_owner') {
        const business = mockBusinesses.find(b => b.ownerId === foundUser.id);
        if (business) {
          userWithoutPassword.business = business;
        }
      }
      
      setUser(userWithoutPassword);
      localStorage.setItem('booka_user', JSON.stringify(userWithoutPassword));
      return { success: true, user: userWithoutPassword };
    }
    
    return { success: false, error: 'Invalid email or password' };
  };

  const signup = async (userData) => {
    // Check if email already exists
    const exists = mockUsers.find(u => u.email === userData.email);
    if (exists) {
      return { success: false, error: 'Email already registered' };
    }

    // Create new user
    const newUser = {
      id: String(Date.now()),
      fullName: userData.fullName,
      email: userData.email,
      mobile: userData.mobile,
      password: userData.password,
      role: userData.role,
      createdAt: new Date().toISOString()
    };
    
    // Add to mock users (in memory only)
    mockUsers.push(newUser);
    
    const { password: _, ...userWithoutPassword } = newUser;
    
    // If business owner, create the business profile
    if (userData.role === 'business_owner') {
      const newBusiness = {
        id: `b${Date.now()}`,
        ownerId: newUser.id,
        businessName: userData.businessName,
        logo: userData.logo || null,
        postcode: userData.postcode,
        address: '', // Can be enhanced to get from postcode lookup
        description: userData.businessDescription || `Services provided by ${userData.businessName}`,
        services: ['s1', 's2'], // Default services for new businesses
        createdAt: new Date().toISOString()
      };
      
      addBusiness(newBusiness);
      userWithoutPassword.business = newBusiness;
    }
    
    setUser(userWithoutPassword);
    localStorage.setItem('booka_user', JSON.stringify(userWithoutPassword));
    
    return { success: true, user: userWithoutPassword };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('booka_user');
  };

  const updateUser = (updatedData) => {
    const updatedUser = { ...user, ...updatedData };
    setUser(updatedUser);
    localStorage.setItem('booka_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading, updateUser }}>
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
