import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Star, Building2, Phone, Mail, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { businessAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PublicBusinessPage = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBusinessData();
  }, [businessId]);

  const loadBusinessData = async () => {
    try {
      const [businessRes, servicesRes] = await Promise.all([
        businessAPI.getById(businessId),
        businessAPI.getServices(businessId)
      ]);
      setBusiness(businessRes.data);
      setServices(servicesRes.data || []);
      // Reviews will be loaded when implemented
      setReviews([]);
    } catch (error) {
      console.error('Failed to load business:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = () => {
    if (user) {
      navigate(`/book/${businessId}`);
    } else {
      navigate(`/login?redirect=/book/${businessId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-appbg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-appbg flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Business not found</p>
          <button
            onClick={() => navigate('/')}
            className="bg-brand-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-brand-400 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const businessPhotos = business.photos || [];

  return (
    <div className="min-h-screen bg-appbg">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Dashboard
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="bg-brand-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-brand-400 transition-colors text-sm"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero / Cover Image */}
      <div className="h-64 bg-zinc-800 relative">
        {businessPhotos.length > 0 ? (
          <img 
            src={businessPhotos[0]} 
            alt={business.businessName}
            className="w-full h-full object-cover"
          />
        ) : business.logo ? (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900">
            <img 
              src={business.logo} 
              alt={business.businessName}
              className="max-h-40 max-w-[80%] object-contain"
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-24 h-24 text-zinc-600" />
          </div>
        )}
        
        {/* Business Logo Overlay */}
        {business.logo && businessPhotos.length > 0 && (
          <div className="absolute bottom-4 left-4 w-20 h-20 bg-white rounded-xl shadow-lg overflow-hidden">
            <img 
              src={business.logo} 
              alt={business.businessName}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Business Info */}
        <div className="mb-8">
          <h1 className="text-white text-3xl font-bold mb-2">{business.businessName}</h1>
          
          {business.description && (
            <p className="text-gray-400 mb-4">{business.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            {business.postcode && (
              <span className="flex items-center gap-2 text-gray-400">
                <MapPin className="w-4 h-4 text-brand-400" />
                {business.address || business.postcode}
              </span>
            )}
            {business.phone && (
              <span className="flex items-center gap-2 text-gray-400">
                <Phone className="w-4 h-4 text-brand-400" />
                {business.phone}
              </span>
            )}
            {business.email && (
              <span className="flex items-center gap-2 text-gray-400">
                <Mail className="w-4 h-4 text-brand-400" />
                {business.email}
              </span>
            )}
          </div>
        </div>

        {/* Photo Gallery */}
        {businessPhotos.length > 1 && (
          <div className="mb-8">
            <h2 className="text-white text-xl font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-brand-400" />
              Photos
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {businessPhotos.slice(0, 3).map((photo, index) => (
                <div key={index} className="aspect-square rounded-xl overflow-hidden bg-zinc-800">
                  <img 
                    src={photo} 
                    alt={`${business.businessName} photo ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Services */}
        <div className="mb-8">
          <h2 className="text-white text-xl font-semibold mb-4">Services</h2>
          {services.length > 0 ? (
            <div className="space-y-3">
              {services.filter(s => s.active !== false).map(service => (
                <div 
                  key={service.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-white font-medium">{service.name}</h3>
                      {service.description && (
                        <p className="text-gray-500 text-sm mt-1">{service.description}</p>
                      )}
                      <span className="text-gray-400 text-sm flex items-center gap-1 mt-2">
                        <Clock className="w-4 h-4" />
                        {service.duration} min
                      </span>
                    </div>
                    <span className="text-brand-400 font-semibold text-lg">£{service.price}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-gray-500">No services listed yet</p>
            </div>
          )}
        </div>

        {/* Reviews Section */}
        <div className="mb-8">
          <h2 className="text-white text-xl font-semibold mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-brand-400" />
            Reviews
          </h2>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review, index) => (
                <div key={index} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} 
                        />
                      ))}
                    </div>
                    <span className="text-gray-500 text-sm">{review.date}</span>
                  </div>
                  <p className="text-gray-300">{review.comment}</p>
                  <p className="text-gray-500 text-sm mt-2">— {review.customerName}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <Star className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No reviews yet</p>
              <p className="text-gray-600 text-sm mt-1">Be the first to leave a review!</p>
            </div>
          )}
        </div>

        {/* Location Map Placeholder */}
        {business.postcode && (
          <div className="mb-8">
            <h2 className="text-white text-xl font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-400" />
              Location
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <iframe
                title="Business Location"
                width="100%"
                height="250"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://www.google.com/maps?q=${encodeURIComponent(business.postcode)}&output=embed`}
                allowFullScreen
              />
              <div className="p-4 border-t border-zinc-800">
                <p className="text-gray-400">{business.address || business.postcode}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Book Now Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={handleBookNow}
            className="w-full bg-brand-500 text-black font-semibold py-4 rounded-xl hover:bg-brand-400 transition-colors flex items-center justify-center gap-2"
          >
            Book Now
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom padding to account for fixed button */}
      <div className="h-24"></div>
    </div>
  );
};

export default PublicBusinessPage;
