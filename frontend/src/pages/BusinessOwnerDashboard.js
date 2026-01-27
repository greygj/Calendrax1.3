import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, Clock, Users, Settings, ChevronRight, ChevronLeft, Building2, MapPin, X, Plus, Edit2, Trash2, Bell, Check, XCircle } from 'lucide-react';
import { 
  getServicesByBusinessId, addService, updateService, deleteService, toggleServiceActive,
  getAppointmentsByBusinessId, getPendingAppointmentsByBusinessId, updateAppointmentStatus,
  getCustomersByBusinessId, deleteCustomerBookings, clearCustomerHistory,
  generateTimeSlots, setAvailability, getAvailability, getBusinessByOwnerId,
  addNotification, getServices
} from '../data/mock';

const BusinessOwnerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Service management state
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: '', description: '', duration: 30, price: 0, category: ''
  });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const refresh = () => setRefreshKey(k => k + 1);

  // Get the business owner's business
  const business = user?.business || getBusinessByOwnerId(user?.id);
  
  // Get data
  const businessServices = business ? getServicesByBusinessId(business.id) : [];
  const allAppointments = business ? getAppointmentsByBusinessId(business.id) : [];
  const pendingAppointments = business ? getPendingAppointmentsByBusinessId(business.id) : [];
  const customers = business ? getCustomersByBusinessId(business.id) : [];

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
      category: service.category
    });
    setShowServiceModal(true);
  };

  const handleServiceSubmit = (e) => {
    e.preventDefault();
    if (editingService) {
      updateService(editingService.id, serviceForm);
    } else {
      addService({
        id: `s_${Date.now()}`,
        businessId: business.id,
        ...serviceForm,
        active: true
      });
    }
    setShowServiceModal(false);
    refresh();
  };

  const handleDeleteService = (serviceId) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      deleteService(serviceId);
      refresh();
    }
  };

  const handleToggleActive = (serviceId) => {
    toggleServiceActive(serviceId);
    refresh();
  };

  // Booking approval functions
  const handleApproveBooking = (appointment) => {
    updateAppointmentStatus(appointment.id, 'confirmed');
    addNotification({
      userId: appointment.userId,
      type: 'booking_confirmed',
      title: 'Booking Confirmed!',
      message: `Your booking for ${appointment.serviceName} on ${appointment.date} at ${appointment.time} has been confirmed by ${business.businessName}.`,
      appointmentId: appointment.id
    });
    refresh();
  };

  const handleDeclineBooking = (appointment) => {
    updateAppointmentStatus(appointment.id, 'declined');
    addNotification({
      userId: appointment.userId,
      type: 'booking_declined',
      title: 'Booking Declined',
      message: `Your booking for ${appointment.serviceName} on ${appointment.date} at ${appointment.time} has been declined by ${business.businessName}.`,
      appointmentId: appointment.id
    });
    refresh();
  };

  // Customer management functions
  const handleDeleteCustomer = (userId) => {
    if (window.confirm('Are you sure you want to delete this customer and all their bookings?')) {
      deleteCustomerBookings(business.id, userId);
      refresh();
    }
  };

  const handleClearHistory = (userId) => {
    if (window.confirm('Are you sure you want to clear this customer\'s history?')) {
      clearCustomerHistory(business.id, userId);
      refresh();
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
      const hasSlots = getAvailability(business?.id, dateStr).length > 0;
      
      days.push({
        day,
        date: dateStr,
        isPast,
        isTooFar,
        hasSlots,
        isToday: date.toDateString() === today.toDateString()
      });
    }

    return days;
  };

  const handleDateClick = (dayInfo) => {
    if (!dayInfo || dayInfo.isPast || dayInfo.isTooFar) return;
    setSelectedDate(dayInfo.date);
    const existingSlots = getAvailability(business?.id, dayInfo.date);
    setSelectedSlots(existingSlots);
  };

  const toggleSlot = (slot) => {
    setSelectedSlots(prev => 
      prev.includes(slot) 
        ? prev.filter(s => s !== slot)
        : [...prev, slot].sort()
    );
  };

  const saveAvailability = () => {
    if (business && selectedDate) {
      setAvailability(business.id, selectedDate, selectedSlots);
      setSelectedDate(null);
      setSelectedSlots([]);
    }
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

  const allTimeSlots = generateTimeSlots();

  const renderContent = () => {
    switch (activeView) {
      case 'calendar':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-semibold">Manage Availability</h2>
              <button onClick={() => setActiveView('dashboard')} className="text-gray-400 hover:text-white transition-colors">
                Back to Dashboard
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => navigateMonth(-1)} className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-white text-lg font-semibold">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <button onClick={() => navigateMonth(1)} className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-gray-500 text-sm font-medium py-2">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {generateCalendarDays().map((dayInfo, index) => (
                  <button
                    key={index}
                    onClick={() => handleDateClick(dayInfo)}
                    disabled={!dayInfo || dayInfo.isPast || dayInfo.isTooFar}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${
                      !dayInfo ? 'bg-transparent cursor-default'
                        : dayInfo.isPast || dayInfo.isTooFar ? 'bg-zinc-800/50 text-gray-600 cursor-not-allowed'
                        : dayInfo.isToday ? 'bg-lime-500 text-black font-bold hover:bg-lime-400'
                        : dayInfo.hasSlots ? 'bg-lime-500/20 text-lime-400 border border-lime-500/50 hover:bg-lime-500/30'
                        : 'bg-zinc-800 text-white hover:bg-zinc-700'
                    }`}
                  >
                    {dayInfo?.day}
                    {dayInfo?.hasSlots && !dayInfo.isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-lime-400 mt-1"></span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-gray-500 text-sm mt-4 text-center">Click on a date to set available time slots</p>
            </div>

            {selectedDate && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-white text-lg font-semibold">
                      Set Availability for {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <button onClick={() => { setSelectedDate(null); setSelectedSlots([]); }} className="text-gray-400 hover:text-white transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="flex gap-2 mb-4">
                      <button onClick={selectAllSlots} className="flex-1 py-2 px-4 bg-lime-500 text-black rounded-lg font-medium hover:bg-lime-400 transition-colors">Select All</button>
                      <button onClick={clearAllSlots} className="flex-1 py-2 px-4 bg-zinc-800 text-white rounded-lg font-medium hover:bg-zinc-700 transition-colors">Clear All</button>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">Select available time slots (15-minute intervals):</p>
                    <div className="grid grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto pr-2">
                      {allTimeSlots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => toggleSlot(slot)}
                          className={`py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                            selectedSlots.includes(slot) ? 'bg-lime-500 text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 border-t border-zinc-800">
                    <p className="text-gray-400 text-sm mb-3">{selectedSlots.length} time slots selected</p>
                    <button onClick={saveAvailability} className="w-full py-3 bg-lime-500 text-black rounded-lg font-semibold hover:bg-lime-400 transition-colors">Save Availability</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'appointments':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-semibold">Appointments</h2>
              <button onClick={() => setActiveView('dashboard')} className="text-gray-400 hover:text-white transition-colors">Back to Dashboard</button>
            </div>
            
            {pendingAppointments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lime-400 text-lg font-semibold mb-3 flex items-center gap-2">
                  <Bell className="w-5 h-5" /> Pending Approval ({pendingAppointments.length})
                </h3>
                <div className="space-y-3">
                  {pendingAppointments.map(appointment => (
                    <div key={appointment.id} className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium">{appointment.serviceName}</h4>
                          <p className="text-gray-400 text-sm">{appointment.date} at {appointment.time}</p>
                          <p className="text-lime-400 text-sm mt-1">Customer: {appointment.customerName}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveBooking(appointment)}
                            className="p-2 bg-lime-500 text-black rounded-lg hover:bg-lime-400 transition-colors"
                            title="Approve"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeclineBooking(appointment)}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-400 transition-colors"
                            title="Decline"
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

            <h3 className="text-white text-lg font-semibold mb-3">All Appointments</h3>
            {allAppointments.filter(a => a.status !== 'pending').length > 0 ? (
              <div className="space-y-3">
                {allAppointments.filter(a => a.status !== 'pending').map(appointment => (
                  <div key={appointment.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-medium">{appointment.serviceName}</h4>
                        <p className="text-gray-500 text-sm">{appointment.date} at {appointment.time}</p>
                        <p className="text-gray-400 text-sm mt-1">Customer: {appointment.customerName}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        appointment.status === 'confirmed' ? 'bg-lime-500/20 text-lime-400'
                        : appointment.status === 'declined' ? 'bg-red-500/20 text-red-400'
                        : appointment.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {appointment.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No appointments yet</p>
              </div>
            )}
          </div>
        );

      case 'services':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-semibold">Your Services</h2>
              <div className="flex gap-2">
                <button
                  onClick={openAddService}
                  className="flex items-center gap-2 bg-lime-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Service
                </button>
                <button onClick={() => setActiveView('dashboard')} className="text-gray-400 hover:text-white transition-colors px-4 py-2">Back</button>
              </div>
            </div>
            
            <div className="space-y-3">
              {businessServices.map(service => (
                <div key={service.id} className={`bg-zinc-900 border rounded-xl p-4 ${service.active ? 'border-zinc-800' : 'border-red-500/30 opacity-60'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium">{service.name}</h4>
                        {!service.active && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Inactive</span>}
                      </div>
                      <p className="text-gray-500 text-sm mt-1">{service.description}</p>
                    </div>
                    <span className="text-lime-400 font-semibold">£{service.price}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-gray-400 text-sm flex items-center gap-1">
                      <Clock className="w-4 h-4" /> {service.duration} min
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(service.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          service.active ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-lime-500/20 text-lime-400 hover:bg-lime-500/30'
                        }`}
                      >
                        {service.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => openEditService(service)}
                        className="p-1.5 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteService(service.id)}
                        className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {businessServices.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                  <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">No services yet</p>
                  <button onClick={openAddService} className="bg-lime-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors">
                    Add Your First Service
                  </button>
                </div>
              )}
            </div>

            {showServiceModal && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-white text-lg font-semibold">{editingService ? 'Edit Service' : 'Add New Service'}</h3>
                    <button onClick={() => setShowServiceModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={handleServiceSubmit} className="p-4 space-y-4">
                    <div>
                      <label className="text-white text-sm mb-2 block">Service Name *</label>
                      <input
                        type="text"
                        value={serviceForm.name}
                        onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-lime-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-white text-sm mb-2 block">Description</label>
                      <textarea
                        value={serviceForm.description}
                        onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-lime-500 resize-none"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-white text-sm mb-2 block">Duration (min) *</label>
                        <input
                          type="number"
                          value={serviceForm.duration}
                          onChange={(e) => setServiceForm({ ...serviceForm, duration: parseInt(e.target.value) })}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-lime-500"
                          min="15"
                          step="15"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-white text-sm mb-2 block">Price (£) *</label>
                        <input
                          type="number"
                          value={serviceForm.price}
                          onChange={(e) => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) })}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-lime-500"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-white text-sm mb-2 block">Category</label>
                      <input
                        type="text"
                        value={serviceForm.category}
                        onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-lime-500"
                        placeholder="e.g., Massage, Skincare, Fitness"
                      />
                    </div>
                    <button type="submit" className="w-full py-3 bg-lime-500 text-black rounded-lg font-semibold hover:bg-lime-400 transition-colors">
                      {editingService ? 'Update Service' : 'Add Service'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        );

      case 'customers':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-semibold">Customers</h2>
              <button onClick={() => setActiveView('dashboard')} className="text-gray-400 hover:text-white transition-colors">Back to Dashboard</button>
            </div>
            
            {customers.length > 0 ? (
              <div className="space-y-4">
                {customers.map(customer => (
                  <div key={customer.userId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-white font-medium">{customer.customerName}</h4>
                        <p className="text-gray-500 text-sm">{customer.bookings.length} bookings</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleClearHistory(customer.userId)}
                          className="px-3 py-1.5 bg-zinc-800 text-white rounded-lg text-sm hover:bg-zinc-700 transition-colors"
                        >
                          Clear History
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer.userId)}
                          className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {customer.bookings.filter(b => b.status !== 'cleared').slice(0, 3).map(booking => {
                        return (
                          <div key={booking.id} className="bg-zinc-800 rounded-lg p-3 flex items-center justify-between">
                            <div>
                              <p className="text-white text-sm">{booking.serviceName}</p>
                              <p className="text-gray-500 text-xs">{booking.date} at {booking.time}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              booking.status === 'confirmed' ? 'bg-lime-500/20 text-lime-400'
                              : booking.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {booking.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No customers yet</p>
              </div>
            )}
          </div>
        );

      case 'settings':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-semibold">Settings</h2>
              <button onClick={() => setActiveView('dashboard')} className="text-gray-400 hover:text-white transition-colors">Back to Dashboard</button>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <Settings className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">Settings page coming soon</p>
            </div>
          </div>
        );

      default:
        return (
          <>
            <div className="mb-8">
              <h2 className="text-white text-2xl font-semibold mb-2">Welcome back, {user?.fullName?.split(' ')[0]}!</h2>
              <p className="text-gray-500">Manage your business and appointments</p>
            </div>

            {pendingAppointments.length > 0 && (
              <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-4 mb-6 cursor-pointer hover:bg-lime-500/20 transition-colors" onClick={() => setActiveView('appointments')}>
                <div className="flex items-center gap-3">
                  <Bell className="w-6 h-6 text-lime-400" />
                  <div>
                    <p className="text-white font-medium">{pendingAppointments.length} booking{pendingAppointments.length > 1 ? 's' : ''} awaiting approval</p>
                    <p className="text-lime-400 text-sm">Click to review and approve</p>
                  </div>
                </div>
              </div>
            )}

            {business && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                    {business.logo ? (
                      <img src={business.logo} alt={`${business.businessName} logo`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Building2 className="w-8 h-8 text-gray-500" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-xl font-semibold mb-1">{business.businessName}</h3>
                    <p className="text-gray-500 text-sm mb-2 break-words">{business.description}</p>
                    {business.postcode && (
                      <div className="flex items-center gap-1 text-gray-400 text-sm">
                        <MapPin className="w-4 h-4 flex-shrink-0" /><span>{business.postcode}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <button onClick={() => setActiveView('calendar')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-lime-500/50 transition-all group">
                <div className="w-12 h-12 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-lime-500/30 transition-colors">
                  <Calendar className="w-6 h-6 text-lime-400" />
                </div>
                <span className="text-white font-medium">Availability</span>
              </button>
              <button onClick={() => setActiveView('appointments')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-lime-500/50 transition-all group relative">
                <div className="w-12 h-12 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-lime-500/30 transition-colors">
                  <Clock className="w-6 h-6 text-lime-400" />
                </div>
                <span className="text-white font-medium">Appointments</span>
                {pendingAppointments.length > 0 && (
                  <span className="absolute top-2 right-2 w-6 h-6 bg-lime-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                    {pendingAppointments.length}
                  </span>
                )}
              </button>
              <button onClick={() => setActiveView('services')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-lime-500/50 transition-all group">
                <div className="w-12 h-12 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-lime-500/30 transition-colors">
                  <Clock className="w-6 h-6 text-lime-400" />
                </div>
                <span className="text-white font-medium">Services</span>
              </button>
              <button onClick={() => setActiveView('customers')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-lime-500/50 transition-all group">
                <div className="w-12 h-12 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-lime-500/30 transition-colors">
                  <Users className="w-6 h-6 text-lime-400" />
                </div>
                <span className="text-white font-medium">Customers</span>
              </button>
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg font-semibold">Recent Appointments</h3>
                <button onClick={() => setActiveView('appointments')} className="text-lime-400 hover:text-lime-300 text-sm flex items-center gap-1 transition-colors">
                  View All <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              {allAppointments.length > 0 ? (
                <div className="space-y-3">
                  {allAppointments.slice(0, 3).map(appointment => (
                    <div key={appointment.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium">{appointment.serviceName}</h4>
                          <p className="text-gray-500 text-sm">{appointment.date} at {appointment.time}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          appointment.status === 'confirmed' ? 'bg-lime-500/20 text-lime-400'
                          : appointment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {appointment.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No appointments yet</p>
                  <button onClick={() => setActiveView('calendar')} className="mt-4 bg-lime-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors">
                    Set Your Availability
                  </button>
                </div>
              )}
            </div>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800">
              {business?.logo ? (
                <img src={business.logo} alt={`${business.businessName} logo`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Building2 className="w-6 h-6 text-gray-500" /></div>
              )}
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">{business?.businessName || 'Booka'}</h1>
              <p className="text-lime-400 text-xs tracking-[0.2em]">BUSINESS DASHBOARD</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white font-medium">{user?.fullName}</p>
              <p className="text-gray-500 text-sm">Business Owner</p>
            </div>
            <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-zinc-700 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default BusinessOwnerDashboard;
