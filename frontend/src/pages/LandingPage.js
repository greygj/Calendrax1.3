import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Clock, Star, Building2, ArrowRight } from 'lucide-react';
import { businessAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      const res = await businessAPI.getAll();
      // Only show approved businesses
      const approved = (res.data || []).filter(b => b.approved);
      setBusinesses(approved);
    } catch (error) {
      console.error('Failed to load businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewBusiness = (businessId) => {
    // Always go to public business page first
    navigate(`/business/${businessId}`);
  };

  const filteredBusinesses = businesses.filter(business =>
    business.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    business.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    business.postcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-appbg">
      {/* Header */}
      <header className="bg-cardBg border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <img 
            src="https://customer-assets.emergentagent.com/job_3f85dde5-1e91-4759-bd85-f441b993a550/artifacts/6d6uguuw_Calendrax1.3%20Logo%20Opaque.png" 
            alt="Calendrax" 
            className="h-20"
            
          />
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-brand-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-brand-400 transition-colors"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-gray-400 hover:text-white px-4 py-2 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="bg-brand-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-brand-400 transition-colors"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-zinc-900 to-black py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Book Your Next <span className="text-brand-400">Appointment</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Discover and book services from local businesses in just a few clicks
          </p>
          
          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search businesses by name or location..."
              className="w-full bg-cardBg border border-zinc-700 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
        </div>
      </section>

      {/* Businesses Grid */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-white text-2xl font-semibold mb-6">
          {searchTerm ? `Search Results (${filteredBusinesses.length})` : 'Featured Businesses'}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          </div>
        ) : filteredBusinesses.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBusinesses.map(business => (
              <div
                key={business.id}
                onClick={() => handleViewBusiness(business.id)}
                className="bg-cardBg border border-zinc-800 rounded-xl overflow-hidden hover:border-brand-500/50 transition-all group cursor-pointer"
              >
                {/* Top Half - Hero Image */}
                <div className="h-40 bg-zinc-800 relative overflow-hidden">
                  {business.photos && business.photos.length > 0 ? (
                    <img 
                      src={business.photos[0]} 
                      alt={business.businessName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : business.logo ? (
                    <img 
                      src={business.logo} 
                      alt={business.businessName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-16 h-16 text-zinc-600" />
                    </div>
                  )}
                </div>

                {/* Bottom Half - Logo & Business Info */}
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {/* Business Logo */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                      {business.logo ? (
                        <img 
                          src={business.logo} 
                          alt={business.businessName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-zinc-600" />
                        </div>
                      )}
                    </div>
                    
                    {/* Business Name & Location */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold truncate group-hover:text-brand-400 transition-colors">
                        {business.businessName}
                      </h3>
                      {business.postcode && (
                        <p className="text-gray-500 text-sm flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {business.postcode}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {business.description && (
                    <p className="text-gray-500 text-sm line-clamp-2 mb-3">
                      {business.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    {business.serviceCount > 0 && (
                      <span className="text-gray-400 text-sm flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {business.serviceCount} services
                      </span>
                    )}
                    <span className="text-brand-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                      View & Book
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-cardBg border border-zinc-800 rounded-xl p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No businesses found matching your search' : 'No businesses available yet'}
            </p>
          </div>
        )}
      </section>

      {/* CTA Section for Business Owners */}
      <section className="bg-cardBg border-t border-zinc-800 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-white text-2xl font-semibold mb-4">
            Are you a business owner?
          </h2>
          <p className="text-gray-400 mb-6">
            Join Calendrax and let customers discover and book your services online
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="bg-brand-500 text-black px-8 py-3 rounded-lg font-semibold hover:bg-brand-400 transition-colors"
          >
            Register Your Business
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-appbg border-t border-zinc-800 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <img 
            src="https://customer-assets.emergentagent.com/job_3f85dde5-1e91-4759-bd85-f441b993a550/artifacts/6d6uguuw_Calendrax1.3%20Logo%20Opaque.png" 
            alt="Calendrax" 
            className="h-12"
            
          />
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="/terms" className="hover:text-white transition-colors">Terms & Conditions</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          </div>
          <p className="text-gray-600 text-sm">
            © 2026 Calendrax. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
