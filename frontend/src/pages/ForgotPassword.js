import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { authAPI } from '../api/authAPI';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-appbg flex flex-col items-center justify-center px-4">
        {/* Back to Login Button */}
        <button
          onClick={() => navigate('/login')}
          className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Login
        </button>

        {/* Logo */}
        <div className="mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_3f85dde5-1e91-4759-bd85-f441b993a550/artifacts/s4024gg5_Calendrax1.3%20Logo%20Opaque%20%282%29.png" 
            alt="Calendrax" 
            className="h-32 mx-auto"
          />
        </div>

        {/* Success Message */}
        <div className="w-full max-w-md bg-cardBg rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-white text-2xl font-semibold mb-4">Check Your Email</h2>
          <p className="text-gray-400 mb-6">
            If an account exists with <span className="text-white">{email}</span>, you will receive a password reset link shortly.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            The link will expire in 1 hour. Don't forget to check your spam folder.
          </p>
          <Link
            to="/login"
            className="inline-block bg-brand-500 text-black font-semibold py-3 px-8 rounded-lg hover:bg-brand-400 transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-appbg flex flex-col items-center justify-center px-4">
      {/* Back to Login Button */}
      <button
        onClick={() => navigate('/login')}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Login
      </button>

      {/* Logo */}
      <div className="mb-8">
        <img 
          src="https://customer-assets.emergentagent.com/job_3f85dde5-1e91-4759-bd85-f441b993a550/artifacts/s4024gg5_Calendrax1.3%20Logo%20Opaque%20%282%29.png" 
          alt="Calendrax" 
          className="h-32 mx-auto"
        />
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-white text-3xl font-semibold mb-2">Forgot Password?</h2>
        <p className="text-gray-500">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Email Field */}
        <div>
          <label className="text-white text-sm mb-2 block">Email Address</label>
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 text-black font-semibold py-4 rounded-lg mt-6 hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      {/* Back to Login Link */}
      <p className="text-gray-500 mt-8">
        Remember your password?{' '}
        <Link to="/login" className="text-brand-400 font-semibold hover:underline">
          Sign In
        </Link>
      </p>
    </div>
  );
};

export default ForgotPassword;
