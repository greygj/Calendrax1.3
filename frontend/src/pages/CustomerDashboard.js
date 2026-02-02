import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Building2, MapPin, ChevronRight, Calendar, Bell, X, Clock, Home, User, History, Save } from 'lucide-react';
import { businessAPI, appointmentAPI, notificationAPI, authAPI } from '../services/api';

const CustomerDashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
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
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Logo - Larger */}
          <img 
            src="https://customer-assets.emergentagent.com/job_f0df9ebf-768b-4fcd-bb61-3b3b5c837dfa/artifacts/92mrru0r_Calendrax%20Logo%20New.png" 
            alt="Calendrax" 
            className="h-20 cursor-pointer"
            onClick={() => setActiveView('dashboard')}
          />

          <div className="flex items-center gap-4">
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
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-lime-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-white font-semibold">Notifications</h3>
                    {unreadNotifications.length > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-lime-400 text-sm hover:text-lime-300"
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
                            !notif.read ? 'bg-lime-500/5' : ''
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

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-zinc-900/50 border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Home },
              { id: 'businesses', label: 'Browse Businesses', icon: Building2 },
              { id: 'bookings', label: 'My Bookings', icon: Calendar, badge: upcomingBookings.length },
              { id: 'history', label: 'Booking History', icon: History },
              { id: 'profile', label: 'Profile', icon: User }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors whitespace-nowrap ${
                  activeView === tab.id
                    ? 'text-lime-400 border-b-2 border-lime-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="w-5 h-5 bg-lime-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500"></div>
          </div>
        ) : (
          <>
            {/* Dashboard View */}
            {activeView === 'dashboard' && (
              <div className="space-y-8">
                {/* Welcome Section */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h1 className="text-white text-2xl font-bold mb-2">
                    Welcome back, {user?.fullName?.split(' ')[0]}!
                  </h1>
                  <p className="text-gray-400">What would you like to do today?</p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-gray-500 text-sm">Upcoming Bookings</p>
                    <p className="text-lime-400 text-3xl font-bold mt-1">{upcomingBookings.length}</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-gray-500 text-sm">Past Bookings</p>
                    <p className="text-white text-3xl font-bold mt-1">{pastBookings.length}</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-gray-500 text-sm">Available Businesses</p>
                    <p className="text-white text-3xl font-bold mt-1">{businesses.length}</p>
                  </div>
                </div>

                {/* Upcoming Bookings Preview */}
                {upcomingBookings.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-white text-lg font-semibold">Upcoming Bookings</h2>
                      <button
                        onClick={() => setActiveView('bookings')}
                        className="text-lime-400 text-sm hover:text-lime-300 flex items-center gap-1"
                      >
                        View all <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {upcomingBookings.slice(0, 2).map(booking => (
                        <div key={booking.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-white font-medium">{booking.serviceName}</h4>
                              <p className="text-lime-400 text-sm">{booking.businessName}</p>
                              {booking.staffName && (
                                <p className="text-gray-500 text-sm">with {booking.staffName}</p>
                              )}
                              <p className="text-gray-500 text-sm mt-2 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {booking.date} at {booking.time}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              booking.status === 'confirmed'
                                ? 'bg-lime-500/20 text-lime-400'
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

                {/* Quick Actions */}
                <div>
                  <h2 className="text-white text-lg font-semibold mb-4">Quick Actions</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setActiveView('businesses')}
                      className="bg-lime-500 text-black p-4 rounded-xl font-medium hover:bg-lime-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <Building2 className="w-5 h-5" />
                      Browse Businesses
                    </button>
                    <button
                      onClick={() => setActiveView('bookings')}
                      className="bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-5 h-5" />
                      My Bookings
                    </button>
                  </div>
                </div>
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
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-all group text-left"
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
                            <h3 className="text-white text-lg font-semibold group-hover:text-lime-400 transition-colors">
                              {business.businessName}
                            </h3>
                            <p className="text-gray-400 text-sm mt-1 line-clamp-1">{business.description}</p>
                            <div className="flex items-center gap-1 mt-2 text-gray-500 text-sm">
                              <MapPin className="w-4 h-4" />
                              {business.postcode}
                            </div>
                          </div>

                          {/* Arrow */}
                          <ChevronRight className="w-6 h-6 text-gray-500 group-hover:text-lime-400 transition-colors flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
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
                      <div key={booking.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{booking.serviceName}</h4>
                            <p className="text-lime-400">{booking.businessName}</p>
                            {booking.staffName && (
                              <p className="text-gray-500 text-sm">with {booking.staffName}</p>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-gray-500 text-sm">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {booking.date}
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
                                ? 'bg-lime-500/20 text-lime-400'
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
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                    <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No upcoming bookings</p>
                    <button
                      onClick={() => setActiveView('businesses')}
                      className="bg-lime-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
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
                      <div key={booking.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
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
                                {booking.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {booking.time}
                              </span>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'completed' || (booking.status === 'confirmed' && isDatePassed(booking.date))
                              ? 'bg-lime-500/20 text-lime-400'
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
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
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

                <form onSubmit={handleProfileSave} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
                  {profileError && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
                      {profileError}
                    </div>
                  )}
                  
                  {profileSuccess && (
                    <div className="bg-lime-500/10 border border-lime-500/50 text-lime-400 px-4 py-3 rounded-lg">
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
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-lime-500"
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
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-lime-500"
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
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-lime-500"
                      placeholder="Enter your phone number"
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="flex items-center gap-2 bg-lime-500 text-black px-6 py-3 rounded-lg font-medium hover:bg-lime-400 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {profileSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CustomerDashboard;
