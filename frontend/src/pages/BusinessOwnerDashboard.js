import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, Clock, Users, Settings, ChevronRight, ChevronLeft, Building2, MapPin, X, Plus, Edit2, Trash2, Bell, Check, XCircle, User, UserPlus, Save, CreditCard, Banknote, ExternalLink, AlertCircle, TrendingUp, TrendingDown, DollarSign, BarChart3, AlertTriangle } from 'lucide-react';
import { serviceAPI, availabilityAPI, appointmentAPI, notificationAPI, staffAPI, businessAPI, stripeConnectAPI, subscriptionAPI, revenueAPI } from '../services/api';

const BusinessOwnerDashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Data state
  const [businessServices, setBusinessServices] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [businessCustomers, setBusinessCustomers] = useState([]);
  const [businessData, setBusinessData] = useState(null);
  const [availabilityCache, setAvailabilityCache] = useState({});
  
  // Stripe Connect state
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  
  // Subscription state
  const [subscription, setSubscription] = useState(null);
  
  // Staff management state
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({ name: '', serviceIds: [] });
  const [showStaffConfirmModal, setShowStaffConfirmModal] = useState(false);
  const [staffConfirmData, setStaffConfirmData] = useState(null);
  const [pendingStaffAction, setPendingStaffAction] = useState(null);
  
  // Service management state
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: '', description: '', duration: 30, price: 0, category: ''
  });
  
  // Booking for customer state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    customerId: '', customerName: '', customerEmail: '', customerPhone: '',
    serviceId: '', staffId: '', date: '', time: ''
  });
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingAvailableSlots, setBookingAvailableSlots] = useState([]);
  
  // Profile state
  const [profileForm, setProfileForm] = useState({
    businessName: '', description: '', postcode: '', address: '', phone: '', email: '', website: '', depositLevel: '20'
  });
  const [profileSaving, setProfileSaving] = useState(false);
  
  const [showNotifications, setShowNotifications] = useState(false);

  const business = user?.business || businessData;

  // Check for Stripe redirect
  useEffect(() => {
    if (searchParams.get('stripe_connected') === 'true') {
      loadStripeStatus();
      alert('Stripe account connected successfully!');
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
    loadStripeStatus();
    loadSubscription();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [servicesRes, appointmentsRes, notificationsRes, staffRes, customersRes, businessRes] = await Promise.all([
        serviceAPI.getMyServices().catch(() => ({ data: [] })),
        appointmentAPI.getBusinessAppointments().catch(() => ({ data: [] })),
        notificationAPI.getAll().catch(() => ({ data: [] })),
        staffAPI.getAll().catch(() => ({ data: [] })),
        appointmentAPI.getBusinessCustomers().catch(() => ({ data: [] })),
        businessAPI.getMine().catch(() => ({ data: null }))
      ]);
      
      setBusinessServices(servicesRes.data || []);
      setAllAppointments(appointmentsRes.data || []);
      setNotifications(notificationsRes.data || []);
      setStaffMembers(staffRes.data || []);
      setBusinessCustomers(customersRes.data || []);
      
      if (businessRes.data) {
        setBusinessData(businessRes.data);
        setProfileForm({
          businessName: businessRes.data.businessName || '',
          description: businessRes.data.description || '',
          postcode: businessRes.data.postcode || '',
          address: businessRes.data.address || '',
          phone: businessRes.data.phone || '',
          email: businessRes.data.email || '',
          website: businessRes.data.website || '',
          depositLevel: businessRes.data.depositLevel || '20'
        });
      }
      
      // Auto-create owner as staff if no staff exists
      if ((staffRes.data || []).length === 0 && businessRes.data) {
        await createOwnerAsStaff(businessRes.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStripeStatus = async () => {
    try {
      const res = await stripeConnectAPI.getStatus();
      setStripeStatus(res.data);
    } catch (error) {
      console.error('Failed to load Stripe status:', error);
    }
  };

  const loadSubscription = async () => {
    try {
      const res = await subscriptionAPI.getMine();
      setSubscription(res.data);
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };

  const handleConnectStripe = async () => {
    setStripeLoading(true);
    try {
      const res = await stripeConnectAPI.createAccount();
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (error) {
      console.error('Stripe connect error:', error);
      alert('Failed to start Stripe onboarding. Please try again.');
    } finally {
      setStripeLoading(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    try {
      const res = await stripeConnectAPI.getDashboardLink();
      if (res.data.url) {
        window.open(res.data.url, '_blank');
      }
    } catch (error) {
      console.error('Error getting dashboard link:', error);
    }
  };

  const createOwnerAsStaff = async (businessInfo) => {
    try {
      const ownerName = user?.fullName || businessInfo.businessName || 'Owner';
      await staffAPI.create({ 
        name: ownerName, 
        serviceIds: businessServices.map(s => s.id)
      });
      // Reload staff
      const staffRes = await staffAPI.getAll();
      setStaffMembers(staffRes.data || []);
      // Set the owner staff as selected by default
      if (staffRes.data?.length > 0) {
        setSelectedStaff(staffRes.data[0]);
      }
    } catch (error) {
      console.error('Failed to create owner as staff:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // ========== SERVICE MANAGEMENT ==========
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
        alert('Failed to delete service. Please try again.');
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

  // ========== STAFF MANAGEMENT ==========
  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({ name: '', serviceIds: [] });
    setShowStaffModal(true);
  };

  const openEditStaff = (staff) => {
    setEditingStaff(staff);
    setStaffForm({
      name: staff.name,
      serviceIds: staff.serviceIds || []
    });
    setShowStaffModal(true);
  };

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        // Editing existing staff - no subscription change
        await staffAPI.update(editingStaff.id, staffForm);
        setShowStaffModal(false);
        loadData();
        loadSubscription();
      } else {
        // Adding new staff - show confirmation with subscription increase
        const preview = await staffAPI.previewSubscriptionChange('add');
        setStaffConfirmData({
          type: 'add',
          staffName: staffForm.name,
          ...preview.data
        });
        setPendingStaffAction({ type: 'add', data: staffForm });
        setShowStaffModal(false);
        setShowStaffConfirmModal(true);
      }
    } catch (error) {
      console.error('Failed to save staff:', error);
      alert(error.response?.data?.detail || 'Failed to save staff. Maximum 5 staff members allowed.');
    }
  };

  const handleConfirmStaffAction = async () => {
    try {
      if (pendingStaffAction.type === 'add') {
        await staffAPI.create(pendingStaffAction.data);
      } else if (pendingStaffAction.type === 'delete') {
        const res = await staffAPI.delete(pendingStaffAction.staffId);
        if (selectedStaff?.id === pendingStaffAction.staffId) {
          setSelectedStaff(staffMembers.find(s => s.id !== pendingStaffAction.staffId) || null);
        }
      }
      setShowStaffConfirmModal(false);
      setStaffConfirmData(null);
      setPendingStaffAction(null);
      loadData();
      loadSubscription();
    } catch (error) {
      console.error('Failed to complete staff action:', error);
      alert(error.response?.data?.detail || 'Failed to complete action.');
    }
  };

  const handleCancelStaffAction = () => {
    setShowStaffConfirmModal(false);
    setStaffConfirmData(null);
    setPendingStaffAction(null);
  };

  const handleDeleteStaff = async (staffId) => {
    const staff = staffMembers.find(s => s.id === staffId);
    if (staff?.isOwner) {
      alert('Cannot delete the business owner from staff.');
      return;
    }
    
    try {
      // Get preview of subscription change
      const preview = await staffAPI.previewSubscriptionChange('remove');
      setStaffConfirmData({
        type: 'delete',
        staffName: staff.name,
        ...preview.data
      });
      setPendingStaffAction({ type: 'delete', staffId: staffId });
      setShowStaffConfirmModal(true);
    } catch (error) {
      console.error('Failed to preview subscription change:', error);
      alert(error.response?.data?.detail || 'Failed to process request.');
    }
  };

  const toggleStaffService = (serviceId) => {
    setStaffForm(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : [...prev.serviceIds, serviceId]
    }));
  };

  // ========== BOOKING APPROVAL ==========
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

  // ========== BOOK FOR CUSTOMER ==========
  const openBookForCustomer = () => {
    setBookingForm({
      customerId: '', customerName: '', customerEmail: '', customerPhone: '',
      serviceId: '', staffId: selectedStaff?.id || '', date: '', time: ''
    });
    setBookingStep(1);
    setBookingAvailableSlots([]);
    setShowBookingModal(true);
  };

  const handleBookingDateSelect = async (date) => {
    setBookingForm(prev => ({ ...prev, date, time: '' }));
    if (business && bookingForm.staffId) {
      try {
        const res = await availabilityAPI.get(business.id, date, bookingForm.staffId);
        setBookingAvailableSlots(res.data?.slots || []);
      } catch {
        setBookingAvailableSlots([]);
      }
    }
  };

  const handleBookForCustomerSubmit = async () => {
    try {
      await appointmentAPI.bookForCustomer({
        serviceId: bookingForm.serviceId,
        staffId: bookingForm.staffId || null,
        date: bookingForm.date,
        time: bookingForm.time,
        customerId: bookingForm.customerId || null,
        customerName: bookingForm.customerName,
        customerEmail: bookingForm.customerEmail,
        customerPhone: bookingForm.customerPhone
      });
      setShowBookingModal(false);
      loadData();
      alert('Booking created successfully!');
    } catch (error) {
      console.error('Failed to create booking:', error);
      alert(error.response?.data?.detail || 'Failed to create booking.');
    }
  };

  // ========== PROFILE ==========
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const updated = await businessAPI.updateMine(profileForm);
      setBusinessData(updated.data);
      // Update user context with new business data
      if (updateUser && user) {
        updateUser({ ...user, business: updated.data });
      }
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  // ========== NOTIFICATIONS ==========
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

  // ========== AVAILABILITY ==========
  const getAvailabilityKey = (date, staffId) => `${date}_${staffId || 'default'}`;

  const getAvailabilityForDate = async (dateStr, staffId) => {
    const key = getAvailabilityKey(dateStr, staffId);
    if (availabilityCache[key] !== undefined) {
      return availabilityCache[key];
    }
    try {
      const res = await availabilityAPI.get(business.id, dateStr, staffId);
      const slots = res.data?.slots || [];
      setAvailabilityCache(prev => ({ ...prev, [key]: slots }));
      return slots;
    } catch {
      return [];
    }
  };

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
      const key = getAvailabilityKey(dateStr, selectedStaff?.id);
      const cachedSlots = availabilityCache[key];
      
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

  useEffect(() => {
    if (business && activeView === 'availability' && selectedStaff) {
      loadMonthAvailability();
    }
  }, [business, currentMonth, activeView, selectedStaff]);

  const loadMonthAvailability = async () => {
    const { daysInMonth } = getDaysInMonth(currentMonth);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateStr = date.toISOString().split('T')[0];
      const key = getAvailabilityKey(dateStr, selectedStaff?.id);
      
      if (availabilityCache[key] === undefined) {
        await getAvailabilityForDate(dateStr, selectedStaff?.id);
      }
    }
  };

  const handleDateClick = async (dayInfo) => {
    if (!dayInfo || dayInfo.isPast || dayInfo.isTooFar) return;
    setSelectedDate(dayInfo.date);
    const existingSlots = await getAvailabilityForDate(dayInfo.date, selectedStaff?.id);
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
        await availabilityAPI.set(business.id, selectedDate, selectedSlots, selectedStaff?.id);
        const key = getAvailabilityKey(selectedDate, selectedStaff?.id);
        setAvailabilityCache(prev => ({ ...prev, [key]: selectedSlots }));
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

  // Set default staff when loaded
  useEffect(() => {
    if (staffMembers.length > 0 && !selectedStaff) {
      setSelectedStaff(staffMembers[0]);
    }
  }, [staffMembers]);

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
              <h1 className="text-white text-xl font-bold">{business?.businessName || 'Calendrax'}</h1>
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
              { id: 'staff', label: 'Staff', icon: Users },
              { id: 'customers', label: 'Customers', icon: User },
              { id: 'profile', label: 'Profile', icon: Building2 }
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <p className="text-gray-500 text-sm">Staff</p>
                <p className="text-white text-2xl font-bold mt-1">{staffMembers.length}</p>
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
          <div className="space-y-6">
            {/* Staff Selector Tabs */}
            {staffMembers.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2">
                <div className="flex gap-2 overflow-x-auto">
                  {staffMembers.map(staff => (
                    <button
                      key={staff.id}
                      onClick={() => {
                        setSelectedStaff(staff);
                        setSelectedDate(null);
                        setSelectedSlots([]);
                        setAvailabilityCache({});
                      }}
                      className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                        selectedStaff?.id === staff.id
                          ? 'bg-lime-500 text-black'
                          : 'bg-zinc-800 text-white hover:bg-zinc-700'
                      }`}
                    >
                      {staff.name} {staff.isOwner && '(Owner)'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Calendar */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-white text-xl font-semibold mb-4">
                  {selectedStaff ? `${selectedStaff.name}'s Availability` : 'Set Availability'}
                </h2>
                
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
          </div>
        )}

        {/* Appointments View */}
        {activeView === 'appointments' && (
          <div className="space-y-6">
            {/* Book for Customer Button */}
            <div className="flex justify-end">
              <button
                onClick={openBookForCustomer}
                className="flex items-center gap-2 bg-lime-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Book for Customer
              </button>
            </div>

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
                          {apt.staffName && <p className="text-gray-500 text-sm">with {apt.staffName}</p>}
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
                          {apt.staffName && <p className="text-gray-500 text-sm">with {apt.staffName}</p>}
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
                          className={`px-3 py-1 rounded-lg text-sm transition-colors ${
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
                          data-testid={`delete-service-${service.id}`}
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

        {/* Staff View */}
        {activeView === 'staff' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-white text-xl font-semibold">Staff Members</h2>
                <p className="text-gray-500 text-sm">Manage up to 5 staff members for booking</p>
              </div>
              {staffMembers.length < 5 && (
                <button
                  onClick={openAddStaff}
                  className="flex items-center gap-2 bg-lime-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
                >
                  <UserPlus className="w-4 h-4" /> Add Staff
                </button>
              )}
            </div>

            {staffMembers.length > 0 ? (
              <div className="space-y-3">
                {staffMembers.map(staff => (
                  <div key={staff.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-lime-500/20 flex items-center justify-center">
                            <User className="w-5 h-5 text-lime-400" />
                          </div>
                          <div>
                            <h4 className="text-white font-medium">{staff.name}</h4>
                            {staff.isOwner && (
                              <span className="text-lime-400 text-xs">Business Owner</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-3">
                          <p className="text-gray-500 text-sm mb-2">Services offered:</p>
                          <div className="flex flex-wrap gap-2">
                            {(staff.serviceIds || []).map(sid => {
                              const service = businessServices.find(s => s.id === sid);
                              return service ? (
                                <span key={sid} className="px-2 py-1 bg-zinc-800 text-gray-300 text-xs rounded">
                                  {service.name}
                                </span>
                              ) : null;
                            })}
                            {(!staff.serviceIds || staff.serviceIds.length === 0) && (
                              <span className="text-gray-500 text-xs">No services assigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditStaff(staff)}
                          className="p-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!staff.isOwner && (
                          <button
                            onClick={() => handleDeleteStaff(staff.id)}
                            className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No staff members yet</p>
                <button
                  onClick={openAddStaff}
                  className="bg-lime-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
                >
                  Add Your First Staff Member
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

        {/* Profile View */}
        {activeView === 'profile' && (
          <div className="space-y-6">
            <h2 className="text-white text-xl font-semibold">Business Profile</h2>
            
            {/* Subscription Status Card */}
            {subscription && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-lime-400" />
                  Subscription Status
                </h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Status</p>
                    <p className={`font-semibold ${subscription.status === 'trial' ? 'text-yellow-400' : subscription.status === 'active' ? 'text-lime-400' : 'text-red-400'}`}>
                      {subscription.status === 'trial' ? 'Free Trial' : subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                    </p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Staff Members</p>
                    <p className="text-white font-semibold">{subscription.staffCount}</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Monthly Price</p>
                    <p className="text-lime-400 font-semibold">£{subscription.priceMonthly?.toFixed(2)}</p>
                  </div>
                  {subscription.status === 'trial' && subscription.trialDaysRemaining > 0 && (
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Trial Ends In</p>
                      <p className="text-yellow-400 font-semibold">{subscription.trialDaysRemaining} days</p>
                    </div>
                  )}
                </div>
                {subscription.freeAccessOverride && (
                  <p className="text-lime-400 text-sm mt-3 flex items-center gap-2">
                    <Check className="w-4 h-4" /> Free access granted by admin
                  </p>
                )}
              </div>
            )}

            {/* Stripe Connect Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-lime-400" />
                Bank Account (Receive Payments)
              </h3>
              
              {!stripeStatus?.connected ? (
                <div className="space-y-4">
                  <p className="text-gray-400">
                    Connect your bank account to receive customer deposits directly. Powered by Stripe.
                  </p>
                  <button
                    onClick={handleConnectStripe}
                    disabled={stripeLoading}
                    className="flex items-center gap-2 bg-lime-500 text-black px-6 py-3 rounded-lg font-medium hover:bg-lime-400 transition-colors disabled:opacity-50"
                  >
                    {stripeLoading ? (
                      <>Processing...</>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Connect Bank Account
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${stripeStatus.chargesEnabled ? 'bg-lime-500' : 'bg-yellow-500'}`}></div>
                    <span className="text-white">
                      {stripeStatus.chargesEnabled ? 'Account active - Ready to receive payments' : 'Account setup incomplete'}
                    </span>
                  </div>
                  
                  <div className="flex gap-3">
                    {!stripeStatus.chargesEnabled && (
                      <button
                        onClick={handleConnectStripe}
                        className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-yellow-400 transition-colors"
                      >
                        Complete Setup
                      </button>
                    )}
                    <button
                      onClick={handleOpenStripeDashboard}
                      className="flex items-center gap-2 bg-zinc-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-zinc-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Stripe Dashboard
                    </button>
                  </div>
                </div>
              )}
              
              {!stripeStatus?.connected && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-200 text-sm">
                    Without a connected bank account, customer deposits will go to the platform. Connect your account to receive payments directly.
                  </p>
                </div>
              )}
            </div>

            {/* Deposit Settings */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-lime-400" />
                Deposit Settings
              </h3>
              <p className="text-gray-400 mb-4">
                Choose how much deposit customers must pay when booking your services.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { value: 'none', label: 'No Deposit' },
                  { value: '10', label: '10%' },
                  { value: '20', label: '20%' },
                  { value: '50', label: '50%' },
                  { value: 'full', label: 'Pay in Full' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setProfileForm({...profileForm, depositLevel: option.value})}
                    className={`p-4 rounded-lg border transition-all ${
                      profileForm.depositLevel === option.value
                        ? 'bg-lime-500/20 border-lime-500 text-lime-400'
                        : 'bg-zinc-800 border-zinc-700 text-gray-400 hover:border-zinc-600'
                    }`}
                  >
                    <span className="font-semibold">{option.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-gray-500 text-sm mt-3">
                {profileForm.depositLevel === 'none' && 'Customers can book without any upfront payment.'}
                {profileForm.depositLevel === '10' && 'Customers pay 10% of the service price to confirm their booking.'}
                {profileForm.depositLevel === '20' && 'Customers pay 20% of the service price to confirm their booking. (Recommended)'}
                {profileForm.depositLevel === '50' && 'Customers pay 50% of the service price to confirm their booking.'}
                {profileForm.depositLevel === 'full' && 'Customers pay the full service price upfront when booking.'}
              </p>
            </div>
            
            {/* Business Details Form */}
            <form onSubmit={handleProfileSave} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Building2 className="w-5 h-5 text-lime-400" />
                Business Details
              </h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Business Name</label>
                  <input
                    type="text"
                    value={profileForm.businessName}
                    onChange={(e) => setProfileForm({...profileForm, businessName: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-lime-500"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Postcode</label>
                  <input
                    type="text"
                    value={profileForm.postcode}
                    onChange={(e) => setProfileForm({...profileForm, postcode: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-lime-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-2">Description</label>
                <textarea
                  value={profileForm.description}
                  onChange={(e) => setProfileForm({...profileForm, description: e.target.value})}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-lime-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-2">Address</label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-lime-500"
                  placeholder="Full business address"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Phone</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-lime-500"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-lime-500"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Website</label>
                  <input
                    type="url"
                    value={profileForm.website}
                    onChange={(e) => setProfileForm({...profileForm, website: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-lime-500"
                    placeholder="https://"
                  />
                </div>
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
      </main>

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-white text-lg font-semibold">
                {editingService ? 'Edit Service' : 'Add Service'}
              </h3>
              <button onClick={() => setShowServiceModal(false)} className="text-gray-400 hover:text-white">
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

      {/* Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900">
              <h3 className="text-white text-lg font-semibold">
                {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
              </h3>
              <button onClick={() => setShowStaffModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStaffSubmit} className="p-4 space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Name</label>
                <input
                  type="text"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({...staffForm, name: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500"
                  required
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-2">Services Offered</label>
                <p className="text-gray-500 text-xs mb-3">Select which services this staff member can perform</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {businessServices.map(service => (
                    <label
                      key={service.id}
                      className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-700 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={staffForm.serviceIds.includes(service.id)}
                        onChange={() => toggleStaffService(service.id)}
                        className="w-4 h-4 rounded border-zinc-600 text-lime-500 focus:ring-lime-500 focus:ring-offset-zinc-900"
                      />
                      <div>
                        <p className="text-white text-sm">{service.name}</p>
                        <p className="text-gray-500 text-xs">£{service.price} • {service.duration} min</p>
                      </div>
                    </label>
                  ))}
                  {businessServices.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No services available. Add services first.
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-lime-500 text-black font-semibold py-3 rounded-lg hover:bg-lime-400 transition-colors"
              >
                {editingStaff ? 'Update Staff' : 'Add Staff'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Staff Subscription Confirmation Modal */}
      {showStaffConfirmModal && staffConfirmData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                staffConfirmData.type === 'add' ? 'bg-lime-500/20' : 'bg-yellow-500/20'
              }`}>
                {staffConfirmData.type === 'add' ? (
                  <UserPlus className={`w-8 h-8 ${staffConfirmData.type === 'add' ? 'text-lime-400' : 'text-yellow-400'}`} />
                ) : (
                  <Trash2 className="w-8 h-8 text-yellow-400" />
                )}
              </div>
              
              <h3 className="text-white text-xl font-semibold text-center mb-2">
                {staffConfirmData.type === 'add' ? 'Add Staff Member' : 'Remove Staff Member'}
              </h3>
              
              <p className="text-gray-400 text-center mb-4">
                {staffConfirmData.type === 'add' 
                  ? `Are you sure you want to add "${staffConfirmData.staffName}"?`
                  : `Are you sure you want to remove "${staffConfirmData.staffName}"?`
                }
              </p>
              
              <div className="bg-zinc-800 rounded-lg p-4 mb-6">
                <p className="text-gray-400 text-sm mb-3">Subscription Change:</p>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-gray-500 text-xs">Current</p>
                    <p className="text-white font-semibold">£{staffConfirmData.currentPrice?.toFixed(2)}</p>
                    <p className="text-gray-500 text-xs">{staffConfirmData.currentStaffCount} staff</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                  <div className="text-center">
                    <p className="text-gray-500 text-xs">New</p>
                    <p className={`font-semibold ${staffConfirmData.type === 'add' ? 'text-lime-400' : 'text-yellow-400'}`}>
                      £{staffConfirmData.newPrice?.toFixed(2)}
                    </p>
                    <p className="text-gray-500 text-xs">{staffConfirmData.newStaffCount} staff</p>
                  </div>
                </div>
                <p className={`text-sm text-center mt-3 ${staffConfirmData.type === 'add' ? 'text-lime-400' : 'text-yellow-400'}`}>
                  {staffConfirmData.type === 'add' 
                    ? `+£${staffConfirmData.priceIncrease?.toFixed(2)}/month`
                    : `-£${staffConfirmData.priceDecrease?.toFixed(2)}/month`
                  }
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleCancelStaffAction}
                  className="flex-1 bg-zinc-800 text-white font-semibold py-3 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStaffAction}
                  className={`flex-1 font-semibold py-3 rounded-lg transition-colors ${
                    staffConfirmData.type === 'add' 
                      ? 'bg-lime-500 text-black hover:bg-lime-400'
                      : 'bg-yellow-500 text-black hover:bg-yellow-400'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Book for Customer Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900">
              <h3 className="text-white text-lg font-semibold">Book for Customer</h3>
              <button onClick={() => setShowBookingModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Step 1: Customer Selection */}
              <div>
                <label className="text-gray-400 text-sm block mb-2">Customer</label>
                <select
                  value={bookingForm.customerId}
                  onChange={(e) => {
                    const customer = businessCustomers.find(c => c.id === e.target.value);
                    setBookingForm({
                      ...bookingForm,
                      customerId: e.target.value,
                      customerName: customer?.fullName || '',
                      customerEmail: customer?.email || '',
                      customerPhone: customer?.mobile || ''
                    });
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500"
                >
                  <option value="">-- New Customer --</option>
                  {businessCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.fullName} ({c.email})</option>
                  ))}
                </select>
              </div>

              {!bookingForm.customerId && (
                <div className="grid grid-cols-1 gap-3">
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={bookingForm.customerName}
                    onChange={(e) => setBookingForm({...bookingForm, customerName: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500"
                  />
                  <input
                    type="email"
                    placeholder="Customer Email"
                    value={bookingForm.customerEmail}
                    onChange={(e) => setBookingForm({...bookingForm, customerEmail: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500"
                  />
                  <input
                    type="tel"
                    placeholder="Customer Phone"
                    value={bookingForm.customerPhone}
                    onChange={(e) => setBookingForm({...bookingForm, customerPhone: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500"
                  />
                </div>
              )}

              {/* Step 2: Service Selection */}
              <div>
                <label className="text-gray-400 text-sm block mb-2">Service</label>
                <select
                  value={bookingForm.serviceId}
                  onChange={(e) => setBookingForm({...bookingForm, serviceId: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500"
                  required
                >
                  <option value="">Select a service</option>
                  {businessServices.filter(s => s.active !== false).map(s => (
                    <option key={s.id} value={s.id}>{s.name} - £{s.price}</option>
                  ))}
                </select>
              </div>

              {/* Step 3: Staff Selection */}
              {staffMembers.length > 1 && (
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Staff Member</label>
                  <select
                    value={bookingForm.staffId}
                    onChange={(e) => setBookingForm({...bookingForm, staffId: e.target.value, date: '', time: ''})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500"
                  >
                    {staffMembers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Step 4: Date Selection */}
              <div>
                <label className="text-gray-400 text-sm block mb-2">Date</label>
                <input
                  type="date"
                  value={bookingForm.date}
                  onChange={(e) => handleBookingDateSelect(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-lime-500"
                  required
                />
              </div>

              {/* Step 5: Time Selection */}
              {bookingForm.date && (
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Available Times</label>
                  {bookingAvailableSlots.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                      {bookingAvailableSlots.map(slot => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setBookingForm({...bookingForm, time: slot})}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                            bookingForm.time === slot
                              ? 'bg-lime-500 text-black'
                              : 'bg-zinc-800 text-white hover:bg-zinc-700'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No available slots for this date</p>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleBookForCustomerSubmit}
                disabled={!bookingForm.serviceId || !bookingForm.date || !bookingForm.time || (!bookingForm.customerId && !bookingForm.customerEmail)}
                className="w-full bg-lime-500 text-black font-semibold py-3 rounded-lg hover:bg-lime-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessOwnerDashboard;
