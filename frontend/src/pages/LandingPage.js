import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Clock, Star, Building2, ArrowRight, Shield, Check } from 'lucide-react';
import { businessAPI, centurionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [centurionData, setCenturionData] = useState({ count: 0, maxCenturions: 100, isAvailable: true });
  const [displayCount, setDisplayCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    loadBusinesses();
    loadCenturionCount();
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

  const loadCenturionCount = async () => {
    try {
      const res = await centurionAPI.getCount();
      setCenturionData(res.data);
    } catch (error) {
      console.error('Failed to load centurion count:', error);
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
            src="https://customer-assets.emergentagent.com/job_3f85dde5-1e91-4759-bd85-f441b993a550/artifacts/s4024gg5_Calendrax1.3%20Logo%20Opaque%20%282%29.png" 
            alt="Calendrax" 
            className="h-16"
            
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

      {/* Centurion Founding Members Banner */}
      {centurionData.isAvailable && (
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-b border-amber-500/30">
          <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
            
            {/* Mobile: Logo + Counter at TOP */}
            <div className="flex flex-col items-center mb-4 lg:hidden">
              <img 
                src="/calendrax-centurion-logo.png"
                alt="Calendrax Centurions"
                className="w-32 h-32 object-contain mb-2"
              />
              <div className="text-center">
                <div className="text-3xl font-bold">
                  <span className="text-amber-400">{centurionData.count}</span>
                  <span className="text-gray-500 mx-1">/</span>
                  <span className="text-white">{centurionData.maxCenturions}</span>
                </div>
                <p className="text-gray-400 text-sm">Centurions Signed Up</p>
              </div>
            </div>

            {/* Desktop: Side-by-side layout / Mobile: Stacked compact layout */}
            <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8">
              
              {/* Content Section */}
              <div className="flex-1 text-center lg:text-left order-1 lg:order-1">
                <h2 className="text-amber-400 text-lg md:text-2xl font-bold uppercase tracking-wide mb-1 md:mb-2">
                  Calling All Business Owners
                </h2>
                <p className="text-white text-base md:text-xl mb-3 md:mb-4">
                  Secure lifetime reduced pricing and help shape the future of salon booking.
                </p>
                
                {/* Benefits - Compact on mobile */}
                <ul className="space-y-1 md:space-y-2 mb-4 md:mb-6 text-left text-sm md:text-base">
                  <li className="flex items-start gap-2 text-gray-300">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>Lifetime <span className="text-amber-400 font-semibold">£10/month</span> for 1st Staff - <span className="text-amber-400 font-semibold">£5/month</span> each additional</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>Centurion Referral credits - <span className="text-amber-400 font-semibold">Each referral = 2 FREE months</span></span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>Influence over new features</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>FREE Migration support</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>Founding member recognition</span>
                  </li>
                </ul>
              </div>

              {/* Logo - Hidden on mobile, shown on desktop left side */}
              <div className="hidden lg:block flex-shrink-0 order-2 lg:order-first">
                <img 
                  src="/calendrax-centurion-logo.png"
                  alt="Calendrax Centurions"
                  className="w-48 h-48 object-contain"
                />
              </div>
            </div>

            {/* CTA Section */}
            <div className="flex flex-col items-center mt-4 lg:mt-0 lg:ml-56">
              {/* CTA Button */}
              <button
                onClick={() => navigate('/signup')}
                className="bg-gradient-to-r from-amber-500 to-yellow-600 text-black px-6 md:px-8 py-2.5 md:py-3 rounded-lg font-bold text-base md:text-lg hover:from-amber-400 hover:to-yellow-500 transition-all shadow-lg shadow-amber-500/30 w-full sm:w-auto"
              >
                Claim your Centurion spot NOW
              </button>
              
              {/* Desktop: Counter below button */}
              <div className="hidden lg:flex items-center gap-4 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    <span className="text-amber-400">{centurionData.count}</span>
                    <span className="text-gray-500 mx-1">/</span>
                    <span className="text-white">{centurionData.maxCenturions}</span>
                  </div>
                  <p className="text-gray-400 text-sm">Centurions Signed Up</p>
                </div>
              </div>
              
              {/* Links and spots remaining */}
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mt-3 text-xs md:text-sm">
                <button
                  onClick={() => navigate('/founding-members')}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors font-medium"
                >
                  View our Centurions <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                </button>
                <span className="text-gray-500 hidden sm:inline">|</span>
                <span className="text-gray-400">Only <span className="text-amber-400 font-semibold">{centurionData.spotsRemaining}</span> spots available</span>
              </div>
              
              <p className="text-amber-400/80 italic mt-2 md:mt-4 text-sm md:text-lg">Let's grow together</p>
            </div>
          </div>
        </section>
      )}

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
            src="https://customer-assets.emergentagent.com/job_3f85dde5-1e91-4759-bd85-f441b993a550/artifacts/s4024gg5_Calendrax1.3%20Logo%20Opaque%20%282%29.png" 
            alt="Calendrax" 
            className="h-10"
            
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
