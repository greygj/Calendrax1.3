import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Building2, MapPin, Calendar } from 'lucide-react';
import { centurionAPI } from '../services/api';

const FoundingMembers = () => {
  const navigate = useNavigate();
  const [centurions, setCenturions] = useState([]);
  const [centurionCount, setCenturionCount] = useState({ count: 0, maxCenturions: 100, spotsRemaining: 100 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        centurionAPI.getList(),
        centurionAPI.getCount()
      ]);
      setCenturions(listRes.data || []);
      setCenturionCount(countRes.data);
    } catch (error) {
      console.error('Failed to load founding members:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-appbg">
      {/* Header */}
      <header className="bg-cardBg border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Founding Members</h1>
            <p className="text-gray-500 text-sm">Calendrax Centurions</p>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-slate-800 via-slate-900 to-transparent py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <img 
            src="https://customer-assets.emergentagent.com/job_f0d49bd6-4ba1-447c-a671-a425c4ff7557/artifacts/cv1m7trg_Calendrax%20Centurion%20Logo.jpeg"
            alt="Calendrax Centurions"
            className="w-32 h-32 md:w-40 md:h-40 object-contain mx-auto mb-6 rounded-lg"
          />
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Calendrax <span className="text-amber-400">Centurions</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            Our founding members who believed in Calendrax from the beginning. 
            These businesses are the backbone of our community and enjoy lifetime benefits.
          </p>
          
          {/* Counter */}
          <div className="inline-flex items-center gap-4 bg-cardBg border border-amber-500/30 rounded-xl px-8 py-4">
            <div className="text-center">
              <div className="text-4xl font-bold">
                <span className="text-amber-400">{centurionCount.count}</span>
                <span className="text-gray-500 mx-2">/</span>
                <span className="text-white">{centurionCount.maxCenturions}</span>
              </div>
              <p className="text-gray-400 text-sm">Centurions Signed Up</p>
            </div>
            {centurionCount.spotsRemaining > 0 && (
              <div className="border-l border-zinc-700 pl-4">
                <div className="text-2xl font-bold text-amber-400">{centurionCount.spotsRemaining}</div>
                <p className="text-gray-400 text-sm">Spots Left</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Members Grid */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          </div>
        ) : centurions.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {centurions.map((business, index) => (
              <div
                key={business.id}
                className="bg-cardBg border border-zinc-800 rounded-xl overflow-hidden hover:border-amber-500/50 transition-all group"
              >
                {/* Badge Number */}
                <div className="relative h-32 bg-gradient-to-br from-amber-900/40 to-yellow-900/20 flex items-center justify-center">
                  <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-sm">
                    #{index + 1}
                  </div>
                  {business.logo ? (
                    <img 
                      src={business.logo} 
                      alt={business.businessName}
                      className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/50"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-amber-500/50">
                      <Building2 className="w-8 h-8 text-amber-400" />
                    </div>
                  )}
                  <Shield className="absolute top-3 right-3 w-6 h-6 text-amber-400" />
                </div>
                
                {/* Info */}
                <div className="p-4">
                  <h3 className="text-white font-semibold text-lg mb-1">{business.businessName}</h3>
                  {business.postcode && (
                    <p className="text-gray-500 text-sm flex items-center gap-1 mb-2">
                      <MapPin className="w-3 h-3" />
                      {business.postcode}
                    </p>
                  )}
                  {business.description && (
                    <p className="text-gray-400 text-sm line-clamp-2">{business.description}</p>
                  )}
                  {business.centurionJoinedAt && (
                    <p className="text-amber-400/70 text-xs mt-3 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Member since {formatDate(business.centurionJoinedAt)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Shield className="w-16 h-16 text-amber-400 mx-auto mb-4 opacity-50" />
            <h3 className="text-white text-xl font-semibold mb-2">Be the First Centurion!</h3>
            <p className="text-gray-400 mb-6">No founding members yet. Be the first to claim this exclusive status.</p>
            <button
              onClick={() => navigate('/signup')}
              className="bg-gradient-to-r from-amber-500 to-yellow-600 text-black px-8 py-3 rounded-lg font-semibold hover:from-amber-400 hover:to-yellow-500 transition-all"
            >
              Sign Up Now
            </button>
          </div>
        )}
      </section>

      {/* CTA Section */}
      {centurionCount.spotsRemaining > 0 && (
        <section className="bg-gradient-to-t from-amber-900/20 to-transparent py-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Want to Join the Centurions?</h2>
            <p className="text-gray-400 mb-6">
              Only {centurionCount.spotsRemaining} spots remaining! Sign up as a business owner to claim your place among the founding members.
            </p>
            <button
              onClick={() => navigate('/signup')}
              className="bg-gradient-to-r from-amber-500 to-yellow-600 text-black px-8 py-3 rounded-lg font-semibold hover:from-amber-400 hover:to-yellow-500 transition-all shadow-lg shadow-amber-500/20"
            >
              Become a Centurion
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default FoundingMembers;
