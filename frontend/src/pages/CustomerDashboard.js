import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Building2, MapPin, ChevronRight } from 'lucide-react';
import { getBusinessesSorted } from '../data/mock';

const CustomerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const businesses = getBusinessesSorted();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleBusinessClick = (businessId) => {
    navigate(`/business/${businessId}`);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-bold">Booka</h1>
            <p className="text-gray-500 text-xs tracking-[0.2em]">BOOKING APP</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white font-medium">{user?.fullName}</p>
              <p className="text-gray-500 text-sm">Customer</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-white text-2xl font-semibold mb-2">Welcome, {user?.fullName?.split(' ')[0]}!</h2>
          <p className="text-gray-500">Choose a business to book your appointment</p>
        </div>

        {/* Business List */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-gray-400" />
            <h3 className="text-white text-lg font-semibold">Available Businesses</h3>
          </div>
          
          <div className="space-y-3">
            {businesses.map(business => (
              <button
                key={business.id}
                onClick={() => handleBusinessClick(business.id)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  {/* Logo */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                    {business.logo ? (
                      <img
                        src={business.logo}
                        alt={`${business.businessName} logo`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                  </div>
                  
                  {/* Business Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold text-lg truncate">{business.businessName}</h4>
                    <p className="text-gray-500 text-sm truncate">{business.description}</p>
                    {business.postcode && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-500 text-xs">{business.postcode}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>

          {businesses.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No businesses available yet</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CustomerDashboard;
