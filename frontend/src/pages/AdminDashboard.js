import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';
import { 
  LogOut, Users, Building2, Calendar, CreditCard, BarChart3, 
  ChevronRight, Check, X, Edit2, Trash2, Eye, AlertTriangle,
  PoundSterling, RefreshCw, Shield, Clock
} from 'lucide-react';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role !== 'platform_admin') {
      navigate('/');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [statsRes, usersRes, businessesRes, subsRes, appointmentsRes] = await Promise.all([
        adminAPI.getStats().catch(() => ({ data: {} })),
        adminAPI.getUsers().catch(() => ({ data: [] })),
        adminAPI.getBusinesses().catch(() => ({ data: [] })),
        adminAPI.getSubscriptions().catch(() => ({ data: [] })),
        adminAPI.getAppointments().catch(() => ({ data: [] }))
      ]);
      setStats(statsRes.data || {});
      setUsers(usersRes.data || []);
      setBusinesses(businessesRes.data || []);
      setSubscriptions(subsRes.data || []);
      setAppointments(appointmentsRes.data || []);
    } catch (err) {
      console.error('Load data error:', err);
      setError('Failed to load some data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // User actions
  const handleSuspendUser = async (userId, suspend) => {
    try {
      await adminAPI.updateUser(userId, { 
        suspended: suspend,
        suspendedReason: suspend ? 'Suspended by admin' : null
      });
      loadData();
    } catch (err) {
      setError('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      await adminAPI.deleteUser(userId);
      loadData();
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  // Business actions
  const handleApproveBusiness = async (businessId) => {
    try {
      await adminAPI.updateBusiness(businessId, { approved: true });
      loadData();
    } catch (err) {
      setError('Failed to approve business');
    }
  };

  const handleRejectBusiness = async (businessId, reason) => {
    try {
      await adminAPI.updateBusiness(businessId, { rejected: true, rejectedReason: reason || 'Not approved' });
      loadData();
    } catch (err) {
      setError('Failed to reject business');
    }
  };

  const handleDeleteBusiness = async (businessId) => {
    if (!window.confirm('Are you sure you want to delete this business? This will also delete all associated data.')) return;
    try {
      await adminAPI.deleteBusiness(businessId);
      loadData();
    } catch (err) {
      setError('Failed to delete business');
    }
  };

  // Subscription actions
  const handleUpdateSubscription = async (subId, status) => {
    try {
      await adminAPI.updateSubscription(subId, { status });
      loadData();
    } catch (err) {
      setError('Failed to update subscription');
    }
  };

  const handleToggleFreeAccess = async (subId, grant) => {
    try {
      await adminAPI.grantFreeAccess(subId, grant);
      loadData();
    } catch (err) {
      setError('Failed to update free access');
    }
  };

  // Refund action
  const handleRefund = async (appointmentId, amount) => {
    try {
      await adminAPI.refundAppointment(appointmentId, amount);
      loadData();
    } catch (err) {
      setError('Failed to issue refund');
    }
  };

  const pendingBusinesses = businesses.filter(b => !b.approved && !b.rejected);
  const failedPaymentSubs = subscriptions.filter(s => s.lastPaymentStatus === 'failed');

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
        </div>
      );
    }

    switch (activeView) {
      case 'users':
        return (
          <div>
            <h2 className="text-white text-xl font-semibold mb-6">User Management</h2>
            
            {/* Filters */}
            <div className="flex gap-2 mb-6">
              <button className="px-4 py-2 bg-brand-500 text-black rounded-lg font-medium">All Users</button>
              <button className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700">Customers ({users.filter(u => u.role === 'customer').length})</button>
              <button className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700">Business Owners ({users.filter(u => u.role === 'business_owner').length})</button>
            </div>

            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className={`bg-cardBg border rounded-xl p-4 ${u.suspended ? 'border-red-500/50' : 'border-zinc-800'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        u.role === 'business_owner' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {u.role === 'business_owner' ? <Building2 className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium">{u.fullName}</h4>
                          {u.suspended && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Suspended</span>}
                        </div>
                        <p className="text-gray-500 text-sm">{u.email}</p>
                        <p className="text-gray-600 text-xs mt-1 capitalize">{u.role.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSuspendUser(u.id, !u.suspended)}
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                          u.suspended 
                            ? 'bg-brand-500/20 text-brand-400 hover:bg-brand-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        }`}
                      >
                        {u.suspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'businesses':
        return (
          <div>
            <h2 className="text-white text-xl font-semibold mb-6">Business Management</h2>
            
            {/* Pending Approvals */}
            {pendingBusinesses.length > 0 && (
              <div className="mb-8">
                <h3 className="text-brand-400 text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Pending Approval ({pendingBusinesses.length})
                </h3>
                <div className="space-y-3">
                  {pendingBusinesses.map(b => (
                    <div key={b.id} className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden">
                            {b.logo ? (
                              <img src={b.logo} alt={b.businessName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-gray-500" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-white font-medium">{b.businessName}</h4>
                            <p className="text-gray-400 text-sm">{b.description}</p>
                            <p className="text-gray-500 text-xs mt-1">Owner: {b.owner?.fullName || 'Unknown'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproveBusiness(b.id)}
                            className="px-4 py-2 bg-brand-500 text-black rounded-lg font-medium hover:bg-brand-400 flex items-center gap-2"
                          >
                            <Check className="w-4 h-4" /> Approve
                          </button>
                          <button
                            onClick={() => handleRejectBusiness(b.id, 'Does not meet requirements')}
                            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 flex items-center gap-2"
                          >
                            <X className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Businesses */}
            <h3 className="text-white text-lg font-semibold mb-4">All Businesses</h3>
            <div className="space-y-3">
              {businesses.map(b => (
                <div key={b.id} className={`bg-cardBg border rounded-xl p-4 ${
                  b.rejected ? 'border-red-500/50' : b.approved ? 'border-zinc-800' : 'border-yellow-500/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden">
                        {b.logo ? (
                          <img src={b.logo} alt={b.businessName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium">{b.businessName}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            b.rejected ? 'bg-red-500/20 text-red-400' 
                            : b.approved ? 'bg-brand-500/20 text-brand-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {b.rejected ? 'Rejected' : b.approved ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-gray-500 text-sm">{b.postcode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!b.approved && !b.rejected && (
                        <button
                          onClick={() => handleApproveBusiness(b.id)}
                          className="p-1.5 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteBusiness(b.id)}
                        className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'subscriptions':
        return (
          <div>
            <h2 className="text-white text-xl font-semibold mb-6">Subscriptions</h2>
            
            {/* Failed Payments Alert */}
            {failedPaymentSubs.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                  <div>
                    <p className="text-white font-medium">{failedPaymentSubs.length} Failed Payment(s)</p>
                    <p className="text-red-400/80 text-sm">These businesses may have restricted access</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {subscriptions.map(sub => (
                <div key={sub.id} className={`bg-cardBg border rounded-xl p-4 ${
                  sub.lastPaymentStatus === 'failed' ? 'border-red-500/50' 
                  : sub.freeAccessOverride ? 'border-brand-500/50'
                  : sub.status === 'active' ? 'border-zinc-800' 
                  : sub.status === 'trial' ? 'border-yellow-500/50'
                  : 'border-yellow-500/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium">{sub.business?.businessName || 'Unknown Business'}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded uppercase ${
                          sub.freeAccessOverride ? 'bg-brand-500/20 text-brand-400'
                          : sub.status === 'active' ? 'bg-brand-500/20 text-brand-400'
                          : sub.status === 'trial' ? 'bg-yellow-500/20 text-yellow-400'
                          : sub.status === 'past_due' ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                        }`}>
                          {sub.freeAccessOverride ? 'FREE ACCESS' : sub.status}
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">
                        Staff: {sub.staffCount || 1} • £{sub.priceMonthly?.toFixed(2) || '14.00'}/month
                        {sub.status === 'trial' && sub.trialDaysRemaining > 0 && (
                          <span className="text-yellow-400 ml-2">({sub.trialDaysRemaining} trial days left)</span>
                        )}
                      </p>
                      {sub.lastPaymentStatus === 'failed' && (
                        <p className="text-red-400 text-sm mt-1">Failed payments: {sub.failedPayments}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleFreeAccess(sub.id, !sub.freeAccessOverride)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          sub.freeAccessOverride 
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-brand-500/20 text-brand-400 hover:bg-brand-500/30'
                        }`}
                      >
                        {sub.freeAccessOverride ? 'Revoke Free' : 'Grant Free'}
                      </button>
                      <select
                        value={sub.status}
                        onChange={(e) => handleUpdateSubscription(sub.id, e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-sm"
                      >
                        <option value="trial">Trial</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="past_due">Past Due</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              {subscriptions.length === 0 && (
                <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                  <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No subscriptions yet</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'bookings':
        return (
          <div>
            <h2 className="text-white text-xl font-semibold mb-6">All Bookings</h2>
            
            <div className="space-y-3">
              {appointments.map(apt => (
                <div key={apt.id} className="bg-cardBg border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">{apt.serviceName}</h4>
                      <p className="text-gray-400 text-sm">{apt.businessName}</p>
                      <p className="text-gray-500 text-sm mt-1">{apt.date} at {apt.time}</p>
                      <p className="text-gray-600 text-xs mt-1">Customer: {apt.customerName}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          apt.status === 'confirmed' ? 'bg-brand-500/20 text-brand-400'
                          : apt.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400'
                          : apt.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400'
                          : 'bg-red-500/20 text-red-400'
                        }`}>
                          {apt.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          apt.paymentStatus === 'full_paid' ? 'bg-brand-500/20 text-brand-400'
                          : apt.paymentStatus === 'deposit_paid' ? 'bg-blue-500/20 text-blue-400'
                          : apt.paymentStatus === 'refunded' ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {apt.paymentStatus.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-white font-medium">£{apt.paymentAmount}</p>
                      {apt.paymentStatus !== 'refunded' && apt.paymentStatus !== 'pending' && (
                        <button
                          onClick={() => handleRefund(apt.id, apt.paymentAmount)}
                          className="text-purple-400 text-sm hover:text-purple-300 mt-2"
                        >
                          Issue Refund
                        </button>
                      )}
                      {apt.paymentStatus === 'refunded' && (
                        <p className="text-purple-400 text-sm mt-2">Refunded: £{apt.refundedAmount}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {appointments.length === 0 && (
                <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No bookings yet</p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-cardBg border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Total Users</p>
                    <p className="text-white text-2xl font-bold">{stats?.totalUsers || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-cardBg border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Businesses</p>
                    <p className="text-white text-2xl font-bold">{stats?.totalBusinesses || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-cardBg border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-500/20 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Bookings</p>
                    <p className="text-white text-2xl font-bold">{stats?.totalAppointments || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-cardBg border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Active Subs</p>
                    <p className="text-white text-2xl font-bold">{stats?.activeSubscriptions || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {stats?.pendingBusinesses > 0 && (
                <div 
                  onClick={() => setActiveView('businesses')}
                  className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 cursor-pointer hover:bg-yellow-500/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-yellow-400" />
                    <div>
                      <p className="text-white font-medium">{stats.pendingBusinesses} Business(es) Pending Approval</p>
                      <p className="text-yellow-400/80 text-sm">Click to review</p>
                    </div>
                  </div>
                </div>
              )}
              {stats?.failedPayments > 0 && (
                <div 
                  onClick={() => setActiveView('subscriptions')}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 cursor-pointer hover:bg-red-500/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <PoundSterling className="w-6 h-6 text-red-400" />
                    <div>
                      <p className="text-white font-medium">{stats.failedPayments} Failed Payment(s)</p>
                      <p className="text-red-400/80 text-sm">Click to manage</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <h3 className="text-white text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button 
                onClick={() => setActiveView('users')}
                className="bg-cardBg border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-brand-500/50 transition-all group"
              >
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-500/30">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <span className="text-white font-medium">Manage Users</span>
              </button>
              <button 
                onClick={() => setActiveView('businesses')}
                className="bg-cardBg border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-brand-500/50 transition-all group"
              >
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-500/30">
                  <Building2 className="w-6 h-6 text-purple-400" />
                </div>
                <span className="text-white font-medium">Businesses</span>
              </button>
              <button 
                onClick={() => setActiveView('subscriptions')}
                className="bg-cardBg border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-brand-500/50 transition-all group"
              >
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-green-500/30">
                  <CreditCard className="w-6 h-6 text-green-400" />
                </div>
                <span className="text-white font-medium">Subscriptions</span>
              </button>
              <button 
                onClick={() => setActiveView('bookings')}
                className="bg-cardBg border border-zinc-800 rounded-xl p-4 text-center hover:bg-zinc-800 hover:border-brand-500/50 transition-all group"
              >
                <div className="w-12 h-12 bg-brand-500/20 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-brand-500/30">
                  <Calendar className="w-6 h-6 text-brand-400" />
                </div>
                <span className="text-white font-medium">Bookings</span>
              </button>
            </div>
          </>
        );
    }
  };

  if (user?.role !== 'platform_admin') {
    return (
      <div className="min-h-screen bg-appbg flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-4">You don't have permission to access this page.</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-brand-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-brand-400"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-appbg">
      {/* Header */}
      <header className="bg-cardBg border-b border-zinc-800 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_appointly-24/artifacts/syzj4nzu_1770417348108.png" 
              alt="Calendrax" 
              className="h-10"
              style={{ filter: 'brightness(0.35) contrast(1.5) sepia(0.3)' }}
            />
            <div>
              <h1 className="text-white text-xl font-bold">Calendrax Admin</h1>
              <p className="text-brand-400 text-xs tracking-[0.2em]">PLATFORM ADMIN</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={loadData}
              className="p-2 bg-zinc-800 rounded-lg text-gray-400 hover:text-white hover:bg-zinc-700"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <div className="text-right">
              <p className="text-white font-medium">{user?.fullName}</p>
              <p className="text-gray-500 text-sm">Administrator</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-zinc-700"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-cardBg/50 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {['overview', 'users', 'businesses', 'subscriptions', 'bookings'].map(view => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`px-4 py-3 font-medium whitespace-nowrap transition-colors ${
                  activeView === view
                    ? 'text-brand-400 border-b-2 border-brand-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
            <p className="text-red-400">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default AdminDashboard;
