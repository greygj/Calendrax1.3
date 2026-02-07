import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Store redirect URL in localStorage (persists better than sessionStorage during re-renders)
    if (redirectUrl) {
      localStorage.setItem('calendrax_redirect', redirectUrl);
    }

    const result = await login(email, password);
    
    if (result.success) {
      // The PublicRoute will handle the redirect using localStorage
      // No need to navigate here - React will re-render and PublicRoute will redirect
    } else {
      setError(result.error);
      localStorage.removeItem('calendrax_redirect');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-appbg flex flex-col items-center justify-center px-4">
      {/* Back to Browse Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Browse Businesses
      </button>

      {/* Logo */}
      <div className="mb-8">
        <img 
          src="https://customer-assets.emergentagent.com/job_appointly-24/artifacts/tmj5ltm0_Calendrax%20Opaque.png" 
          alt="Calendrax" 
          className="h-48 mx-auto"
          style={{ filter: 'brightness(0.35) contrast(1.5) sepia(0.3)' }}
        />
      </div>

      {/* Welcome Text */}
      <div className="text-center mb-8">
        <h2 className="text-white text-3xl font-semibold mb-2">Welcome Back</h2>
        <p className="text-gray-500">
          {redirectUrl ? 'Sign in to view this business' : 'Sign in to continue'}
        </p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Email Field */}
        <div>
          <label className="text-white text-sm mb-2 block">Email</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full bg-cardBg border border-zinc-800 rounded-lg py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
              required
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label className="text-white text-sm mb-2 block">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-cardBg border border-zinc-800 rounded-lg py-4 pl-12 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 text-black font-semibold py-4 rounded-lg mt-6 hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Sign Up Link */}
      <p className="text-gray-500 mt-8">
        Don't have an account?{' '}
        <Link 
          to={redirectUrl ? `/signup?redirect=${encodeURIComponent(redirectUrl)}` : '/signup'} 
          className="text-brand-400 font-semibold hover:underline"
        >
          Sign Up
        </Link>
      </p>
    </div>
  );
};

export default Login;
