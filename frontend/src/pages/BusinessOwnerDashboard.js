import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, Clock, Users, Settings, ChevronRight, ChevronLeft, Building2, MapPin, X } from 'lucide-react';
import { mockServices, mockAppointments, mockBusinesses, generateTimeSlots, setAvailability, getAvailability } from '../data/mock';

const BusinessOwnerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSlots, setSelectedSlots] = useState([]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Get the business owner's business
  const business = user?.business || mockBusinesses.find(b => b.ownerId === user?.id);
  
  // Get appointments for this business
  const businessAppointments = mockAppointments.filter(apt => apt.businessId === business?.id);
  
  // Get services for this business
  const businessServices = business?.services 
    ? mockServices.filter(s => business.services.includes(s.id))
    : [];

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

    // Empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Days of the month
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

  const selectAllSlots = () => {
    setSelectedSlots(generateTimeSlots());
  };

  const clearAllSlots = () => {
    setSelectedSlots([]);
  };

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

  // Render different views
  const renderContent = () => {
    switch (activeView) {
      case 'calendar':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-semibold">Manage Availability</h2>
              <button
                onClick={() => setActiveView('dashboard')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Back to Dashboard
              </button>
            </div>

            {/* Calendar */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-white text-lg font-semibold">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-gray-500 text-sm font-medium py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2">
                {generateCalendarDays().map((dayInfo, index) => (
                  <button
                    key={index}
                    onClick={() => handleDateClick(dayInfo)}
                    disabled={!dayInfo || dayInfo.isPast || dayInfo.isTooFar}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${
                      !dayInfo
                        ? 'bg-transparent cursor-default'
                        : dayInfo.isPast || dayInfo.isTooFar
                        ? 'bg-zinc-800/50 text-gray-600 cursor-not-allowed'
                        : dayInfo.isToday
                        ? 'bg-lime-500 text-black font-bold hover:bg-lime-400'
                        : dayInfo.hasSlots
                        ? 'bg-lime-500/20 text-lime-400 border border-lime-500/50 hover:bg-lime-500/30'
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

              <p className="text-gray-500 text-sm mt-4 text-center">
                Click on a date to set available time slots (up to 6 months ahead)
              </p>
            </div>

            {/* Time Slot Modal */}
            {selectedDate && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-white text-lg font-semibold">
                      Set Availability for {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <button
                      onClick={() => { setSelectedDate(null); setSelectedSlots([]); }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={selectAllSlots}
                        className="flex-1 py-2 px-4 bg-lime-500 text-black rounded-lg font-medium hover:bg-lime-400 transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={clearAllSlots}
                        className="flex-1 py-2 px-4 bg-zinc-800 text-white rounded-lg font-medium hover:bg-zinc-700 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                    
                    <p className="text-gray-400 text-sm mb-3">
                      Select available time slots (15-minute intervals):
                    </p>
                    
                    <div className="grid grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto pr-2">
                      {allTimeSlots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => toggleSlot(slot)}
                          className={`py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                            selectedSlots.includes(slot)
                              ? 'bg-lime-500 text-black'
                              : 'bg-zinc-800 text-white hover:bg-zinc-700'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-4 border-t border-zinc-800">
                    <p className="text-gray-400 text-sm mb-3">
                      {selectedSlots.length} time slots selected
                    </p>
                    <button
                      onClick={saveAvailability}
                      className="w-full py-3 bg-lime-500 text-black rounded-lg font-semibold hover:bg-lime-400 transition-colors"
                    >
                      Save Availability
                    </button>
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
              <button
                onClick={() => setActiveView('dashboard')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
            
            {businessAppointments.length > 0 ? (
              <div className="space-y-3">
                {businessAppointments.map(appointment => {
                  const service = mockServices.find(s => s.id === appointment.serviceId);
                  return (
                    <div key={appointment.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium">{service?.name}</h4>
                          <p className="text-gray-500 text-sm">{appointment.date} at {appointment.time}</p>
                          <p className="text-lime-400 text-sm mt-1">Customer: {appointment.customerName || 'N/A'}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          appointment.status === 'confirmed' 
                            ? 'bg-lime-500/20 text-lime-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {appointment.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
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
              <button
                onClick={() => setActiveView('dashboard')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
            
            <div className="space-y-3">
              {businessServices.map(service => (
                <div key={service.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-white font-medium">{service.name}</h4>
                    <span className="text-lime-400 font-semibold">£{service.price}</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-3">{service.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm flex items-center gap-1">
                      <Clock className="w-4 h-4" /> {service.duration} min
                    </span>
                    <button className="bg-lime-500/20 text-lime-400 px-4 py-1.5 rounded-lg text-sm hover:bg-lime-500/30 transition-colors">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'customers':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-semibold">Customers</h2>
              <button
                onClick={() => setActiveView('dashboard')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">Customer management coming soon</p>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-semibold">Settings</h2>
              <button
                onClick={() => setActiveView('dashboard')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Back to Dashboard
              </button>
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
            {/* Welcome Section */}
            <div className="mb-8">
              <h2 className="text-white text-2xl font-semibold mb-2">Welcome back, {user?.fullName?.split(' ')[0]}!</h2>
              <p className="text-gray-500">Manage your business and appointments</p>
            </div>

            {/* Business Info Card */}
            {business && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
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
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-xl font-semibold mb-1">{business.businessName}</h3>
                    <p className="text-gray-500 text-sm mb-2 break-words">{business.description}</p>
                    {business.postcode && (
                      <div className="flex items-center gap-1 text-gray-400 text-sm">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span>{business.postcode}</span>
                      </div>
                    )}
                  </div>
                  <button className="bg-lime-500/20 text-lime-400 px-4 py-2 rounded-lg text-sm hover:bg-lime-500/30 transition-colors flex-shrink-0">
                    Edit Profile
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <button 
                onClick={() => setActiveView('calendar')}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-lime-500/50 transition-all group"
              >
                <div className="w-12 h-12 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-lime-500/30 transition-colors">
                  <Calendar className="w-6 h-6 text-lime-400" />
                </div>
                <span className="text-white font-medium">Availability</span>
              </button>
              <button 
                onClick={() => setActiveView('appointments')}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-lime-500/50 transition-all group"
              >
                <div className="w-12 h-12 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-lime-500/30 transition-colors">
                  <Clock className="w-6 h-6 text-lime-400" />
                </div>
                <span className="text-white font-medium">Appointments</span>
              </button>
              <button 
                onClick={() => setActiveView('services')}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-lime-500/50 transition-all group"
              >
                <div className="w-12 h-12 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-lime-500/30 transition-colors">
                  <Users className="w-6 h-6 text-lime-400" />
                </div>
                <span className="text-white font-medium">Services</span>
              </button>
              <button 
                onClick={() => setActiveView('settings')}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-lime-500/50 transition-all group"
              >
                <div className="w-12 h-12 bg-lime-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-lime-500/30 transition-colors">
                  <Settings className="w-6 h-6 text-lime-400" />
                </div>
                <span className="text-white font-medium">Settings</span>
              </button>
            </div>

            {/* Upcoming Appointments */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg font-semibold">Upcoming Appointments</h3>
                <button 
                  onClick={() => setActiveView('appointments')}
                  className="text-lime-400 hover:text-lime-300 text-sm flex items-center gap-1 transition-colors"
                >
                  View All <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              {businessAppointments.length > 0 ? (
                <div className="space-y-3">
                  {businessAppointments.slice(0, 3).map(appointment => {
                    const service = mockServices.find(s => s.id === appointment.serviceId);
                    return (
                      <div key={appointment.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-white font-medium">{service?.name}</h4>
                            <p className="text-gray-500 text-sm">{appointment.date} at {appointment.time}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            appointment.status === 'confirmed' 
                              ? 'bg-lime-500/20 text-lime-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {appointment.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No upcoming appointments</p>
                  <button 
                    onClick={() => setActiveView('calendar')}
                    className="mt-4 bg-lime-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
                  >
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
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Business Logo */}
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800">
              {business?.logo ? (
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
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default BusinessOwnerDashboard;
