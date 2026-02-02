import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Calendar, Check, Building2, ChevronLeft, ChevronRight, Info, User, Home, Tag, CreditCard, Loader2 } from 'lucide-react';
import { businessAPI, availabilityAPI, paymentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const BusinessPage = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [business, setBusiness] = useState(null);
  const [businessServices, setBusinessServices] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState([]);  // Changed to array for multi-select
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availabilityCache, setAvailabilityCache] = useState({});
  
  // Payment states
  const [offerCode, setOfferCode] = useState('');
  const [offerCodeValid, setOfferCodeValid] = useState(null);
  const [offerCodeMessage, setOfferCodeMessage] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Calculate totals for selected services
  const totalPrice = selectedServices.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + parseInt(s.duration || 30), 0);

  // Check for cancelled payment
  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      setBookingError('Payment was cancelled. Please try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    loadBusinessData();
  }, [businessId]);

  const loadBusinessData = async () => {
    try {
      setLoading(true);
      const [businessRes, servicesRes, staffRes] = await Promise.all([
        businessAPI.getById(businessId),
        businessAPI.getServices(businessId),
        businessAPI.getStaff(businessId).catch(() => ({ data: [] }))
      ]);
      setBusiness(businessRes.data);
      setBusinessServices(servicesRes.data || []);
      setStaffMembers(staffRes.data || []);
    } catch (error) {
      console.error('Failed to load business:', error);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  };

  // Get staff members who can perform ALL selected services
  const getAvailableStaffForServices = () => {
    if (selectedServices.length === 0) return [];
    const selectedServiceIds = selectedServices.map(s => s.id);
    return staffMembers.filter(staff => 
      staff.serviceIds && selectedServiceIds.every(sid => staff.serviceIds.includes(sid))
    );
  };

  const availableStaff = getAvailableStaffForServices();

  const getAvailabilityKey = (dateStr, staffId) => `${dateStr}_${staffId || 'default'}`;

  const getAvailabilityForDate = async (dateStr, staffId = null) => {
    const key = getAvailabilityKey(dateStr, staffId);
    if (availabilityCache[key] !== undefined) {
      return availabilityCache[key];
    }
    try {
      const res = await availabilityAPI.get(businessId, dateStr, staffId);
      const slots = res.data?.slots || [];
      setAvailabilityCache(prev => ({ ...prev, [key]: slots }));
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
      const key = getAvailabilityKey(dateStr, selectedStaff?.id);
      const cachedSlots = availabilityCache[key];
      
      days.push({
        day,
        date: dateStr,
        isPast,
        isTooFar,
        hasSlots: cachedSlots ? cachedSlots.length > 0 : null,
        availableSlots: cachedSlots || [],
        isToday: date.toDateString() === today.toDateString()
      });
    }

    return days;
  };

  // Load availability for visible month when staff is selected
  useEffect(() => {
    if (selectedServices.length > 0 && (availableStaff.length <= 1 || selectedStaff)) {
      loadMonthAvailability();
    }
  }, [selectedServices, currentMonth, selectedStaff]);

  const loadMonthAvailability = async () => {
    const { daysInMonth } = getDaysInMonth(currentMonth);
    const today = new Date();
    const staffId = selectedStaff?.id || (availableStaff.length === 1 ? availableStaff[0]?.id : null);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateStr = date.toISOString().split('T')[0];
      const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const key = getAvailabilityKey(dateStr, staffId);
      
      if (!isPast && availabilityCache[key] === undefined) {
        await getAvailabilityForDate(dateStr, staffId);
      }
    }
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

  const handleServiceToggle = (service) => {
    setSelectedServices(prev => {
      const isSelected = prev.some(s => s.id === service.id);
      if (isSelected) {
        // Remove service
        const newServices = prev.filter(s => s.id !== service.id);
        // Reset downstream selections if no services left
        if (newServices.length === 0) {
          setSelectedStaff(null);
          setSelectedDate(null);
          setSelectedTime('');
          setAvailabilityCache({});
        }
        return newServices;
      } else {
        // Add service
        const newServices = [...prev, service];
        // Reset staff if new service combination changes available staff
        const selectedIds = newServices.map(s => s.id);
        const newAvailableStaff = staffMembers.filter(staff => 
          staff.serviceIds && selectedIds.every(sid => staff.serviceIds.includes(sid))
        );
        if (selectedStaff && !newAvailableStaff.some(s => s.id === selectedStaff.id)) {
          setSelectedStaff(null);
          setSelectedDate(null);
          setSelectedTime('');
        }
        setAvailabilityCache({});
        return newServices;
      }
    });
  };

  const handleProceedToStaff = () => {
    // Auto-select staff if only one available
    if (availableStaff.length === 1) {
      setSelectedStaff(availableStaff[0]);
    }
  };

  const handleStaffSelect = (staff) => {
    setSelectedStaff(staff);
    setSelectedDate(null);
    setSelectedTime('');
    setAvailabilityCache({});
  };

  const handleDateClick = async (dayInfo) => {
    if (!dayInfo || dayInfo.isPast || dayInfo.isTooFar) return;
    
    const staffId = selectedStaff?.id || (availableStaff.length === 1 ? availableStaff[0]?.id : null);
    
    // Fetch availability if not cached
    let slots = dayInfo.availableSlots;
    if (dayInfo.hasSlots === null) {
      slots = await getAvailabilityForDate(dayInfo.date, staffId);
    }
    
    if (slots.length === 0) return;
    
    setSelectedDate({ ...dayInfo, availableSlots: slots, hasSlots: true });
    setSelectedTime('');
  };

  const getGoogleMapsUrl = (postcode) => {
    const encodedPostcode = encodeURIComponent(postcode || '');
    return `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodedPostcode}&zoom=15`;
  };

  // Validate offer code
  const handleValidateOfferCode = async () => {
    if (!offerCode.trim()) {
      setOfferCodeValid(null);
      setOfferCodeMessage('');
      return;
    }
    
    try {
      const res = await paymentAPI.validateOfferCode(offerCode);
      setOfferCodeValid(res.data.valid);
      setOfferCodeMessage(res.data.message);
    } catch (error) {
      setOfferCodeValid(false);
      setOfferCodeMessage('Failed to validate code');
    }
  };

  const handleBooking = async () => {
    if (selectedServices.length === 0 || !selectedDate || !selectedTime) return;
    
    setBookingError('');
    setIsProcessingPayment(true);
    
    const staffId = selectedStaff?.id || (availableStaff.length === 1 ? availableStaff[0]?.id : null);
    
    try {
      // Create checkout session (or bypass with offer code)
      const checkoutRes = await paymentAPI.createCheckout({
        serviceIds: selectedServices.map(s => s.id),
        businessId: business.id,
        staffId: staffId,
        date: selectedDate.date,
        time: selectedTime,
        originUrl: window.location.origin,
        offerCode: offerCodeValid ? offerCode : null
      });
      
      if (checkoutRes.data.bypassed) {
        // Offer code bypass or no deposit required - complete booking directly
        await paymentAPI.completeBooking({
          transactionId: checkoutRes.data.transactionId
        });
        
        setBookingSuccess(true);
        
        // Clear cache for this date
        const key = getAvailabilityKey(selectedDate.date, staffId);
        setAvailabilityCache(prev => {
          const newCache = { ...prev };
          delete newCache[key];
          return newCache;
        });
        
        setTimeout(() => {
          setBookingSuccess(false);
          setSelectedServices([]);
          setSelectedStaff(null);
          setSelectedDate(null);
          setSelectedTime('');
          setOfferCode('');
          setOfferCodeValid(null);
        }, 4000);
      } else {
        // Redirect to Stripe checkout
        window.location.href = checkoutRes.data.url;
      }
    } catch (error) {
      console.error('Booking/Payment failed:', error);
      setBookingError(error.response?.data?.detail || 'Failed to process booking. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Calculate deposit amount based on business settings
  const depositPercentage = business?.depositPercentage ?? 20;
  const depositAmount = selectedServices.length > 0 ? (totalPrice * (depositPercentage / 100)).toFixed(2) : 0;
  const isNoDeposit = depositPercentage === 0;
  const isFullPayment = depositPercentage === 100;
  
  // Get deposit label
  const getDepositLabel = () => {
    if (isNoDeposit) return 'No deposit required';
    if (isFullPayment) return 'Full payment required';
    return `${depositPercentage}% deposit`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500"></div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Business not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-lime-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const calendarDays = generateCalendarDays();
  const showStaffSelection = selectedServices.length > 0 && availableStaff.length > 1;
  const canShowCalendar = selectedServices.length > 0 && (availableStaff.length <= 1 || selectedStaff);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white hover:bg-zinc-700 transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            {/* Business Logo & Name */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800">
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
              <div>
                <h1 className="text-white text-xl font-bold">{business.businessName}</h1>
                <p className="text-gray-500 text-sm">{business.description}</p>
              </div>
            </div>
          </div>

          {/* Home Button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 bg-lime-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Success Message */}
        {bookingSuccess && (
          <div className="bg-lime-500/10 border border-lime-500/50 text-lime-400 px-4 py-4 rounded-xl mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-lime-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="font-medium">Booking Request Sent!</p>
                <p className="text-sm text-lime-400/80 mt-1">
                  Your booking request has been sent to {business.businessName}. 
                  You will receive a notification once they confirm your appointment.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {bookingError && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-4 rounded-xl mb-6">
            <p>{bookingError}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Services & Booking */}
          <div>
            {/* Services */}
            <div className="mb-8">
              <h2 className="text-white text-lg font-semibold mb-4">Select a Service</h2>
              {businessServices.length > 0 ? (
                <div className="space-y-3">
                  {businessServices.map(service => (
                    <button
                      key={service.id}
                      onClick={() => handleServiceSelect(service)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedService?.id === service.id
                          ? 'bg-lime-500/10 border-lime-500'
                          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-white font-medium">{service.name}</h4>
                        <span className="text-lime-400 font-semibold">£{service.price}</span>
                      </div>
                      <p className="text-gray-500 text-sm mb-2">{service.description}</p>
                      <span className="text-gray-400 text-sm flex items-center gap-1">
                        <Clock className="w-4 h-4" /> {service.duration} min
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                  <Info className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No services available at the moment</p>
                </div>
              )}
            </div>

            {/* Staff Selection - Show if multiple staff can perform the service */}
            {showStaffSelection && (
              <div className="mb-8">
                <h2 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-lime-400" /> Select Staff Member
                </h2>
                <div className="space-y-3">
                  {availableStaff.map(staff => (
                    <button
                      key={staff.id}
                      onClick={() => handleStaffSelect(staff)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedStaff?.id === staff.id
                          ? 'bg-lime-500/10 border-lime-500'
                          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
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
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calendar - Show after selecting service (and staff if required) */}
            {canShowCalendar && (
              <div className="mb-8">
                <h2 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-lime-400" /> Select Date
                </h2>
                
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
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
                        disabled={!dayInfo || dayInfo.isPast || dayInfo.isTooFar || dayInfo.hasSlots === false}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all ${
                          !dayInfo
                            ? 'bg-transparent cursor-default'
                            : dayInfo.isPast || dayInfo.isTooFar
                            ? 'bg-zinc-800/50 text-gray-600 cursor-not-allowed'
                            : dayInfo.hasSlots === false
                            ? 'bg-zinc-800/50 text-gray-600 cursor-not-allowed'
                            : selectedDate?.date === dayInfo.date
                            ? 'bg-lime-500 text-black font-bold'
                            : dayInfo.isToday
                            ? 'bg-lime-500/30 text-lime-400 font-bold hover:bg-lime-500/40'
                            : dayInfo.hasSlots === true
                            ? 'bg-zinc-800 text-white hover:bg-zinc-700'
                            : 'bg-zinc-800 text-white hover:bg-zinc-700'
                        }`}
                      >
                        {dayInfo?.day}
                        {dayInfo?.hasSlots === true && selectedDate?.date !== dayInfo.date && (
                          <span className="w-1 h-1 rounded-full bg-lime-400 mt-0.5"></span>
                        )}
                      </button>
                    ))}
                  </div>
                  
                  <p className="text-gray-500 text-xs mt-3 text-center">
                    Green dots indicate available slots
                  </p>
                </div>
              </div>
            )}

            {/* Time Selection */}
            {selectedDate && selectedDate.availableSlots.length > 0 && (
              <div className="mb-8">
                <h2 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-lime-400" /> Select Time
                </h2>
                <div className="grid grid-cols-4 gap-2">
                  {selectedDate.availableSlots.map(time => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        selectedTime === time
                          ? 'bg-lime-500 text-black'
                          : 'bg-zinc-900 border border-zinc-800 text-white hover:border-zinc-700'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Guidance Messages */}
            {selectedService && showStaffSelection && !selectedStaff && (
              <p className="text-gray-500 text-sm text-center py-4">
                Please select a staff member to see available times
              </p>
            )}

            {canShowCalendar && !selectedDate && (
              <p className="text-gray-500 text-sm text-center py-4">
                Select a date with available slots (marked with green dots)
              </p>
            )}

            {/* Payment & Booking Section */}
            {selectedTime && (
              <div className="space-y-4">
                {/* Offer Code Input - only show if deposit is required */}
                {!isNoDeposit && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-lime-400" /> Have an offer code?
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={offerCode}
                        onChange={(e) => {
                          setOfferCode(e.target.value.toUpperCase());
                          setOfferCodeValid(null);
                          setOfferCodeMessage('');
                        }}
                        placeholder="Enter code"
                        className="flex-1 bg-zinc-800 border border-zinc-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-lime-500"
                      />
                      <button
                        onClick={handleValidateOfferCode}
                        className="bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                    {offerCodeMessage && (
                      <p className={`text-sm mt-2 ${offerCodeValid ? 'text-lime-400' : 'text-red-400'}`}>
                        {offerCodeMessage}
                      </p>
                    )}
                  </div>
                )}

                {/* Booking Summary */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-lime-400" /> Booking Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-400">
                      <span>Service</span>
                      <span className="text-white">{selectedService.name}</span>
                    </div>
                    {selectedStaff && (
                      <div className="flex justify-between text-gray-400">
                        <span>Staff</span>
                        <span className="text-white">{selectedStaff.name}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-400">
                      <span>Date & Time</span>
                      <span className="text-white">{selectedDate.date} at {selectedTime}</span>
                    </div>
                    <div className="border-t border-zinc-800 my-2"></div>
                    <div className="flex justify-between text-gray-400">
                      <span>Full Price</span>
                      <span className="text-white">£{selectedService.price}</span>
                    </div>
                    {isNoDeposit && !offerCodeValid && (
                      <div className="flex justify-between text-lime-400 font-medium">
                        <span>Deposit</span>
                        <span>Not required</span>
                      </div>
                    )}
                    {!isNoDeposit && !offerCodeValid && (
                      <div className="flex justify-between text-lime-400 font-medium">
                        <span>{isFullPayment ? 'Payment' : `Deposit (${depositPercentage}%)`}</span>
                        <span>£{depositAmount}</span>
                      </div>
                    )}
                    {offerCodeValid && (
                      <div className="flex justify-between text-lime-400 font-medium">
                        <span>Deposit</span>
                        <span>£0.00 (Code Applied)</span>
                      </div>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-3">
                    {offerCodeValid 
                      ? "Your offer code will bypass the deposit requirement."
                      : isNoDeposit
                        ? "No deposit is required for this business."
                        : isFullPayment
                          ? "Full payment is required to secure your booking."
                          : `A ${depositPercentage}% non-refundable deposit is required to secure your booking.`
                    }
                  </p>
                </div>

                {/* Book Button */}
                <button
                  onClick={handleBooking}
                  disabled={isProcessingPayment}
                  className="w-full bg-lime-500 text-black font-semibold py-4 rounded-lg hover:bg-lime-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : offerCodeValid || isNoDeposit ? (
                    <>
                      <Check className="w-5 h-5" />
                      {isNoDeposit ? 'Confirm Booking' : 'Complete Booking (Free)'}
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      {isFullPayment ? `Pay £${selectedService.price} & Book` : `Pay Deposit £${depositAmount} & Book`}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Map & Location */}
          <div>
            <div className="mb-4">
              <h2 className="text-white text-lg font-semibold mb-2 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-lime-400" /> Location
              </h2>
              {business.address && (
                <p className="text-gray-500 text-sm mb-2">{business.address}</p>
              )}
              <p className="text-gray-400 text-sm">{business.postcode}</p>
            </div>
            
            {/* Google Map */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <iframe
                title={`${business.businessName} location`}
                src={getGoogleMapsUrl(business.postcode)}
                width="100%"
                height="400"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="rounded-xl"
              />
            </div>

            {/* Business Info Card */}
            <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800">
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
                <div>
                  <h3 className="text-white font-semibold">{business.businessName}</h3>
                  <p className="text-lime-400 text-sm">{businessServices.length} services available</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm">{business.description}</p>
              
              {/* Staff Members */}
              {staffMembers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <p className="text-gray-500 text-sm mb-2">Team ({staffMembers.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {staffMembers.map(staff => (
                      <span key={staff.id} className="px-2 py-1 bg-zinc-800 text-gray-300 text-xs rounded">
                        {staff.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BusinessPage;
