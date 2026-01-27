import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Calendar, Check, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { mockBusinesses, mockServices, getAvailability, addAppointment } from '../data/mock';
import { useAuth } from '../context/AuthContext';

const BusinessPage = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const business = useMemo(() => 
    mockBusinesses.find(b => b.id === businessId),
    [businessId]
  );

  const businessServices = useMemo(() => {
    if (!business) return [];
    return mockServices.filter(s => business.services.includes(s.id));
  }, [business]);

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
      const availableSlots = getAvailability(business?.id, dateStr);
      const hasSlots = availableSlots.length > 0;
      
      days.push({
        day,
        date: dateStr,
        isPast,
        isTooFar,
        hasSlots,
        availableSlots,
        isToday: date.toDateString() === today.toDateString()
      });
    }

    return days;
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

  const handleDateClick = (dayInfo) => {
    if (!dayInfo || dayInfo.isPast || dayInfo.isTooFar || !dayInfo.hasSlots) return;
    setSelectedDate(dayInfo);
    setSelectedTime('');
  };

  const getGoogleMapsUrl = (postcode) => {
    const encodedPostcode = encodeURIComponent(postcode);
    return `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodedPostcode}&zoom=15`;
  };

  const handleBooking = () => {
    if (selectedService && selectedDate && selectedTime) {
      const newAppointment = {
        id: `apt_${Date.now()}`,
        userId: user?.id,
        businessId: business.id,
        serviceId: selectedService.id,
        date: selectedDate.date,
        time: selectedTime,
        status: 'confirmed',
        customerName: user?.fullName
      };
      
      addAppointment(newAppointment);
      setBookingSuccess(true);
      
      setTimeout(() => {
        setBookingSuccess(false);
        setSelectedService(null);
        setSelectedDate(null);
        setSelectedTime('');
      }, 3000);
    }
  };

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

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white hover:bg-zinc-700 transition-colors"
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
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Success Message */}
        {bookingSuccess && (
          <div className="bg-lime-500/10 border border-lime-500/50 text-lime-400 px-4 py-4 rounded-xl mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-lime-500 rounded-full flex items-center justify-center">
              <Check className="w-5 h-5 text-black" />
            </div>
            <div>
              <p className="font-medium">Booking Confirmed!</p>
              <p className="text-sm text-lime-400/80">Your appointment has been scheduled successfully.</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Services & Booking */}
          <div>
            {/* Services */}
            <div className="mb-8">
              <h2 className="text-white text-lg font-semibold mb-4">Select a Service</h2>
              <div className="space-y-3">
                {businessServices.map(service => (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
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
            </div>

            {/* Calendar - Show after selecting service */}
            {selectedService && (
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
                    {generateCalendarDays().map((dayInfo, index) => (
                      <button
                        key={index}
                        onClick={() => handleDateClick(dayInfo)}
                        disabled={!dayInfo || dayInfo.isPast || dayInfo.isTooFar || !dayInfo.hasSlots}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all ${
                          !dayInfo
                            ? 'bg-transparent cursor-default'
                            : dayInfo.isPast || dayInfo.isTooFar
                            ? 'bg-zinc-800/50 text-gray-600 cursor-not-allowed'
                            : !dayInfo.hasSlots
                            ? 'bg-zinc-800/50 text-gray-600 cursor-not-allowed'
                            : selectedDate?.date === dayInfo.date
                            ? 'bg-lime-500 text-black font-bold'
                            : dayInfo.isToday
                            ? 'bg-lime-500/30 text-lime-400 font-bold hover:bg-lime-500/40'
                            : 'bg-zinc-800 text-white hover:bg-zinc-700'
                        }`}
                      >
                        {dayInfo?.day}
                        {dayInfo?.hasSlots && selectedDate?.date !== dayInfo.date && (
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

            {/* No Slots Message */}
            {selectedService && !selectedDate && (
              <p className="text-gray-500 text-sm text-center py-4">
                Select a date with available slots (marked with green dots)
              </p>
            )}

            {/* Book Button */}
            {selectedTime && (
              <button
                onClick={handleBooking}
                className="w-full bg-lime-500 text-black font-semibold py-4 rounded-lg hover:bg-lime-400 transition-colors"
              >
                Book {selectedService.name} - £{selectedService.price}
              </button>
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BusinessPage;
