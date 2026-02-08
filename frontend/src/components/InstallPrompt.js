import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

const InstallPrompt = ({ onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsStandalone(isInStandaloneMode);

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // Listen for the beforeinstallprompt event (Android/Desktop Chrome)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        onClose();
      }
    }
  };

  // Don't show if already installed
  if (isStandalone) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-cardBg border border-zinc-800 rounded-2xl max-w-sm w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden bg-zinc-800">
            <img 
              src="https://static.prod-images.emergentagent.com/jobs/0a8e5439-e27a-4cf4-ab80-2c407fb7f723/images/38321fb848a19e6af336cf5b047dd989bc23936e7d535cc24a459915ddad6505.png" 
              alt="Calendrax"
              className="w-full h-full object-contain"
            />
          </div>
          
          <h3 className="text-white text-xl font-bold mb-2">Add Calendrax to Home Screen</h3>
          <p className="text-gray-400 text-sm mb-6">
            Get quick access to Calendrax right from your home screen for a better experience.
          </p>

          {isIOS ? (
            // iOS instructions
            <div className="bg-zinc-800/50 rounded-xl p-4 text-left mb-4">
              <p className="text-white text-sm font-medium mb-3">To install on iPhone/iPad:</p>
              <ol className="text-gray-400 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="bg-brand-500 text-black w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Tap the <strong className="text-white">Share</strong> button at the bottom of Safari</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-brand-500 text-black w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-brand-500 text-black w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Tap <strong className="text-white">"Add"</strong> in the top right</span>
                </li>
              </ol>
            </div>
          ) : deferredPrompt ? (
            // Android/Chrome install button
            <button
              onClick={handleInstallClick}
              className="w-full bg-brand-500 text-black py-3 px-6 rounded-xl font-semibold hover:bg-brand-400 transition-colors flex items-center justify-center gap-2 mb-4"
            >
              <Download className="w-5 h-5" />
              Install App
            </button>
          ) : (
            // Generic instructions for other browsers
            <div className="bg-zinc-800/50 rounded-xl p-4 text-left mb-4">
              <p className="text-white text-sm font-medium mb-3">To add to home screen:</p>
              <p className="text-gray-400 text-sm">
                Open the browser menu (three dots) and select <strong className="text-white">"Add to Home Screen"</strong> or <strong className="text-white">"Install App"</strong>
              </p>
            </div>
          )}

          <button
            onClick={onClose}
            className="text-gray-400 text-sm hover:text-white transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
