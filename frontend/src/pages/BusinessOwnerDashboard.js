import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, User, Settings, Clock, ChevronRight, Building2, MapPin } from 'lucide-react';
import { mockServices, mockAppointments, mockBusinesses } from '../data/mock';

const BusinessOwnerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
              <p className="text-gray-500 text-xs tracking-[0.2em]">BUSINESS DASHBOARD</p>
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
              <div className="flex-1">
                <h3 className="text-white text-xl font-semibold mb-1">{business.businessName}</h3>
                <p className="text-gray-500 text-sm mb-2">{business.description}</p>
                {business.postcode && (
                  <div className="flex items-center gap-1 text-gray-400 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>{business.postcode}</span>
                  </div>
                )}
              </div>
              <button className="bg-white/10 text-white px-4 py-2 rounded-lg text-sm hover:bg-white/20 transition-colors">
                Edit Profile
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-zinc-700 transition-all group">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-white/20 transition-colors">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-medium">Appointments</span>
          </button>
          <button className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-zinc-700 transition-all group">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-white/20 transition-colors">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-medium">Services</span>
          </button>
          <button className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-zinc-700 transition-all group">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-white/20 transition-colors">
              <User className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-medium">Customers</span>
          </button>
          <button className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-zinc-700 transition-all group">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-white/20 transition-colors">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-medium">Settings</span>
          </button>
        </div>

        {/* Upcoming Appointments */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-semibold">Upcoming Appointments</h3>
            <button className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          {businessAppointments.length > 0 ? (
            <div className="space-y-3">
              {businessAppointments.map(appointment => {
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
                          ? 'bg-green-500/20 text-green-400'
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
            </div>
          )}
        </div>

        {/* Your Services */}
        <div>
          <h3 className="text-white text-lg font-semibold mb-4">Your Services</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {businessServices.map(service => (
              <div key={service.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-medium">{service.name}</h4>
                  <span className="text-white font-semibold">£{service.price}</span>
                </div>
                <p className="text-gray-500 text-sm mb-3">{service.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm flex items-center gap-1">
                    <Clock className="w-4 h-4" /> {service.duration} min
                  </span>
                  <button className="bg-white/10 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-white/20 transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default BusinessOwnerDashboard;
