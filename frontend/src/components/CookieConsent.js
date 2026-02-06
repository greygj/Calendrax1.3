import React, { useState, useEffect } from 'react';
import { X, Cookie, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('calendrax_cookie_consent');
    if (!consent) {
      // Small delay before showing for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    setIsClosing(true);
    setTimeout(() => {
      localStorage.setItem('calendrax_cookie_consent', 'accepted');
      localStorage.setItem('calendrax_cookie_consent_date', new Date().toISOString());
      setIsVisible(false);
    }, 300);
  };

  const handleDecline = () => {
    setIsClosing(true);
    setTimeout(() => {
      localStorage.setItem('calendrax_cookie_consent', 'declined');
      localStorage.setItem('calendrax_cookie_consent_date', new Date().toISOString());
      setIsVisible(false);
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-50 p-4 transition-all duration-300 ${
        isClosing ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      }`}
      data-testid="cookie-consent-banner"
    >
      <div className="max-w-4xl mx-auto bg-card border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Icon */}
            <div className="flex-shrink-0 w-12 h-12 bg-brand-400/10 rounded-full flex items-center justify-center">
              <Cookie className="w-6 h-6 text-brand-400" />
            </div>
            
            {/* Content */}
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-400" />
                We value your privacy
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                We use cookies to keep you logged in, remember your preferences, and improve our services. 
                By clicking "Accept", you consent to our use of cookies as described in our{' '}
                <Link to="/privacy" className="text-brand-400 hover:underline">Privacy Policy</Link>.
              </p>
            </div>
            
            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={handleDecline}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg transition-colors"
                data-testid="cookie-decline-btn"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2 text-sm font-medium text-black bg-brand-400 hover:bg-brand-300 rounded-lg transition-colors"
                data-testid="cookie-accept-btn"
              >
                Accept All
              </button>
            </div>
          </div>
          
          {/* Additional info */}
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <p className="text-gray-500 text-xs">
              Essential cookies are required for the platform to function. You can change your preferences at any time.
              See our <Link to="/terms" className="text-brand-400 hover:underline">Terms & Conditions</Link> for more details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
