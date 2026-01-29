import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, Clock, Users, Settings, ChevronRight, ChevronLeft, Building2, MapPin, X, Plus, Edit2, Trash2, Bell, Check, XCircle } from 'lucide-react';
import { serviceAPI, availabilityAPI, appointmentAPI, notificationAPI } from '../services/api';

const BusinessOwnerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Data state
  const [businessServices, setBusinessServices] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [availabilityCache, setAvailabilityCache] = useState({});
  
  // Service management state
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: '', description: '', duration: 30, price: 0, category: ''
  });
  const [showNotifications, setShowNotifications] = useState(false);

  const business = user?.business;

  useEffect(() => {
    if (business) {
      loadData();
    }
  }, [business]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [servicesRes, appointmentsRes, notificationsRes] = await Promise.all([
        serviceAPI.getMyServices().catch(() => ({ data: [] })),
        appointmentAPI.getBusinessAppointments().catch(() => ({ data: [] })),
        notificationAPI.getAll().catch(() => ({ data: [] }))
      ]);
      
      setBusinessServices(servicesRes.data || []);
      setAllAppointments(appointmentsRes.data || []);
      setNotifications(notificationsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Service management functions
  const openAddService = () => {
    setEditingService(null);
    setServiceForm({ name: '', description: '', duration: 30, price: 0, category: '' });
    setShowServiceModal(true);
  };

  const openEditService = (service) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description,
      duration: service.duration,
      price: service.price,
      category: service.category || ''
    });
    setShowServiceModal(true);
  };

  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await serviceAPI.update(editingService.id, serviceForm);
      } else {
        await serviceAPI.create(serviceForm);
      }
      setShowServiceModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to save service:', error);
      alert('Failed to save service. Please try again.');
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      try {
        await serviceAPI.delete(serviceId);
        loadData();
      } catch (error) {
        console.error('Failed to delete service:', error);
      }
    }
  };

  const handleToggleActive = async (service) => {
    try {
      await serviceAPI.update(service.id, { active: !service.active });
      loadData();
    } catch (error) {
      console.error('Failed to toggle service:', error);
    }
  };

  // Booking approval functions
  const handleApproveBooking = async (appointment) => {
    try {
      await appointmentAPI.updateStatus(appointment.id, 'confirmed');
      loadData();
    } catch (error) {
      console.error('Failed to approve booking:', error);
    }
  };

  const handleDeclineBooking = async (appointment) => {
    try {
      await appointmentAPI.updateStatus(appointment.id, 'declined');
      loadData();
    } catch (error) {
      console.error('Failed to decline booking:', error);
    }
  };

  // Notification functions
  const handleNotificationClick = async (notification) => {
    try {
      await notificationAPI.markRead(notification.id);
      setShowNotifications(false);
      if (notification.type === 'new_booking') {
        setActiveView('appointments');
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

  // Availability functions
  const getAvailabilityForDate = async (dateStr) => {
    if (availabilityCache[dateStr] !== undefined) {
      return availabilityCache[dateStr];
    }
    try {
      const res = await availabilityAPI.get(business.id, dateStr);
      const slots = res.data?.slots || [];
      setAvailabilityCache(prev => ({ ...prev, [dateStr]: slots }));
      return slots;
    } catch {
      return [];
    }
  };

  // Calendar functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const generateCalendarDays = () => {
    const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);
    const days = [];
    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 6);

    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateStr = date.toISOString().split('T')[0];
      const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isTooFar = date > maxDate;
      const cachedSlots = availabilityCache[dateStr];
      
      days.push({
        day,
        date: dateStr,
        isPast,
        isTooFar,
        hasSlots: cachedSlots ? cachedSlots.length > 0 : null,
        isToday: date.toDateString() === today.toDateString()
      });
    }

    return days;
  };

  // Load availability for visible month
  useEffect(() => {
    if (business && activeView === 'availability') {
      loadMonthAvailability();
    }
  }, [business, currentMonth, activeView]);

  const loadMonthAvailability = async () => {
    const { daysInMonth } = getDaysInMonth(currentMonth);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateStr = date.toISOString().split('T')[0];
      
      if (availabilityCache[dateStr] === undefined) {
        await getAvailabilityForDate(dateStr);
      }
    }
  };

  const handleDateClick = async (dayInfo) => {
    if (!dayInfo || dayInfo.isPast || dayInfo.isTooFar) return;
    setSelectedDate(dayInfo.date);
    const existingSlots = await getAvailabilityForDate(dayInfo.date);
    setSelectedSlots(existingSlots);
  };

  const toggleSlot = (slot) => {
    setSelectedSlots(prev => 
      prev.includes(slot) 
        ? prev.filter(s => s !== slot)
        : [...prev, slot].sort()
    );
  };

  const saveAvailability = async () => {
    if (business && selectedDate) {
      try {
        await availabilityAPI.set(business.id, selectedDate, selectedSlots);
        setAvailabilityCache(prev => ({ ...prev, [selectedDate]: selectedSlots }));
        setSelectedDate(null);
        setSelectedSlots([]);
      } catch (error) {
        console.error('Failed to save availability:', error);
        alert('Failed to save availability. Please try again.');
      }
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour < 18; hour++) {
      for (let min = 0; min < 60; min += 15) {
        const h = hour.toString().padStart(2, '0');
        const m = min.toString().padStart(2, '0');
        slots.push(`${h}:${m}`);
      }
    }
    return slots;
  };

  const selectAllSlots = () => setSelectedSlots(generateTimeSlots());
  const clearAllSlots = () => setSelectedSlots([]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    
    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 6);
    
    if (direction === -1 && newMonth < new Date(today.getFullYear(), today.getMonth(), 1)) return;
    if (direction === 1 && newMonth > maxDate) return;
    
    setCurrentMonth(newMonth);
  };

  const pendingAppointments = allAppointments.filter(a => a.status === 'pending');
  const confirmedAppointments = allAppointments.filter(a => a.status === 'confirmed');
  const unreadNotifications = notifications.filter(n => !n.read);

  // Get unique customers from appointments
  const customers = allAppointments.reduce((acc, apt) => {
    if (!acc.find(c => c.id === apt.userId)) {
      acc.push({
        id: apt.userId,
        name: apt.customerName,
        email: apt.customerEmail,
        phone: apt.customerPhone
      });
    }
    return acc;
  }, []);

  const calendarDays = generateCalendarDays();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800">
              {business?.logo ? (
                <img src={business.logo} alt={business.businessName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-gray-500" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">{business?.businessName || 'Bookle'}</h1>
              <p className="text-gray-500 text-sm">Business Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
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

              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-white font-semibold">Notifications</h3>
                    {unreadNotifications.length > 0 && (
                      <button onClick={handleMarkAllRead} className="text-lime-400 text-sm hover:text-lime-300">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length > 0 ? notifications.slice(0, 10).map(notif => (
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
                    )) : (
                      <div className="p-4 text-center text-gray-500">No notifications</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleLogout} className="p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-zinc-900/50 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Building2 },
              { id: 'availability', label: 'Availability', icon: Calendar },
              { id: 'appointments', label: 'Appointments', icon: Clock, badge: pendingAppointments.length },
              { id: 'services', label: 'Services', icon: Settings },
              { id: 'customers', label: 'Customers', icon: Users }
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
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Dashboard View */}
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            {/* Business Info Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-800">
                  {business?.logo ? (
                    <img src={business.logo} alt={business.businessName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-white text-2xl font-bold">{business?.businessName}</h2>
                  <p className="text-gray-400 mt-1">{business?.description}</p>
                  {business?.postcode && (
                    <div className="flex items-center gap-1 mt-2">
                      <MapPin className="w-4 h-4 text-lime-400" />
                      <span className="text-gray-500">{business.postcode}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-gray-500 text-sm">Pending</p>
                <p className="text-white text-2xl font-bold mt-1">{pendingAppointments.length}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-gray-500 text-sm">Confirmed</p>
                <p className="text-lime-400 text-2xl font-bold mt-1">{confirmedAppointments.length}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-gray-500 text-sm">Services</p>
                <p className="text-white text-2xl font-bold mt-1">{businessServices.length}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-gray-500 text-sm">Customers</p>
                <p className="text-white text-2xl font-bold mt-1">{customers.length}</p>
              </div>
            </div>

            {/* Pending Appointments Alert */}
            {pendingAppointments.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-yellow-400" />
                    <div>
                      <p className="text-yellow-400 font-medium">{pendingAppointments.length} Pending Booking{pendingAppointments.length > 1 ? 's' : ''}</p>
                      <p className="text-yellow-400/70 text-sm">Review and respond to booking requests</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveView('appointments')}
                    className="bg-yellow-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-yellow-400 transition-colors"
                  >
                    View Requests
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {pendingAppointments.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No appointments yet</p>
                <button
                  onClick={() => setActiveView('availability')}
                  className="bg-lime-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
                >
                  Set Your Availability
                </button>
              </div>
            )}
          </div>
        )}

        {/* Availability View */}
        {activeView === 'availability' && (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Calendar */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-white text-xl font-semibold mb-4">Set Your Availability</h2>
              
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-white font-semibold">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-gray-500 text-xs font-medium py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((dayInfo, index) => (
                  <button
                    key={index}
                    onClick={() => handleDateClick(dayInfo)}
                    disabled={!dayInfo || dayInfo.isPast || dayInfo.isTooFar}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${
                      !dayInfo
                        ? 'bg-transparent cursor-default'
                        : dayInfo.isPast || dayInfo.isTooFar
                        ? 'bg-zinc-800/50 text-gray-600 cursor-not-allowed'
                        : selectedDate === dayInfo.date
                        ? 'bg-lime-500 text-black font-bold'
                        : dayInfo.isToday
                        ? 'bg-lime-500/30 text-lime-400 font-bold hover:bg-lime-500/40'
                        : 'bg-zinc-800 text-white hover:bg-zinc-700'
                    }`}
                  >
                    {dayInfo?.day}
                    {dayInfo?.hasSlots && selectedDate !== dayInfo.date && (
                      <span className="w-1.5 h-1.5 rounded-full bg-lime-400 mt-0.5"></span>
                    )}
                  </button>
                ))}
              </div>

              <p className="text-gray-500 text-sm mt-4 text-center">
                Select a date to manage availability • Green dots = slots set
              </p>
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white text-lg font-semibold">
                    Slots for {selectedDate}
                  </h3>
                  <button
                    onClick={() => { setSelectedDate(null); setSelectedSlots([]); }}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={selectAllSlots}
                    className="flex-1 px-3 py-2 bg-zinc-800 text-white rounded-lg text-sm hover:bg-zinc-700 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearAllSlots}
                    className="flex-1 px-3 py-2 bg-zinc-800 text-white rounded-lg text-sm hover:bg-zinc-700 transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                {/* Time Slots Grid */}
                <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto mb-4">
                  {generateTimeSlots().map(slot => (
                    <button
                      key={slot}
                      onClick={() => toggleSlot(slot)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        selectedSlots.includes(slot)
                          ? 'bg-lime-500 text-black'
                          : 'bg-zinc-800 text-white hover:bg-zinc-700'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>

                {/* Save Button */}
                <button
                  onClick={saveAvailability}
                  className="w-full bg-lime-500 text-black font-semibold py-3 rounded-lg hover:bg-lime-400 transition-colors"
                >
                  Save Availability ({selectedSlots.length} slots)
                </button>
              </div>
            )}

            {!selectedDate && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center justify-center">
                <div className="text-center">
                  <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">Select a date to manage time slots</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Appointments View */}
        {activeView === 'appointments' && (
          <div className="space-y-6">
            {/* Pending Appointments */}
            {pendingAppointments.length > 0 && (
              <div>
                <h2 className="text-white text-xl font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  Pending Requests ({pendingAppointments.length})
                </h2>
                <div className="space-y-3">
                  {pendingAppointments.map(apt => (
                    <div key={apt.id} className="bg-zinc-900 border border-yellow-500/30 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-white font-medium">{apt.customerName}</h4>
                          <p className="text-gray-400 text-sm">{apt.customerEmail}</p>
                          <p className="text-lime-400 mt-2">{apt.serviceName}</p>
                          <p className="text-gray-500 text-sm mt-1">
                            {apt.date} at {apt.time}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveBooking(apt)}
                            className="p-2 bg-lime-500 text-black rounded-lg hover:bg-lime-400 transition-colors"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeclineBooking(apt)}
                            className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmed Appointments */}
            <div>
              <h2 className="text-white text-xl font-semibold mb-4 flex items-center gap-2">
                <Check className="w-5 h-5 text-lime-400" />
                Confirmed ({confirmedAppointments.length})
              </h2>
              {confirmedAppointments.length > 0 ? (
                <div className="space-y-3">
                  {confirmedAppointments.map(apt => (
                    <div key={apt.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-white font-medium">{apt.customerName}</h4>
                          <p className="text-lime-400">{apt.serviceName}</p>
                          <p className="text-gray-500 text-sm mt-1">
                            {apt.date} at {apt.time}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-lime-500/20 text-lime-400 text-sm rounded-full">
                          Confirmed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No confirmed appointments</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Services View */}
        {activeView === 'services' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-semibold">Manage Services</h2>
              <button
                onClick={openAddService}
                className="flex items-center gap-2 bg-lime-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Service
              </button>
            </div>

            {businessServices.length > 0 ? (
              <div className="space-y-3">
                {businessServices.map(service => (
                  <div key={service.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium">{service.name}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            service.active !== false
                              ? 'bg-lime-500/20 text-lime-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {service.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mt-1">{service.description}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-lime-400 font-semibold">£{service.price}</span>
                          <span className="text-gray-500 text-sm flex items-center gap-1">
                            <Clock className="w-4 h-4" /> {service.duration} min
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleActive(service)}
                          className={`p-2 rounded-lg transition-colors ${
                            service.active !== false
                              ? 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                              : 'bg-lime-500/20 text-lime-400 hover:bg-lime-500/30'
                          }`}
                        >
                          {service.active !== false ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => openEditService(service)}
                          className="p-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteService(service.id)}
                          className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <Settings className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No services yet</p>
                <button
                  onClick={openAddService}
                  className="bg-lime-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
                >
                  Add Your First Service
                </button>
              </div>
            )}
          </div>
        )}

        {/* Customers View */}
        {activeView === 'customers' && (
          <div>
            <h2 className="text-white text-xl font-semibold mb-6">Customers</h2>
            
            {customers.length > 0 ? (
              <div className="space-y-3">
                {customers.map(customer => {
                  const customerAppointments = allAppointments.filter(a => a.userId === customer.id);
                  return (
                    <div key={customer.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-white font-medium">{customer.name}</h4>
                          <p className="text-gray-400 text-sm">{customer.email}</p>
                          {customer.phone && <p className="text-gray-500 text-sm">{customer.phone}</p>}
                          <p className="text-lime-400 text-sm mt-2">
                            {customerAppointments.length} booking{customerAppointments.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      
                      {/* Customer's appointments */}
                      {customerAppointments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-zinc-800">
                          <p className="text-gray-500 text-sm mb-2">Recent bookings:</p>
                          <div className="space-y-2">
                            {customerAppointments.slice(0, 3).map(apt => (
                              <div key={apt.id} className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">{apt.serviceName}</span>
                                <span className="text-gray-500">{apt.date}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  apt.status === 'confirmed' ? 'bg-lime-500/20 text-lime-400'
                                  : apt.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-gray-500/20 text-gray-400'
                                }`}>
                                  {apt.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No customers yet</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-white text-lg font-semibold">
                {editingService ? 'Edit Service' : 'Add Service'}
              </h3>
              <button
                onClick={() => setShowServiceModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleServiceSubmit} className="p-4 space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Service Name</label>
                <input
                  type="text"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({...serviceForm, name: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500"
                  required
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Description</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500 min-h-20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Duration (min)</label>
                  <input
                    type="number"
                    value={serviceForm.duration}
                    onChange={(e) => setServiceForm({...serviceForm, duration: parseInt(e.target.value) || 0})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500"
                    min="15"
                    step="15"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Price (£)</label>
                  <input
                    type="number"
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({...serviceForm, price: parseFloat(e.target.value) || 0})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-lime-500 text-black font-semibold py-3 rounded-lg hover:bg-lime-400 transition-colors"
              >
                {editingService ? 'Update Service' : 'Add Service'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessOwnerDashboard;
