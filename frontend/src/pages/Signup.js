import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Lock, Eye, EyeOff, Briefcase, Upload, MapPin, X, Shield, Check, CreditCard, Loader2, Gift } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import InstallPrompt from '../components/InstallPrompt';
import { centurionAPI, stripeAPI, referralAPI } from '../services/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const STORAGE_KEY = 'calendrax_signup_form';

// Card Element styling
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#ffffff',
      '::placeholder': {
        color: '#6b7280',
      },
      backgroundColor: 'transparent',
    },
    invalid: {
      color: '#ef4444',
    },
  },
};

// Inner form component that uses Stripe hooks
const SignupForm = ({ redirectUrl }) => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const stripe = useStripe();
  const elements = useElements();
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [cardError, setCardError] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [skipCard, setSkipCard] = useState(false);
  const fileInputRef = useRef(null);
  
  // Centurion state
  const [centurionData, setCenturionData] = useState({ count: 0, maxCenturions: 100, isAvailable: true, spotsRemaining: 100 });
  const [joinCenturion, setJoinCenturion] = useState(true);

  // Load saved form data from localStorage on mount
  const getSavedFormData = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          fullName: parsed.fullName || '',
          email: parsed.email || '',
          mobile: parsed.mobile || '',
          password: '',
          confirmPassword: '',
          businessName: parsed.businessName || '',
          businessDescription: parsed.businessDescription || '',
          postcode: parsed.postcode || '',
          logo: null,
          logoPreview: parsed.logoPreview || null,
          acceptTerms: parsed.acceptTerms || false,
          acceptPrivacy: parsed.acceptPrivacy || false,
          referralCode: parsed.referralCode || ''
        };
      }
    } catch (e) {
      console.error('Error loading saved form data:', e);
    }
    return {
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
      acceptPrivacy: false,
      referralCode: ''
    };
  };

  const getSavedTab = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.activeTab || 'customer';
      }
    } catch (e) {
      console.error('Error loading saved tab:', e);
    }
    return 'customer';
  };

  const [activeTab, setActiveTab] = useState(getSavedTab);
  const [formData, setFormData] = useState(getSavedFormData);
  const [referralValidation, setReferralValidation] = useState({ valid: null, businessName: '', checking: false });

  // Load Centurion count
  useEffect(() => {
    loadCenturionCount();
  }, []);

  const loadCenturionCount = async () => {
    try {
      const res = await centurionAPI.getCount();
      setCenturionData(res.data);
    } catch (error) {
      console.error('Failed to load centurion count:', error);
    }
  };

  // Validate referral code when it changes
  useEffect(() => {
    const validateReferral = async () => {
      if (!formData.referralCode || formData.referralCode.length < 5) {
        setReferralValidation({ valid: null, businessName: '', checking: false });
        return;
      }
      
      setReferralValidation(prev => ({ ...prev, checking: true }));
      try {
        const res = await referralAPI.validate(formData.referralCode);
        setReferralValidation({
          valid: res.data.valid,
          businessName: res.data.businessName || '',
          checking: false
        });
      } catch (error) {
        setReferralValidation({ valid: false, businessName: '', checking: false });
      }
    };

    const debounce = setTimeout(validateReferral, 500);
    return () => clearTimeout(debounce);
  }, [formData.referralCode]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    const dataToSave = {
      activeTab,
      fullName: formData.fullName,
      email: formData.email,
      mobile: formData.mobile,
      businessName: formData.businessName,
      businessDescription: formData.businessDescription,
      postcode: formData.postcode,
      logoPreview: formData.logoPreview,
      acceptTerms: formData.acceptTerms,
      acceptPrivacy: formData.acceptPrivacy
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [formData, activeTab]);

  const clearSavedFormData = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

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

  const handleCardChange = (event) => {
    setCardError(event.error ? event.error.message : '');
    setCardComplete(event.complete);
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

    // For business owner, validate business name (card is optional)
    if (activeTab === 'business') {
      if (!formData.businessName.trim()) {
        setError('Business name is required');
        return;
      }
      
      // Only validate card if user hasn't chosen to skip
      if (!skipCard && !cardComplete) {
        setError('Please enter valid card details or click "Skip for now"');
        return;
      }
    }

    setLoading(true);

    try {
      let stripePaymentMethodId = null;

      // For business owners, create payment method (unless skipped)
      if (activeTab === 'business' && !skipCard && cardComplete) {
        if (!stripe || !elements) {
          setError('Stripe is not loaded. Please refresh and try again.');
          setLoading(false);
          return;
        }

        // Create setup intent
        const setupIntentRes = await stripeAPI.createSetupIntent();
        const clientSecret = setupIntentRes.data.clientSecret;

        // Confirm card setup
        const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: formData.fullName,
              email: formData.email,
            },
          },
        });

        if (stripeError) {
          setError(stripeError.message);
          setLoading(false);
          return;
        }

        stripePaymentMethodId = setupIntent.payment_method;
      }

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
          logo: formData.logoPreview,
          joinCenturion: joinCenturion && centurionData.isAvailable,
          stripePaymentMethodId: stripePaymentMethodId,
          referralCode: formData.referralCode || null
        })
      };

      // Store redirect URL in localStorage before signup
      if (redirectUrl && activeTab === 'customer') {
        localStorage.setItem('calendrax_redirect', redirectUrl);
      }

      const result = await signup(userData);
      
      if (result.success) {
        clearSavedFormData();
        setShowInstallPrompt(true);
      } else {
        setError(result.error);
        localStorage.removeItem('calendrax_redirect');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    }
    
    setLoading(false);
  };

  const handleInstallPromptClose = () => {
    setShowInstallPrompt(false);
  };

  return (
    <div className="min-h-screen bg-appbg flex flex-col px-4 py-6">
      {/* Install Prompt Modal */}
      {showInstallPrompt && (
        <InstallPrompt onClose={handleInstallPromptClose} />
      )}

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
          src="https://customer-assets.emergentagent.com/job_3f85dde5-1e91-4759-bd85-f441b993a550/artifacts/s4024gg5_Calendrax1.3%20Logo%20Opaque%20%282%29.png" 
          alt="Calendrax" 
          className="h-28 mx-auto"
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

      {/* Centurion Banner - Business Owners Only */}
      {activeTab === 'business' && centurionData.isAvailable && (
        <div className="w-full max-w-md mx-auto mb-6">
          <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 border border-amber-500/40 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_f0d49bd6-4ba1-447c-a671-a425c4ff7557/artifacts/cv1m7trg_Calendrax%20Centurion%20Logo.jpeg"
                alt="Calendrax Centurions"
                className="w-16 h-16 object-contain rounded"
              />
              <div className="flex-1">
                <h4 className="text-amber-400 font-bold">Calendrax Centurions</h4>
                <p className="text-gray-400 text-xs">Founding Members Club</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-white">
                  <span className="text-amber-400">{centurionData.count}</span>
                  <span className="text-gray-500 mx-1">/</span>
                  <span>{centurionData.maxCenturions}</span>
                </div>
                <p className="text-gray-500 text-xs">{centurionData.spotsRemaining} spots left</p>
              </div>
            </div>
            
            {/* Benefits */}
            <ul className="space-y-1.5 text-xs mb-3">
              <li className="flex items-start gap-2 text-gray-300">
                <Check className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                <span>Lifetime <span className="text-amber-400">£10/month</span> (vs £16) + <span className="text-amber-400">£5</span> per extra staff</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <Check className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                <span>Referral credits - <span className="text-amber-400">2 FREE months</span> per referral</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <Check className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                <span>Influence features • FREE Migration • Recognition</span>
              </li>
            </ul>
            
            {/* Checkbox */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={joinCenturion}
                  onChange={(e) => setJoinCenturion(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 border-2 border-amber-500 rounded bg-transparent peer-checked:bg-amber-500 transition-all flex items-center justify-center">
                  {joinCenturion && (
                    <Check className="w-3 h-3 text-black" />
                  )}
                </div>
              </div>
              <span className="text-amber-400 font-medium text-sm">Yes, I want to become a Calendrax Centurion!</span>
            </label>
          </div>
        </div>
      )}

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
          <>
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

          {/* Referral Code */}
          <div>
            <label className="text-white text-sm mb-2 block">
              Referral Code <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <div className="relative">
              <Gift className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                name="referralCode"
                value={formData.referralCode}
                onChange={handleChange}
                placeholder="Enter referral code (e.g., CC001)"
                className={`w-full bg-cardBg border rounded-lg py-4 pl-12 pr-12 text-white placeholder-gray-500 focus:outline-none transition-colors uppercase ${
                  referralValidation.valid === true ? 'border-green-500' : 
                  referralValidation.valid === false ? 'border-red-500' : 
                  'border-zinc-800 focus:border-brand-500'
                }`}
              />
              {referralValidation.checking && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 animate-spin" />
              )}
              {!referralValidation.checking && referralValidation.valid === true && (
                <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
              )}
              {!referralValidation.checking && referralValidation.valid === false && (
                <X className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
              )}
            </div>
            {referralValidation.valid === true && referralValidation.businessName && (
              <p className="text-green-500 text-xs mt-1">Referred by: {referralValidation.businessName}</p>
            )}
            {referralValidation.valid === false && formData.referralCode.length >= 5 && (
              <p className="text-red-500 text-xs mt-1">Invalid referral code</p>
            )}
          </div>
          </>
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
          <label className="text-white text-sm mb-2 block">Mobile Number <span className="text-gray-500 text-xs">(Optional)</span></label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="tel"
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              placeholder="Enter your mobile number"
              className="w-full bg-cardBg border border-zinc-800 rounded-lg py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
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

        {/* Card Details - Business Owner Only */}
        {activeTab === 'business' && (
          <div>
            <label className="text-white text-sm mb-2 block">
              Card Details <span className="text-red-500">*</span>
            </label>
            <div className="bg-cardBg border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-5 h-5 text-gray-500" />
                <span className="text-gray-400 text-sm">Secure payment via Stripe</span>
              </div>
              <CardElement 
                options={cardElementOptions}
                onChange={handleCardChange}
                className="p-3 border border-zinc-700 rounded-lg bg-zinc-900"
              />
              {cardError && (
                <p className="text-red-500 text-xs mt-2">{cardError}</p>
              )}
              <p className="text-gray-500 text-xs mt-2">
                Your card will not be charged during the 30-day free trial. You can cancel anytime before the trial ends.
              </p>
            </div>
          </div>
        )}

        {/* Subscription Fee Notice - Business Owner Only */}
        {activeTab === 'business' && (
          <div className="bg-brand-500/10 border border-brand-500/30 rounded-lg p-4">
            <h4 className="text-brand-400 font-semibold mb-2">Subscription Information</h4>
            <p className="text-gray-300 text-sm mb-2">
              As a business owner, you'll have access to a <span className="text-brand-400 font-medium">30-day free trial</span>. After the trial, subscription fees apply:
            </p>
            
            {joinCenturion && centurionData.isAvailable ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-3">
                <p className="text-amber-400 font-medium text-sm mb-1">Centurion Pricing (Lifetime)</p>
                <ul className="text-gray-400 text-sm space-y-1 ml-4 list-disc">
                  <li>1 Staff Member: <span className="text-amber-400">£10/month</span></li>
                  <li>Each additional staff: <span className="text-amber-400">+£5/month</span></li>
                </ul>
              </div>
            ) : (
              <ul className="text-gray-400 text-sm space-y-1 ml-4 list-disc mb-3">
                <li>1 Staff Member: <span className="text-white">£16/month</span></li>
                <li>Each additional staff: <span className="text-white">+£8/month</span></li>
              </ul>
            )}
            
            <p className="text-gray-400 text-sm mt-3">
              A 5% platform fee applies to customer deposits paid through the platform. Please add your bank account details in your <span className="text-white">Profile</span> to automatically receive the customer Deposits / Payments.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              In your Profile you have the option of setting customer Deposit / Payment of:
            </p>
            <p className="text-white text-sm mt-1">
              No Deposit  •  20% Payment  •  50% Payment  •  100% Payment
            </p>
            
            {/* Trial Info */}
            <div className="mt-4 pt-3 border-t border-brand-500/20">
              <p className="text-brand-400 font-medium text-sm mb-2">30-Day Free Trial</p>
              <ul className="text-gray-400 text-sm space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">!</span>
                  <span>Your card will be charged automatically after the trial ends unless you cancel.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5">→</span>
                  <span>To opt out, cancel your subscription in your <span className="text-white">Profile</span> before the 30 day trial ends.</span>
                </li>
              </ul>
            </div>
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
          disabled={loading || (activeTab === 'business' && !stripe)}
          className="w-full bg-brand-500 text-black font-semibold py-4 rounded-lg mt-6 hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
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

// Main Signup component that wraps with Stripe Elements
const Signup = () => {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  return (
    <Elements stripe={stripePromise}>
      <SignupForm redirectUrl={redirectUrl} />
    </Elements>
  );
};

export default Signup;
