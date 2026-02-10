import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Building2, MapPin, ChevronRight, Calendar, Bell, X, Clock, Home, User, History, Save, Smartphone, Lock, Mail, MessageCircle, Eye, EyeOff, Star } from 'lucide-react';
import { businessAPI, appointmentAPI, notificationAPI, authAPI, reviewAPI } from '../services/api';
import { formatDate } from '../utils/dateFormat';
import InstallPrompt from '../components/InstallPrompt';

const CustomerDashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    mobile: ''
  });
  
  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  
  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailReminders: true,
    whatsappReminders: true
  });
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (user) {
      setProfileForm({
        fullName: user.fullName || '',
        email: user.email || '',
        mobile: user.mobile || ''
      });
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [businessesRes, bookingsRes, notificationsRes] = await Promise.all([
        businessAPI.getAll().catch(() => ({ data: [] })),
        appointmentAPI.getMine().catch(() => ({ data: [] })),
        notificationAPI.getAll().catch(() => ({ data: [] }))
      ]);
      
      // Sort businesses alphabetically
      const sortedBusinesses = (businessesRes.data || []).sort((a, b) => 
        a.businessName.localeCompare(b.businessName)
      );
      
      setBusinesses(sortedBusinesses);
      setMyBookings(bookingsRes.data || []);
      setNotifications(notificationsRes.data || []);
      
      // Load notification preferences
      try {
        const prefsRes = await authAPI.getNotificationPreferences();
        setNotificationPrefs(prefsRes.data);
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const unreadNotifications = notifications.filter(n => !n.read);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleBusinessClick = (businessId) => {
    navigate(`/business/${businessId}`);
  };

  const handleCancelBooking = async (appointmentId) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      try {
        await appointmentAPI.cancel(appointmentId);
        loadData();
      } catch (error) {
        console.error('Failed to cancel booking:', error);
      }
    }
  };
  
  // Change password handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    
    setPasswordSaving(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (error) {
      setPasswordError(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };
  
  // Toggle notification preference
  const handleToggleNotificationPref = async (key) => {
    const newValue = !notificationPrefs[key];
    setNotificationPrefs(prev => ({ ...prev, [key]: newValue }));
    
    try {
      await authAPI.updateNotificationPreferences({ [key]: newValue });
    } catch (error) {
      // Revert on error
      setNotificationPrefs(prev => ({ ...prev, [key]: !newValue }));
      console.error('Failed to update notification preference:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      await notificationAPI.markRead(notification.id);
      setShowNotifications(false);
      if (notification.type === 'booking_confirmed' || notification.type === 'booking_declined') {
        setActiveView('bookings');
      }
      loadData();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      loadData();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess(false);
    
    // Validate required fields
    if (!profileForm.fullName.trim()) {
      setProfileError('Name is required');
      return;
    }
    if (!profileForm.email.trim()) {
      setProfileError('Email is required');
      return;
    }
    if (!profileForm.mobile.trim()) {
      setProfileError('Phone number is required');
      return;
    }
    
    setProfileSaving(true);
    try {
      const response = await authAPI.updateProfile(profileForm);
      if (response.data.success) {
        // Update local user state
        if (updateUser) {
          updateUser({ ...user, ...response.data.user });
        }
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setProfileError(error.response?.data?.detail || 'Failed to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Helper to check if booking date has passed
  const isDatePassed = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(dateStr);
    return bookingDate < today;
  };

  // Categorize bookings - upcoming vs history
  const upcomingBookings = myBookings.filter(b => 
    (b.status === 'pending' || b.status === 'confirmed') && !isDatePassed(b.date)
  );
  const pastBookings = myBookings.filter(b => 
    b.status === 'cancelled' || 
    b.status === 'declined' || 
    b.status === 'completed' ||
    ((b.status === 'pending' || b.status === 'confirmed') && isDatePassed(b.date))
  );

  return (
    <div className="min-h-screen bg-appbg">
      {/* Install Prompt Modal */}
      {showInstallPrompt && (
        <InstallPrompt onClose={() => setShowInstallPrompt(false)} />
      )}

      {/* Header */}
      <header className="bg-cardBg border-b border-zinc-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Logo - Larger */}
          <img 
            src="https://customer-assets.emergentagent.com/job_appointly-24/artifacts/tmj5ltm0_Calendrax%20Opaque.png" 
            alt="Calendrax" 
            className="h-16 cursor-pointer"
            onClick={() => setActiveView('dashboard')}
          />

          <div className="flex items-center gap-3">
            {/* User Info */}
            <div className="text-right hidden sm:block">
              <p className="text-white font-medium">{user?.fullName}</p>
              <p className="text-gray-500 text-sm">Customer</p>
            </div>
            
            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-cardBg border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-white font-semibold">Notifications</h3>
                    {unreadNotifications.length > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-brand-400 text-sm hover:text-brand-300"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 10).map(notif => (
                        <button
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`w-full text-left p-3 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors ${
                            !notif.read ? 'bg-brand-500/5' : ''
                          }`}
                        >
                          <p className={`text-sm ${!notif.read ? 'text-white font-medium' : 'text-gray-400'}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{notif.message}</p>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        No notifications
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Back to Dashboard button - show on sub-views */}
            {activeView !== 'dashboard' && (
              <button
                onClick={() => setActiveView('dashboard')}
                className="p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                title="Back to Dashboard"
              >
                <Home className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          </div>
        ) : (
          <>
            {/* Dashboard View */}
            {activeView === 'dashboard' && (
              <div className="space-y-6">
                {/* Welcome Section */}
                <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                  <h1 className="text-white text-2xl font-bold mb-2">
                    Welcome back, {user?.fullName?.split(' ')[0]}!
                  </h1>
                  <p className="text-gray-400">What would you like to do today?</p>
                </div>

                {/* Upcoming Bookings Preview */}
                {upcomingBookings.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-white text-lg font-semibold">Upcoming Bookings</h2>
                      <span className="bg-brand-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                        {upcomingBookings.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {upcomingBookings.slice(0, 3).map(booking => (
                        <div key={booking.id} className="bg-cardBg border border-zinc-800 rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-white font-medium">{booking.serviceName}</h4>
                              <p className="text-brand-400 text-sm">{booking.businessName}</p>
                              {booking.staffName && (
                                <p className="text-gray-500 text-sm">with {booking.staffName}</p>
                              )}
                              <p className="text-gray-500 text-sm mt-2 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(booking.date)} at {booking.time}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              booking.status === 'confirmed'
                                ? 'bg-brand-500/20 text-brand-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {booking.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Navigation Buttons - Full Width for Mobile */}
                <div className="space-y-3">
                  <button
                    onClick={() => setActiveView('businesses')}
                    className="w-full bg-cardBg border border-zinc-800 text-white p-4 rounded-xl font-medium hover:bg-zinc-800 hover:border-brand-500/50 transition-all flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-brand-400" />
                    </div>
                    <span className="flex-1 text-left">Browse Businesses</span>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </button>

                  <button
                    onClick={() => setActiveView('bookings')}
                    className="w-full bg-cardBg border border-zinc-800 text-white p-4 rounded-xl font-medium hover:bg-zinc-800 hover:border-brand-500/50 transition-all flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-brand-400" />
                    </div>
                    <span className="flex-1 text-left">My Bookings</span>
                    {upcomingBookings.length > 0 && (
                      <span className="bg-brand-500 text-black text-xs font-bold px-2 py-1 rounded-full mr-2">
                        {upcomingBookings.length}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </button>

                  <button
                    onClick={() => setActiveView('history')}
                    className="w-full bg-cardBg border border-zinc-800 text-white p-4 rounded-xl font-medium hover:bg-zinc-800 hover:border-brand-500/50 transition-all flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                      <History className="w-5 h-5 text-brand-400" />
                    </div>
                    <span className="flex-1 text-left">Booking History</span>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </button>

                  <button
                    onClick={() => setActiveView('profile')}
                    className="w-full bg-cardBg border border-zinc-800 text-white p-4 rounded-xl font-medium hover:bg-zinc-800 hover:border-brand-500/50 transition-all flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-brand-400" />
                    </div>
                    <span className="flex-1 text-left">Profile</span>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="w-full bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl font-medium hover:bg-red-500/20 hover:border-red-500/50 transition-all flex items-center justify-center gap-3 mt-6"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            )}

            {/* Browse Businesses View */}
            {activeView === 'businesses' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-white text-xl font-semibold">Available Businesses</h2>
                  <p className="text-gray-500">{businesses.length} businesses</p>
                </div>

                {businesses.length > 0 ? (
                  <div className="space-y-4">
                    {businesses.map(business => (
                      <button
                        key={business.id}
                        onClick={() => handleBusinessClick(business.id)}
                        className="w-full bg-cardBg border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-all group text-left"
                      >
                        <div className="flex items-center gap-4">
                          {/* Business Logo */}
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                            {business.logo ? (
                              <img
                                src={business.logo}
                                alt={`${business.businessName} logo`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Building2 className="w-8 h-8 text-gray-500" />
                              </div>
                            )}
                          </div>

                          {/* Business Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white text-lg font-semibold group-hover:text-brand-400 transition-colors">
                              {business.businessName}
                            </h3>
                            <p className="text-gray-400 text-sm mt-1 line-clamp-1">{business.description}</p>
                            <div className="flex items-center gap-1 mt-2 text-gray-500 text-sm">
                              <MapPin className="w-4 h-4" />
                              {business.postcode}
                            </div>
                          </div>

                          {/* Arrow */}
                          <ChevronRight className="w-6 h-6 text-gray-500 group-hover:text-brand-400 transition-colors flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-12 text-center">
                    <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500">No businesses available at the moment</p>
                  </div>
                )}
              </>
            )}

            {/* My Bookings View (Upcoming) */}
            {activeView === 'bookings' && (
              <div>
                <h2 className="text-white text-xl font-semibold mb-6">My Bookings</h2>

                {upcomingBookings.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingBookings.map(booking => (
                      <div key={booking.id} className="bg-cardBg border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{booking.serviceName}</h4>
                            <p className="text-brand-400">{booking.businessName}</p>
                            {booking.staffName && (
                              <p className="text-gray-500 text-sm">with {booking.staffName}</p>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-gray-500 text-sm">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(booking.date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {booking.time}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              booking.status === 'confirmed'
                                ? 'bg-brand-500/20 text-brand-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {booking.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                            </span>
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              className="text-red-400 text-sm hover:text-red-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-12 text-center">
                    <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No upcoming bookings</p>
                    <button
                      onClick={() => setActiveView('businesses')}
                      className="bg-brand-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-brand-400 transition-colors"
                    >
                      Browse Businesses
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Booking History View */}
            {activeView === 'history' && (
              <div>
                <h2 className="text-white text-xl font-semibold mb-6">Booking History</h2>

                {pastBookings.length > 0 ? (
                  <div className="space-y-4">
                    {pastBookings.map(booking => (
                      <div key={booking.id} className="bg-cardBg/50 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-white font-medium">{booking.serviceName}</h4>
                            <p className="text-gray-400">{booking.businessName}</p>
                            {booking.staffName && (
                              <p className="text-gray-500 text-sm">with {booking.staffName}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-gray-500 text-sm">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(booking.date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {booking.time}
                              </span>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'completed' || (booking.status === 'confirmed' && isDatePassed(booking.date))
                              ? 'bg-brand-500/20 text-brand-400'
                              : booking.status === 'cancelled'
                              ? 'bg-gray-500/20 text-gray-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {(booking.status === 'confirmed' && isDatePassed(booking.date)) 
                              ? 'Completed' 
                              : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-12 text-center">
                    <History className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500">No booking history yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Profile View */}
            {activeView === 'profile' && (
              <div>
                <h2 className="text-white text-xl font-semibold mb-6">My Profile</h2>

                <form onSubmit={handleProfileSave} className="bg-cardBg border border-zinc-800 rounded-xl p-6 space-y-6">
                  {profileError && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
                      {profileError}
                    </div>
                  )}
                  
                  {profileSuccess && (
                    <div className="bg-brand-500/10 border border-brand-500/50 text-brand-400 px-4 py-3 rounded-lg">
                      Profile updated successfully!
                    </div>
                  )}

                  <div>
                    <label className="text-gray-400 text-sm block mb-2">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={profileForm.fullName}
                      onChange={(e) => setProfileForm({...profileForm, fullName: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-2">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                      placeholder="Enter your email"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-2">
                      Phone Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      value={profileForm.mobile}
                      onChange={(e) => setProfileForm({...profileForm, mobile: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                      placeholder="Enter your phone number"
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="flex items-center gap-2 bg-brand-500 text-black px-6 py-3 rounded-lg font-medium hover:bg-brand-400 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {profileSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>

                {/* Change Password */}
                <div className="bg-cardBg border border-zinc-800 rounded-xl p-6 mt-6">
                  <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                    <Lock className="w-5 h-5 text-brand-400" />
                    Change Password
                  </h3>
                  
                  {!showPasswordForm ? (
                    <button
                      onClick={() => setShowPasswordForm(true)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white py-3 px-4 rounded-lg font-medium hover:bg-zinc-700 hover:border-brand-500/50 transition-all"
                    >
                      Change Password
                    </button>
                  ) : (
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      {passwordError && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                          {passwordError}
                        </div>
                      )}
                      {passwordSuccess && (
                        <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
                          Password changed successfully!
                        </div>
                      )}
                      
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500 pr-12"
                          placeholder="Current Password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500 pr-12"
                          placeholder="New Password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                        placeholder="Confirm New Password"
                        required
                      />
                      
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordForm(false);
                            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                            setPasswordError('');
                          }}
                          className="flex-1 bg-zinc-800 text-white py-3 rounded-lg font-medium hover:bg-zinc-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={passwordSaving}
                          className="flex-1 bg-brand-500 text-black py-3 rounded-lg font-medium hover:bg-brand-400 transition-colors disabled:opacity-50"
                        >
                          {passwordSaving ? 'Saving...' : 'Update Password'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Notification Preferences */}
                <div className="bg-cardBg border border-zinc-800 rounded-xl p-6 mt-6">
                  <h3 className="text-white font-medium flex items-center gap-2 mb-4">
                    <Bell className="w-5 h-5 text-brand-400" />
                    Notification Preferences
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Email Reminders Toggle */}
                    <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-white font-medium">Email Reminders</p>
                          <p className="text-gray-500 text-sm">Receive booking reminders via email</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleNotificationPref('emailReminders')}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          notificationPrefs.emailReminders ? 'bg-brand-500' : 'bg-zinc-600'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          notificationPrefs.emailReminders ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                    </div>
                    
                    {/* WhatsApp Reminders Toggle */}
                    <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <MessageCircle className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-white font-medium">WhatsApp Reminders</p>
                          <p className="text-gray-500 text-sm">Receive booking reminders via WhatsApp</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleNotificationPref('whatsappReminders')}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          notificationPrefs.whatsappReminders ? 'bg-brand-500' : 'bg-zinc-600'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          notificationPrefs.whatsappReminders ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Add to Home Screen */}
                <div className="bg-cardBg border border-zinc-800 rounded-xl p-6 mt-6">
                  <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                    <Smartphone className="w-5 h-5 text-brand-400" />
                    Add to Home Screen
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Get quick access to Calendrax right from your phone's home screen.
                  </p>
                  <button
                    onClick={() => setShowInstallPrompt(true)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white py-3 px-4 rounded-lg font-medium hover:bg-zinc-700 hover:border-brand-500/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Smartphone className="w-5 h-5" />
                    Add Calendrax to Home Screen
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CustomerDashboard;
