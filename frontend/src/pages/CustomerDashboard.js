import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Building2, MapPin, ChevronRight, Calendar, Bell, X, Clock } from 'lucide-react';
import { businessAPI, appointmentAPI, notificationAPI } from '../services/api';

const CustomerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('businesses');
  const [showNotifications, setShowNotifications] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

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

  const activeBookings = myBookings.filter(b => b.status === 'pending' || b.status === 'confirmed');
  const pastBookings = myBookings.filter(b => b.status === 'cancelled' || b.status === 'declined' || b.status === 'completed');

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <img 
            src="https://customer-assets.emergentagent.com/job_timeslot-app-4/artifacts/mumm4bgy_Bookle%20Logo.jpeg" 
            alt="Bookle" 
            className="h-12"
          />
          <div className="flex items-center gap-4">
            {/* Notifications Bell */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-lime-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadNotifications.length}
                </span>
              )}
            </button>
            <div className="text-right">
              <p className="text-white font-medium">{user?.fullName}</p>
              <p className="text-gray-500 text-sm">Customer</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="fixed inset-0 z-50" onClick={() => setShowNotifications(false)}>
          <div 
            className="absolute top-16 right-4 w-96 max-w-[calc(100vw-2rem)] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-white font-semibold">Notifications</h3>
              {unreadNotifications.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-lime-400 text-sm hover:text-lime-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.slice(0, 10).map(notification => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-4 border-b border-zinc-800 hover:bg-zinc-800 transition-colors ${
                      !notification.read ? 'bg-lime-500/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        notification.read ? 'bg-gray-600' : 'bg-lime-500'
                      }`} />
                      <div>
                        <p className={`font-medium ${notification.read ? 'text-gray-400' : 'text-white'}`}>
                          {notification.title}
                        </p>
                        <p className="text-gray-500 text-sm mt-1">{notification.message}</p>
                        <p className="text-gray-600 text-xs mt-2">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No notifications</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-zinc-900/50 border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveView('businesses')}
              className={`px-4 py-3 font-medium transition-colors ${
                activeView === 'businesses'
                  ? 'text-lime-400 border-b-2 border-lime-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Browse Businesses
            </button>
            <button
              onClick={() => setActiveView('bookings')}
              className={`px-4 py-3 font-medium transition-colors flex items-center gap-2 ${
                activeView === 'bookings'
                  ? 'text-lime-400 border-b-2 border-lime-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              My Bookings
              {activeBookings.length > 0 && (
                <span className="w-5 h-5 bg-lime-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                  {activeBookings.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {activeView === 'businesses' ? (
          <>
            {/* Welcome Section */}
            <div className="mb-8">
              <h2 className="text-white text-2xl font-semibold mb-2">Welcome, {user?.fullName?.split(' ')[0]}!</h2>
              <p className="text-gray-500">Choose a business to book your appointment</p>
            </div>

            {/* Business List */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-lime-400" />
                <h3 className="text-white text-lg font-semibold">Available Businesses</h3>
              </div>
              
              <div className="space-y-3">
                {businesses.map(business => (
                  <button
                    key={business.id}
                    onClick={() => handleBusinessClick(business.id)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-lime-500/50 hover:bg-zinc-800/50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Logo */}
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                        {business.logo ? (
                          <img
                            src={business.logo}
                            alt={`${business.businessName} logo`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                      </div>
                      
                      {/* Business Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-semibold text-lg">{business.businessName}</h4>
                        <p className="text-gray-400 text-sm line-clamp-2">{business.description}</p>
                        {business.postcode && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-lime-400 flex-shrink-0" />
                            <span className="text-gray-500 text-xs">{business.postcode}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Arrow */}
                      <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-lime-400 transition-colors flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>

              {businesses.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                  <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No businesses available yet</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* My Bookings View */}
            <div className="mb-8">
              <h2 className="text-white text-2xl font-semibold mb-2">My Bookings</h2>
              <p className="text-gray-500">View and manage your appointments</p>
            </div>

            {/* Active Bookings */}
            <div className="mb-8">
              <h3 className="text-lime-400 text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Upcoming Bookings
              </h3>
              
              {activeBookings.length > 0 ? (
                <div className="space-y-3">
                  {activeBookings.map(booking => (
                    <div key={booking.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{booking.serviceName || getServiceName(booking.serviceId)}</h4>
                          <p className="text-gray-400 text-sm mt-1">{booking.businessName}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-gray-500 text-sm flex items-center gap-1">
                              <Calendar className="w-4 h-4" /> {booking.date}
                            </span>
                            <span className="text-gray-500 text-sm flex items-center gap-1">
                              <Clock className="w-4 h-4" /> {booking.time}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'confirmed' 
                              ? 'bg-lime-500/20 text-lime-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {booking.status === 'pending' ? 'Awaiting Approval' : booking.status}
                          </span>
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            className="text-red-400 text-sm hover:text-red-300 transition-colors"
                          >
                            Cancel Booking
                          </button>
                        </div>
                      </div>
                      {booking.status === 'pending' && (
                        <p className="text-yellow-400/80 text-sm mt-3 bg-yellow-500/10 rounded-lg p-2">
                          Your booking request has been sent. The business owner will confirm shortly.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">No upcoming bookings</p>
                  <button
                    onClick={() => setActiveView('businesses')}
                    className="bg-lime-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
                  >
                    Book an Appointment
                  </button>
                </div>
              )}
            </div>

            {/* Past Bookings */}
            {pastBookings.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-lg font-semibold mb-4">Past Bookings</h3>
                <div className="space-y-3">
                  {pastBookings.map(booking => (
                    <div key={booking.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 opacity-60">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-white font-medium">{booking.serviceName || getServiceName(booking.serviceId)}</h4>
                          <p className="text-gray-400 text-sm mt-1">{booking.businessName}</p>
                          <p className="text-gray-500 text-sm mt-1">{booking.date} at {booking.time}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          booking.status === 'completed' ? 'bg-lime-500/20 text-lime-400'
                          : booking.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400'
                          : 'bg-red-500/20 text-red-400'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))}
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
