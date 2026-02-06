import React, { useState, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Lock, Eye, EyeOff, Briefcase, Upload, MapPin, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const { signup } = useAuth();
  const [activeTab, setActiveTab] = useState('customer');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    businessDescription: '',
    postcode: '',
    logo: null,
    logoPreview: null,
    acceptTerms: false,
    acceptPrivacy: false
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo file must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({
          ...formData,
          logo: file,
          logoPreview: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setFormData({
      ...formData,
      logo: null,
      logoPreview: null
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.acceptTerms || !formData.acceptPrivacy) {
      setError('You must accept the Terms and Conditions and Privacy Policy to continue');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // For business owner, validate business name
    if (activeTab === 'business') {
      if (!formData.businessName.trim()) {
        setError('Business name is required');
        return;
      }
    }

    setLoading(true);

    const userData = {
      fullName: formData.fullName,
      email: formData.email,
      mobile: formData.mobile,
      password: formData.password,
      role: activeTab === 'customer' ? 'customer' : 'business_owner',
      ...(activeTab === 'business' && {
        businessName: formData.businessName,
        businessDescription: formData.businessDescription,
        postcode: formData.postcode,
        logo: formData.logoPreview // Store base64 for mock, in real app would upload to server
      })
    };

    // Store redirect URL in localStorage before signup
    if (redirectUrl && activeTab === 'customer') {
      localStorage.setItem('calendrax_redirect', redirectUrl);
    }

    const result = await signup(userData);
    
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
    <div className="min-h-screen bg-appbg flex flex-col px-4 py-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="w-10 h-10 rounded-full bg-cardBg flex items-center justify-center text-white hover:bg-zinc-800 transition-colors mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Logo */}
      <div className="text-center mb-6">
        <img 
          src="https://customer-assets.emergentagent.com/job_appointly-24/artifacts/ndfsqqas_1770416747206.png" 
          alt="Calendrax" 
          className="h-20 mx-auto"
        />
      </div>

      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-white text-3xl font-semibold mb-2">Create Account</h2>
        <p className="text-gray-500">Join Calendrax</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-transparent border border-zinc-800 rounded-lg mb-6 max-w-md mx-auto w-full overflow-hidden">
        <button
          onClick={() => setActiveTab('customer')}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 font-medium transition-all ${
            activeTab === 'customer'
              ? 'bg-brand-500 text-black'
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
        >
          <User className="w-5 h-5" />
          Customer
        </button>
        <button
          onClick={() => setActiveTab('business')}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 font-medium transition-all ${
            activeTab === 'business'
              ? 'bg-brand-500 text-black'
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Briefcase className="w-5 h-5" />
          Business Owner
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Business Name - Business Owner Only */}
        {activeTab === 'business' && (
          <div>
            <label className="text-white text-sm mb-2 block">Business Name <span className="text-red-500">*</span></label>
            <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                placeholder="Enter your business name"
                className="w-full bg-cardBg border border-zinc-800 rounded-lg py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
                required={activeTab === 'business'}
              />
            </div>
          </div>
        )}

        {/* Logo Upload - Business Owner Only */}
        {activeTab === 'business' && (
          <div>
            <label className="text-white text-sm mb-2 block">Business Logo</label>
            <div className="flex items-center gap-4">
              {formData.logoPreview ? (
                <div className="relative">
                  <img
                    src={formData.logoPreview}
                    alt="Logo preview"
                    className="w-20 h-20 rounded-lg object-cover border border-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors"
                >
                  <Upload className="w-6 h-6 text-gray-500" />
                  <span className="text-gray-500 text-xs mt-1">Upload</span>
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
                >
                  {formData.logoPreview ? 'Change Logo' : 'Choose File'}
                </button>
                <p className="text-gray-500 text-xs mt-2">PNG, JPG up to 5MB</p>
              </div>
            </div>
          </div>
        )}

        {/* Business Description - Business Owner Only */}
        {activeTab === 'business' && (
          <div>
            <label className="text-white text-sm mb-2 block">What does your Business do? <span className="text-red-500">*</span></label>
            <textarea
              name="businessDescription"
              value={formData.businessDescription}
              onChange={handleChange}
              placeholder="Describe what your business offers..."
              rows={3}
              className="w-full bg-cardBg border border-zinc-800 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors resize-none"
              required={activeTab === 'business'}
            />
          </div>
        )}

        {/* Postcode - Business Owner Only */}
        {activeTab === 'business' && (
          <div>
            <label className="text-white text-sm mb-2 block">Business Postcode <span className="text-red-500">*</span></label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                name="postcode"
                value={formData.postcode}
                onChange={handleChange}
                placeholder="Enter your business postcode"
                className="w-full bg-cardBg border border-zinc-800 rounded-lg py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
                required={activeTab === 'business'}
              />
            </div>
          </div>
        )}

        {/* Full Name */}
        <div>
          <label className="text-white text-sm mb-2 block">Full Name <span className="text-red-500">*</span></label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              className="w-full bg-cardBg border border-zinc-800 rounded-lg py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
              required
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="text-white text-sm mb-2 block">Email Address <span className="text-red-500">*</span></label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className="w-full bg-cardBg border border-zinc-800 rounded-lg py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
              required
            />
          </div>
        </div>

        {/* Mobile */}
        <div>
          <label className="text-white text-sm mb-2 block">Mobile Number <span className="text-red-500">*</span></label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="tel"
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              placeholder="Enter your mobile number"
              className="w-full bg-cardBg border border-zinc-800 rounded-lg py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
              required
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="text-white text-sm mb-2 block">Password <span className="text-red-500">*</span></label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
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

        {/* Confirm Password */}
        <div>
          <label className="text-white text-sm mb-2 block">Confirm Password <span className="text-red-500">*</span></label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              className="w-full bg-cardBg border border-zinc-800 rounded-lg py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
              required
            />
          </div>
        </div>

        {/* Subscription Fee Notice - Business Owner Only */}
        {activeTab === 'business' && (
          <div className="bg-brand-500/10 border border-brand-500/30 rounded-lg p-4">
            <h4 className="text-brand-400 font-semibold mb-2">Subscription Information</h4>
            <p className="text-gray-300 text-sm mb-2">
              As a business owner, you'll have access to a <span className="text-brand-400 font-medium">30-day free trial</span>. After the trial, subscription fees apply:
            </p>
            <ul className="text-gray-400 text-sm space-y-1 ml-4 list-disc">
              <li>1 Staff Member: <span className="text-white">£10/month</span></li>
              <li>Each additional staff: <span className="text-white">+£5/month</span></li>
              <li>Example: 3 staff = £20/month</li>
            </ul>
            <p className="text-gray-400 text-xs mt-2">
              A 5% platform fee applies to customer deposits to cover payment processing.
            </p>
          </div>
        )}

        {/* Terms and Conditions Checkbox */}
        <div className="space-y-3 pt-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-1">
              <input
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-5 h-5 border-2 border-zinc-600 rounded bg-cardBg peer-checked:bg-brand-500 peer-checked:border-brand-500 transition-all flex items-center justify-center">
                {formData.acceptTerms && (
                  <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-gray-400 text-sm group-hover:text-gray-300 transition-colors">
              I have read and agree to the{' '}
              <a href="/terms" target="_blank" className="text-brand-400 hover:underline">Terms and Conditions</a>
              <span className="text-red-500 ml-1">*</span>
            </span>
          </label>

          {/* Privacy Policy Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-1">
              <input
                type="checkbox"
                checked={formData.acceptPrivacy}
                onChange={(e) => setFormData({ ...formData, acceptPrivacy: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-5 h-5 border-2 border-zinc-600 rounded bg-cardBg peer-checked:bg-brand-500 peer-checked:border-brand-500 transition-all flex items-center justify-center">
                {formData.acceptPrivacy && (
                  <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-gray-400 text-sm group-hover:text-gray-300 transition-colors">
              I have read and agree to the{' '}
              <a href="/privacy" target="_blank" className="text-brand-400 hover:underline">Privacy Policy</a>
              <span className="text-red-500 ml-1">*</span>
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 text-black font-semibold py-4 rounded-lg mt-6 hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      {/* Sign In Link */}
      <p className="text-gray-500 mt-8 text-center">
        Already have an account?{' '}
        <Link to="/" className="text-brand-400 font-semibold hover:underline">
          Sign In
        </Link>
      </p>
    </div>
  );
};

export default Signup;
