import React from 'react';
import { useAuth } from '../context/AuthContext';
import CustomerDashboard from './CustomerDashboard';
import BusinessOwnerDashboard from './BusinessOwnerDashboard';

const Dashboard = () => {
  const { user } = useAuth();

  // Route to appropriate dashboard based on user role
  if (user?.role === 'business_owner') {
    return <BusinessOwnerDashboard />;
  }

  return <CustomerDashboard />;
};

export default Dashboard;
