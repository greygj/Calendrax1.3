import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black px-4 py-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Logo */}
      <div className="text-center mb-8">
        <img 
          src="https://customer-assets.emergentagent.com/job_f0df9ebf-768b-4fcd-bb61-3b3b5c837dfa/artifacts/92mrru0r_Calendrax%20Logo%20New.png" 
          alt="Calendrax" 
          className="h-16 mx-auto"
        />
      </div>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-white text-3xl font-bold mb-6">Privacy Policy</h1>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Privacy Policy content will be added here.</p>
            <p className="text-gray-500 text-sm mt-2">Please check back later for the full policy.</p>
          </div>
        </div>

        <p className="text-gray-500 text-sm mt-6 text-center">
          Last updated: January 2026
        </p>
      </div>
    </div>
  );
};

export default Privacy;
