import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, User, Settings, Clock, ChevronRight } from 'lucide-react';
import { mockServices, mockAppointments } from '../data/mock';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const userAppointments = mockAppointments.filter(apt => apt.userId === user?.id);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-bold">Booka</h1>
            <p className="text-gray-500 text-xs tracking-[0.2em]">BOOKING APP</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white font-medium">{user?.fullName}</p>
              <p className="text-gray-500 text-sm capitalize">{user?.role?.replace('_', ' ')}</p>
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
          <p className="text-gray-500">Manage your bookings and appointments</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-zinc-700 transition-all group">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-white/20 transition-colors">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-medium">Book Now</span>
          </button>
          <button className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-zinc-700 transition-all group">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-white/20 transition-colors">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-medium">My Bookings</span>
          </button>
          <button className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-zinc-700 transition-all group">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-white/20 transition-colors">
              <User className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-medium">Profile</span>
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
          
          {userAppointments.length > 0 ? (
            <div className="space-y-3">
              {userAppointments.map(appointment => {
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
              <button className="mt-4 bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                Book Your First Appointment
              </button>
            </div>
          )}
        </div>

        {/* Available Services */}
        <div>
          <h3 className="text-white text-lg font-semibold mb-4">Available Services</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {mockServices.map(service => (
              <div key={service.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-medium">{service.name}</h4>
                  <span className="text-white font-semibold">${service.price}</span>
                </div>
                <p className="text-gray-500 text-sm mb-3">{service.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm flex items-center gap-1">
                    <Clock className="w-4 h-4" /> {service.duration} min
                  </span>
                  <button className="bg-white/10 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-white/20 transition-colors">
                    Book
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

export default Dashboard;
