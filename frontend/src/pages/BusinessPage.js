import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Calendar, Check, Building2 } from 'lucide-react';
import { mockBusinesses, mockServices } from '../data/mock';

const BusinessPage = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const business = useMemo(() => 
    mockBusinesses.find(b => b.id === businessId),
    [businessId]
  );

  const businessServices = useMemo(() => {
    if (!business) return [];
    return mockServices.filter(s => business.services.includes(s.id));
  }, [business]);

  const availableTimes = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00'
  ];

  const getGoogleMapsUrl = (postcode) => {
    const encodedPostcode = encodeURIComponent(postcode);
    return `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodedPostcode}&zoom=15`;
  };

  const handleBooking = () => {
    if (selectedService && selectedDate && selectedTime) {
      // In real app, would call API to create booking
      setBookingSuccess(true);
      setTimeout(() => {
        setBookingSuccess(false);
        setSelectedService(null);
        setSelectedDate('');
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
            className="bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
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
          <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-4 rounded-xl mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium">Booking Confirmed!</p>
              <p className="text-sm text-green-400/80">Your appointment has been scheduled successfully.</p>
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
                        ? 'bg-white/10 border-white'
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-white font-medium">{service.name}</h4>
                      <span className="text-white font-semibold">£{service.price}</span>
                    </div>
                    <p className="text-gray-500 text-sm mb-2">{service.description}</p>
                    <span className="text-gray-400 text-sm flex items-center gap-1">
                      <Clock className="w-4 h-4" /> {service.duration} min
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time Selection */}
            {selectedService && (
              <div className="space-y-6">
                {/* Date */}
                <div>
                  <h2 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5" /> Select Date
                  </h2>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                </div>

                {/* Time */}
                {selectedDate && (
                  <div>
                    <h2 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" /> Select Time
                    </h2>
                    <div className="grid grid-cols-4 gap-2">
                      {availableTimes.map(time => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                            selectedTime === time
                              ? 'bg-white text-black'
                              : 'bg-zinc-900 border border-zinc-800 text-white hover:border-zinc-700'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Book Button */}
                {selectedTime && (
                  <button
                    onClick={handleBooking}
                    className="w-full bg-white text-black font-semibold py-4 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Book {selectedService.name} - £{selectedService.price}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Map & Location */}
          <div>
            <div className="mb-4">
              <h2 className="text-white text-lg font-semibold mb-2 flex items-center gap-2">
                <MapPin className="w-5 h-5" /> Location
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
                  <p className="text-gray-500 text-sm">{businessServices.length} services available</p>
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
