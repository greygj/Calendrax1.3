import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, Clock, Users, Settings, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Building2, MapPin, X, Plus, Edit2, Trash2, Bell, Check, XCircle, User, UserPlus, Save, CreditCard, Banknote, ExternalLink, AlertCircle, TrendingUp, TrendingDown, PoundSterling, BarChart3, AlertTriangle, PieChart, Activity, RefreshCw, ArrowUpRight, ArrowDownRight, Image, Upload, Loader2, FileText, Download, Receipt, Home, Smartphone, Lock, Mail, MessageCircle, Eye, EyeOff, Gift, Copy, CheckCircle, ShieldAlert } from 'lucide-react';
import { serviceAPI, availabilityAPI, appointmentAPI, notificationAPI, staffAPI, businessAPI, stripeConnectAPI, subscriptionAPI, revenueAPI, payoutAPI, analyticsAPI, billingAPI, authAPI, referralAPI, stripeAPI } from '../services/api';
import { formatDate } from '../utils/dateFormat';
import InstallPrompt from '../components/InstallPrompt';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// Card element options
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#ffffff',
      '::placeholder': { color: '#6b7280' },
      backgroundColor: 'transparent'
    },
    invalid: { color: '#ef4444' }
  }
};

// Reactivate Payment Form Component
const ReactivatePaymentForm = ({ onSuccess, onError, reactivating, setReactivating }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !cardComplete) return;

    setReactivating(true);
    onError('');

    try {
      // Create setup intent
      const setupRes = await stripeAPI.createSetupIntent();
      const clientSecret = setupRes.data.clientSecret;

      // Confirm card setup
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)
        }
      });

      if (stripeError) {
        onError(stripeError.message);
        setReactivating(false);
        return;
      }

      // Call reactivate endpoint
      const reactivateRes = await billingAPI.reactivateAccount(setupIntent.payment_method);
      
      if (reactivateRes.data.success) {
        onSuccess();
      } else {
        onError('Failed to reactivate account. Please try again.');
      }
    } catch (err) {
      console.error('Reactivation error:', err);
      onError(err.response?.data?.detail || 'Payment failed. Please try again.');
    } finally {
      setReactivating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="text-gray-400 text-sm mb-2 block">Card Details</label>
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
          <CardElement 
            options={cardElementOptions}
            onChange={(e) => {
              setCardComplete(e.complete);
              setCardError(e.error ? e.error.message : '');
            }}
          />
        </div>
        {cardError && <p className="text-red-400 text-xs mt-1">{cardError}</p>}
      </div>
      
      <button
        type="submit"
        disabled={!stripe || !cardComplete || reactivating}
        className="w-full bg-brand-500 text-black font-bold py-3 rounded-lg hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {reactivating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Add Card & Reactivate Account
          </>
        )}
      </button>
      
      <p className="text-gray-500 text-xs mt-3 text-center">
        Your subscription fee will be charged immediately to reactivate your account.
      </p>
    </form>
  );
};

const BusinessOwnerDashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  
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
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  
  // Staff management state
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({ name: '', serviceIds: [] });
  const [showStaffConfirmModal, setShowStaffConfirmModal] = useState(false);
  const [staffConfirmData, setStaffConfirmData] = useState(null);
  const [pendingStaffAction, setPendingStaffAction] = useState(null);
  
  // Analytics sub-tab state
  const [analyticsSubTab, setAnalyticsSubTab] = useState('overview');
  
  // Services & Staff sub-tab state
  const [servicesSubTab, setServicesSubTab] = useState('services');
  
  // Revenue state
  const [revenueSummary, setRevenueSummary] = useState(null);
  const [staffRevenue, setStaffRevenue] = useState(null);
  const [serviceRevenue, setServiceRevenue] = useState(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  
  // Payout History state
  const [payoutHistory, setPayoutHistory] = useState(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  
  // Analytics state
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // Billing state
  const [billingInvoices, setBillingInvoices] = useState([]);
  const [billingUpcoming, setBillingUpcoming] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  
  // Customer detail state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDeleteCustomerModal, setShowDeleteCustomerModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  
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
  const [newCustomerCredentials, setNewCustomerCredentials] = useState(null);
  
  // Profile state
  const [profileForm, setProfileForm] = useState({
    businessName: '', description: '', postcode: '', address: '', phone: '', email: '', website: '', depositLevel: '20', photos: [], logo: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  
  // Referral state
  const [referralInfo, setReferralInfo] = useState(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [centurionCardExpanded, setCenturionCardExpanded] = useState(false);
  
  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  
  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailReminders: true,
    whatsappReminders: true
  });
  const logoInputRef = useRef(null);
  
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Frozen account state
  const [accountFrozen, setAccountFrozen] = useState(user?.accountFrozen || false);
  const [frozenMessage, setFrozenMessage] = useState(user?.frozenMessage || '');
  const [reactivating, setReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState('');

  const business = user?.business || businessData;

  // Check for Stripe redirect
  useEffect(() => {
    if (searchParams.get('stripe_connected') === 'true') {
      loadStripeStatus();
      alert('Stripe account connected successfully!');
    }
    if (searchParams.get('subscription_success') === 'true') {
      loadSubscription();
      alert('Subscription payment method added successfully! Your subscription is now active.');
    }
    if (searchParams.get('subscription_cancelled') === 'true') {
      alert('Subscription setup was cancelled. You can add a payment method anytime from your Profile.');
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
    loadStripeStatus();
    loadSubscription();
    loadReferralInfo();
  }, []);

  const loadReferralInfo = async () => {
    try {
      const res = await referralAPI.getMyInfo();
      setReferralInfo(res.data);
    } catch (error) {
      console.error('Failed to load referral info:', error);
    }
  };

  const copyReferralCode = () => {
    if (referralInfo?.referralCode) {
      navigator.clipboard.writeText(referralInfo.referralCode);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    }
  };

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
          depositLevel: businessRes.data.depositLevel || '20',
          photos: businessRes.data.photos || [],
          logo: businessRes.data.logo || ''
        });
      }
      
      // Auto-create owner as staff if no staff exists
      if ((staffRes.data || []).length === 0 && businessRes.data) {
        await createOwnerAsStaff(businessRes.data);
      }
      
      // Load notification preferences
      await loadNotificationPreferences();
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
      const errorMessage = error.response?.data?.detail || 'Failed to start Stripe onboarding. Please try again.';
      alert(errorMessage);
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

  // ========== SUBSCRIPTION PAYMENT ==========
  const handleSetupSubscriptionPayment = async () => {
    setSubscriptionLoading(true);
    try {
      const res = await subscriptionAPI.setupPayment();
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (error) {
      console.error('Subscription payment setup error:', error);
      alert('Failed to setup subscription payment. Please try again.');
    } finally {
      setSubscriptionLoading(false);
    }
  };
  
  // ========== PASSWORD CHANGE ==========
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    
    setPasswordSaving(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (error) {
      setPasswordError(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };
  
  // ========== NOTIFICATION PREFERENCES ==========
  const loadNotificationPreferences = async () => {
    try {
      const res = await authAPI.getNotificationPreferences();
      setNotificationPrefs(res.data);
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  };
  
  const handleToggleNotificationPref = async (key) => {
    const newValue = !notificationPrefs[key];
    setNotificationPrefs(prev => ({ ...prev, [key]: newValue }));
    
    try {
      await authAPI.updateNotificationPreferences({ [key]: newValue });
    } catch (error) {
      // Revert on error
      setNotificationPrefs(prev => ({ ...prev, [key]: !newValue }));
      console.error('Failed to update notification preference:', error);
    }
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
      // Get preview of subscription change and future bookings count
      const [preview, bookingsRes] = await Promise.all([
        staffAPI.previewSubscriptionChange('remove'),
        staffAPI.getFutureBookingsCount(staffId)
      ]);
      
      setStaffConfirmData({
        type: 'delete',
        staffName: staff.name,
        futureBookingsCount: bookingsRes.data.futureBookingsCount,
        ...preview.data
      });
      setPendingStaffAction({ type: 'delete', staffId: staffId });
      setShowStaffConfirmModal(true);
    } catch (error) {
      console.error('Failed to preview subscription change:', error);
      alert(error.response?.data?.detail || 'Failed to process request.');
    }
  };

  // ========== REVENUE ==========
  const loadRevenue = async () => {
    setRevenueLoading(true);
    try {
      const [summaryRes, staffRes, serviceRes, monthlyRes] = await Promise.all([
        revenueAPI.getSummary(),
        revenueAPI.getByStaff(),
        revenueAPI.getByService(),
        revenueAPI.getMonthly()
      ]);
      setRevenueSummary(summaryRes.data);
      setStaffRevenue(staffRes.data);
      setServiceRevenue(serviceRes.data);
      setMonthlyRevenue(monthlyRes.data);
    } catch (error) {
      console.error('Failed to load revenue data:', error);
    } finally {
      setRevenueLoading(false);
    }
  };

  // ========== CUSTOMER MANAGEMENT ==========
  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      const response = await appointmentAPI.deleteCustomer(customerToDelete.id);
      setShowDeleteCustomerModal(false);
      setCustomerToDelete(null);
      setSelectedCustomer(null);
      
      // Show detailed success message
      const data = response.data;
      let message = `${customerToDelete.name}'s future bookings have been deleted.`;
      if (data.preservedAppointments > 0) {
        message += `\n\n${data.preservedAppointments} past booking(s) preserved for revenue tracking (£${data.preservedRevenue?.toFixed(2) || '0.00'}).`;
      }
      alert(message);
      
      loadData(); // Refresh data
    } catch (error) {
      console.error('Failed to delete customer:', error);
      alert('Failed to delete customer. Please try again.');
    }
  };

  // ========== PAYOUTS ==========
  const loadPayouts = async () => {
    setPayoutLoading(true);
    try {
      const res = await payoutAPI.getHistory();
      setPayoutHistory(res.data);
    } catch (error) {
      console.error('Failed to load payout history:', error);
    } finally {
      setPayoutLoading(false);
    }
  };

  // ========== ANALYTICS ==========
  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await analyticsAPI.getAdvanced();
      setAnalytics(res.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // ========== BILLING FUNCTIONS ==========
  const loadBilling = async () => {
    setBillingLoading(true);
    try {
      const [invoicesRes, upcomingRes] = await Promise.all([
        billingAPI.getInvoices(),
        billingAPI.getUpcoming()
      ]);
      setBillingInvoices(invoicesRes.data.invoices || []);
      setBillingUpcoming(upcomingRes.data.upcoming);
    } catch (error) {
      console.error('Failed to load billing:', error);
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'analytics') {
      if (analyticsSubTab === 'revenue') {
        loadRevenue();
      } else if (analyticsSubTab === 'payouts') {
        loadPayouts();
      } else if (analyticsSubTab === 'billing') {
        loadBilling();
      } else {
        loadAnalytics();
      }
    }
  }, [activeView, analyticsSubTab]);

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
      const response = await appointmentAPI.bookForCustomer({
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
      
      // Check if a new customer was created
      if (response.data.newCustomerCreated && response.data.customerCredentials) {
        setNewCustomerCredentials(response.data.customerCredentials);
      } else {
        alert('Booking created successfully!');
      }
    } catch (error) {
      console.error('Failed to create booking:', error);
      alert(error.response?.data?.detail || 'Failed to create booking.');
    }
  };

  // ========== PROFILE ==========
  const photoInputRef = useRef(null);
  
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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be less than 5MB');
      return;
    }

    // Get the slot index and whether this is a replace operation
    const slotIndex = parseInt(photoInputRef.current?.dataset?.slot || '0', 10);
    const isReplace = photoInputRef.current?.dataset?.replace === 'true';

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await businessAPI.uploadPhoto(formData);
      const photoUrl = response.data.url;

      let newPhotos;
      if (isReplace && slotIndex < profileForm.photos.length) {
        // Replace existing photo at the slot
        newPhotos = [...profileForm.photos];
        newPhotos[slotIndex] = photoUrl;
      } else {
        // Add new photo
        newPhotos = [...profileForm.photos];
        // Ensure array is at least as long as the slot index
        while (newPhotos.length <= slotIndex) {
          newPhotos.push(null);
        }
        newPhotos[slotIndex] = photoUrl;
        // Filter out null values for storage (keep array compact)
        newPhotos = newPhotos.filter(p => p !== null);
      }
      
      setProfileForm({ ...profileForm, photos: newPhotos });

      // Save to backend
      await businessAPI.updateMine({ ...profileForm, photos: newPhotos });
      alert('Photo uploaded successfully!');
    } catch (error) {
      console.error('Failed to upload photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setPhotoUploading(false);
      // Reset input
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
        delete photoInputRef.current.dataset.slot;
        delete photoInputRef.current.dataset.replace;
      }
    }
  };

  const handlePhotoRemove = async (indexToRemove) => {
    const newPhotos = profileForm.photos.filter((_, index) => index !== indexToRemove);
    setProfileForm({ ...profileForm, photos: newPhotos });

    try {
      await businessAPI.updateMine({ ...profileForm, photos: newPhotos });
    } catch (error) {
      console.error('Failed to remove photo:', error);
    }
  };

  // ========== LOGO UPLOAD ==========
  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Check file size (max 2MB for logos)
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be less than 2MB');
      return;
    }

    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await businessAPI.uploadPhoto(formData);
      const logoUrl = response.data.url;

      setProfileForm({ ...profileForm, logo: logoUrl });

      // Save to backend
      await businessAPI.updateMine({ ...profileForm, logo: logoUrl });
      
      // Update local business data
      setBusinessData(prev => ({ ...prev, logo: logoUrl }));
      
      alert('Logo uploaded successfully!');
    } catch (error) {
      console.error('Failed to upload logo:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setLogoUploading(false);
      // Reset input
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleLogoRemove = async () => {
    setProfileForm({ ...profileForm, logo: '' });
    setBusinessData(prev => ({ ...prev, logo: '' }));

    try {
      await businessAPI.updateMine({ ...profileForm, logo: '' });
    } catch (error) {
      console.error('Failed to remove logo:', error);
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
    const newCacheEntries = {};
    
    // Collect all dates that need to be fetched
    const datesToFetch = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateStr = date.toISOString().split('T')[0];
      const key = getAvailabilityKey(dateStr, selectedStaff?.id);
      
      if (availabilityCache[key] === undefined) {
        datesToFetch.push({ dateStr, key });
      }
    }
    
    // Fetch all dates in parallel for better performance
    const results = await Promise.all(
      datesToFetch.map(async ({ dateStr, key }) => {
        try {
          const res = await availabilityAPI.get(business.id, dateStr, selectedStaff?.id);
          return { key, slots: res.data?.slots || [] };
        } catch {
          return { key, slots: [] };
        }
      })
    );
    
    // Batch update the cache
    results.forEach(({ key, slots }) => {
      newCacheEntries[key] = slots;
    });
    
    if (Object.keys(newCacheEntries).length > 0) {
      setAvailabilityCache(prev => ({ ...prev, ...newCacheEntries }));
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
    for (let hour = 5; hour < 23; hour++) {
      for (let min = 0; min < 60; min += 5) {
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

  // Helper to check if date has passed
  const isDatePassed = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(dateStr);
    return appointmentDate < today;
  };

  // State for appointment view tab
  const [appointmentTab, setAppointmentTab] = useState('current');

  // Filter appointments - separate upcoming from past
  const pendingAppointments = allAppointments.filter(a => a.status === 'pending' && !isDatePassed(a.date));
  const confirmedAppointments = allAppointments.filter(a => a.status === 'confirmed' && !isDatePassed(a.date));
  const historyAppointments = allAppointments.filter(a => 
    a.status === 'cancelled' || 
    a.status === 'declined' || 
    a.status === 'completed' ||
    isDatePassed(a.date)
  ).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending

  // Calculate today's and tomorrow's bookings
  const getTodayDateStr = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };
  
  const getTomorrowDateStr = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };
  
  const todayStr = getTodayDateStr();
  const tomorrowStr = getTomorrowDateStr();
  
  const bookingsToday = allAppointments.filter(a => 
    a.date === todayStr && (a.status === 'confirmed' || a.status === 'pending')
  ).length;
  
  const bookingsTomorrow = allAppointments.filter(a => 
    a.date === tomorrowStr && (a.status === 'confirmed' || a.status === 'pending')
  ).length;

  const bookingsTotal = allAppointments.filter(a => 
    (a.status === 'confirmed' || a.status === 'pending') && !isDatePassed(a.date)
  ).length;

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
      <div className="min-h-screen bg-appbg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-appbg">
      {/* Frozen Account Overlay */}
      {accountFrozen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-cardBg border border-red-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Account Frozen</h2>
              <p className="text-gray-400">{frozenMessage}</p>
            </div>
            
            <div className="bg-zinc-900 rounded-xl p-4 mb-6">
              <p className="text-gray-300 text-sm mb-4">
                To reactivate your account and regain access to your bookings and customers, please add a valid payment method below.
              </p>
              
              <Elements stripe={stripePromise}>
                <ReactivatePaymentForm 
                  onSuccess={() => {
                    setAccountFrozen(false);
                    setFrozenMessage('');
                    updateUser({ accountFrozen: false, frozenMessage: null });
                    loadSubscription();
                  }}
                  onError={(err) => setReactivateError(err)}
                  reactivating={reactivating}
                  setReactivating={setReactivating}
                />
              </Elements>
              
              {reactivateError && (
                <p className="text-red-400 text-sm mt-3 text-center">{reactivateError}</p>
              )}
            </div>
            
            <div className="text-center">
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="text-gray-500 hover:text-gray-400 text-sm"
              >
                Logout and return to homepage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install Prompt Modal */}
      {showInstallPrompt && (
        <InstallPrompt onClose={() => setShowInstallPrompt(false)} />
      )}

      {/* Header */}
      <header className="bg-cardBg border-b border-zinc-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('dashboard')}>
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
              <div className="flex items-center gap-2">
                <h1 className="text-white text-xl font-bold">{business?.businessName || 'Calendrax'}</h1>
                {referralInfo?.isCenturion && (
                  <img 
                    src="/calendrax-centurion-logo.png" 
                    alt="Centurion" 
                    className="w-6 h-6 object-contain"
                    title="Centurion Member"
                  />
                )}
              </div>
              <p className="text-gray-500 text-sm">Business Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-cardBg border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-white font-semibold">Notifications</h3>
                    {unreadNotifications.length > 0 && (
                      <button onClick={handleMarkAllRead} className="text-brand-400 text-sm hover:text-brand-300">
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
                          !notif.read ? 'bg-brand-500/5' : ''
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

            {/* Back to Dashboard button - show on sub-views */}
            {activeView !== 'dashboard' && (
              <button
                onClick={() => setActiveView('dashboard')}
                className="p-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                title="Back to Dashboard"
              >
                <Home className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Dashboard View */}
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            {/* Trial Warning Banner - Show for trial users without payment method */}
            {subscription && subscription.status === 'trial' && !subscription.hasPaymentMethod && !subscription.freeAccessOverride && (
              <div className="bg-gradient-to-r from-red-500/20 via-red-500/10 to-red-500/20 border-2 border-red-500/50 rounded-xl p-4 animate-pulse-slow" data-testid="trial-warning-banner">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-red-400 font-bold text-lg">Add Payment Method</h3>
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {subscription.trialDaysRemaining} days left
                      </span>
                    </div>
                    <p className="text-red-200/80 text-sm mb-3">
                      Your free trial ends on <span className="font-semibold text-white">{subscription.trialEndDate ? new Date(subscription.trialEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'soon'}</span>. 
                      Add your payment details now to avoid losing access to your account and bookings.
                    </p>
                    <button
                      onClick={() => setActiveView('profile')}
                      className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                      data-testid="add-payment-btn"
                    >
                      <CreditCard className="w-4 h-4" />
                      Add Payment Method Now
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Business Info Card */}
            <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                  {business?.logo ? (
                    <img src={business.logo} alt={business.businessName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-white text-xl font-bold truncate">{business?.businessName}</h2>
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{business?.description}</p>
                  {business?.postcode && (
                    <div className="flex items-center gap-1 mt-2">
                      <MapPin className="w-4 h-4 text-brand-400" />
                      <span className="text-gray-500 text-sm">{business.postcode}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pending Appointments Alert */}
            {pendingAppointments.length > 0 && (
              <button
                onClick={() => setActiveView('appointments')}
                className="w-full bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-4 text-left hover:bg-yellow-500/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-yellow-400 font-medium">{pendingAppointments.length} Pending Booking{pendingAppointments.length > 1 ? 's' : ''}</p>
                      <p className="text-yellow-400/70 text-sm">Tap to review requests</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-yellow-400" />
                </div>
              </button>
            )}

            {/* Centurion Hub Card - Only for Centurions */}
            {referralInfo?.isCenturion && (
              <div className="border border-amber-500/30 rounded-xl overflow-hidden bg-gradient-to-br from-amber-900/30 via-slate-800/50 to-slate-900/50">
                {/* Clickable Header */}
                <button
                  onClick={() => setCenturionCardExpanded(!centurionCardExpanded)}
                  className="w-full p-4 text-left hover:bg-amber-500/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <img 
                      src="/calendrax-centurion-logo.png" 
                      alt="Centurion" 
                      className="w-14 h-14 object-contain"
                    />
                    <div className="flex-1">
                      <p className="text-amber-400 font-bold text-lg">
                        Congratulations you are Calendrax Centurion {referralInfo.referralCode?.replace('CC', '')}!
                      </p>
                      <p className="text-gray-400 text-sm">Tap to view your Centurion benefits & referrals</p>
                    </div>
                    {centurionCardExpanded ? (
                      <ChevronUp className="w-6 h-6 text-amber-400" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-amber-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {centurionCardExpanded && (
                  <div className="border-t border-amber-500/20 animate-in slide-in-from-top duration-300">
                    {/* Centurion Offers & News Section */}
                    <div className="p-4 bg-black/20">
                      <h4 className="text-amber-400 font-semibold mb-2 flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Centurion News & Offers
                      </h4>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                        <p className="text-gray-300 text-sm">
                          <span className="text-amber-400 font-semibold">LIFETIME FREE SUBSCRIPTION:</span> Make 10 referrals before we reach 500 subscribed businesses!
                        </p>
                      </div>
                    </div>
                    
                    {/* Referral Section */}
                    <div className="p-4">
                      <h4 className="text-amber-400 font-semibold mb-3 flex items-center gap-2">
                        <Gift className="w-4 h-4" />
                        Your Referral Program
                      </h4>
                      
                      {/* Referral Code */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-gray-400 text-sm">Your Code:</span>
                        <span className="font-mono font-bold text-lg text-amber-400">
                          {referralInfo.referralCode}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyReferralCode();
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            referralCopied 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'hover:bg-amber-500/20 text-amber-400'
                          }`}
                          title={referralCopied ? 'Copied!' : 'Copy code'}
                        >
                          {referralCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      
                      <p className="text-amber-400/70 text-xs mb-3">
                        Share your code! You'll earn 2 free months when a referred business pays their first subscription.
                      </p>
                    </div>
                    
                    {/* Stats Section */}
                    <div className="px-4 py-3 grid grid-cols-4 gap-2 bg-black/20">
                      <div className="text-center">
                        <p className={`text-xl font-bold ${referralInfo.referralCredits > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                          {referralInfo.referralCredits}
                        </p>
                        <p className="text-gray-500 text-xs">Credits</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-white">{referralInfo.totalReferrals || 0}</p>
                        <p className="text-gray-500 text-xs">Referrals</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-amber-400">
                          {referralInfo.creditsEarned || 0}
                        </p>
                        <p className="text-gray-500 text-xs">Earned</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-purple-400">{referralInfo.creditsUsed || 0}</p>
                        <p className="text-gray-500 text-xs">Used</p>
                      </div>
                    </div>
                    
                    {/* Referred Businesses List */}
                    {referralInfo.referredBusinesses && referralInfo.referredBusinesses.length > 0 && (
                      <div className="px-4 py-3 border-t border-amber-500/20">
                        <p className="text-gray-400 text-xs mb-2">Your Referrals:</p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {referralInfo.referredBusinesses.map((ref, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-white text-sm">{ref.businessName}</span>
                                {ref.isCenturion && (
                                  <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">CC</span>
                                )}
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                ref.status === 'active' 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {ref.status === 'active' ? 'Paid' : 'Pending'}
                              </span>
                            </div>
                          ))}
                        </div>
                        {referralInfo.pendingReferrals > 0 && (
                          <p className="text-yellow-400/70 text-xs mt-2">
                            {referralInfo.pendingReferrals} referral{referralInfo.pendingReferrals > 1 ? 's' : ''} pending first payment
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Progress to Lifetime Free */}
                    <div className="p-4 border-t border-amber-500/20 bg-black/20">
                      <p className="text-gray-400 text-xs mb-2">Progress to Lifetime Free Subscription:</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all"
                            style={{ width: `${Math.min(((referralInfo.totalReferrals || 0) / 10) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-amber-400 text-sm font-bold">{referralInfo.totalReferrals || 0}/10</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons - Full Width for Mobile */}
            <div className="space-y-3">
              <button
                onClick={() => setActiveView('appointments')}
                className="w-full bg-cardBg border border-zinc-800 text-white p-4 rounded-xl font-medium hover:bg-zinc-800 hover:border-brand-500/50 transition-all flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block">Appointments</span>
                  <span className="text-gray-500 text-sm">Today: {bookingsToday} · Tomorrow: {bookingsTomorrow} · Total: {bookingsTotal}</span>
                </div>
                {pendingAppointments.length > 0 && (
                  <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full mr-2">
                    {pendingAppointments.length}
                  </span>
                )}
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>

              <button
                onClick={() => setActiveView('availability')}
                className="w-full bg-cardBg border border-zinc-800 text-white p-4 rounded-xl font-medium hover:bg-zinc-800 hover:border-brand-500/50 transition-all flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block">Availability</span>
                  <span className="text-gray-500 text-sm">Set your working hours</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>

              <button
                onClick={() => setActiveView('services')}
                className="w-full bg-cardBg border border-zinc-800 text-white p-4 rounded-xl font-medium hover:bg-zinc-800 hover:border-brand-500/50 transition-all flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block">Services & Staff</span>
                  <span className="text-gray-500 text-sm">{businessServices.length} services, {staffMembers.length} staff</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>

              <button
                onClick={() => setActiveView('customers')}
                className="w-full bg-cardBg border border-zinc-800 text-white p-4 rounded-xl font-medium hover:bg-zinc-800 hover:border-brand-500/50 transition-all flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block">Customers</span>
                  <span className="text-gray-500 text-sm">{customers.length} customers</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>

              <button
                onClick={() => setActiveView('analytics')}
                className="w-full bg-cardBg border border-zinc-800 text-white p-4 rounded-xl font-medium hover:bg-zinc-800 hover:border-brand-500/50 transition-all flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block">Analytics</span>
                  <span className="text-gray-500 text-sm">Revenue & performance</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>

              <button
                onClick={() => setActiveView('profile')}
                className="w-full bg-cardBg border border-zinc-800 text-white p-4 rounded-xl font-medium hover:bg-zinc-800 hover:border-brand-500/50 transition-all flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 text-left">
                  <span className="block">Profile & Settings</span>
                  <span className="text-gray-500 text-sm">Business info, payments, subscription</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Centurion/Referral Card */}
            {referralInfo && (
              <div className={`border rounded-xl overflow-hidden ${
                referralInfo.isCenturion 
                  ? 'bg-gradient-to-br from-amber-900/30 via-slate-800/50 to-slate-900/50 border-amber-500/30' 
                  : 'bg-cardBg border-zinc-800'
              }`}>
                {/* Main Info Section */}
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Logo */}
                    {referralInfo.isCenturion && (
                      <img 
                        src="/calendrax-centurion-logo.png" 
                        alt="Centurion" 
                        className="w-16 h-16 object-contain"
                      />
                    )}
                    {!referralInfo.isCenturion && (
                      <div className="w-16 h-16 rounded-xl bg-brand-500/10 flex items-center justify-center">
                        <Gift className="w-8 h-8 text-brand-400" />
                      </div>
                    )}
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-semibold ${referralInfo.isCenturion ? 'text-amber-400' : 'text-brand-400'}`}>
                          {referralInfo.isCenturion ? 'Centurion Member' : 'Referral Program'}
                        </span>
                      </div>
                      
                      {/* Referral Code */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">Your Code:</span>
                        <span className={`font-mono font-bold text-lg ${referralInfo.isCenturion ? 'text-amber-400' : 'text-white'}`}>
                          {referralInfo.referralCode}
                        </span>
                        <button
                          onClick={copyReferralCode}
                          className={`p-1.5 rounded-lg transition-colors ${
                            referralCopied 
                              ? 'bg-green-500/20 text-green-400' 
                              : referralInfo.isCenturion 
                                ? 'hover:bg-amber-500/20 text-amber-400' 
                                : 'hover:bg-zinc-700 text-gray-400'
                          }`}
                          title={referralCopied ? 'Copied!' : 'Copy code'}
                        >
                          {referralCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Info text */}
                  <p className={`text-xs mt-3 ${referralInfo.isCenturion ? 'text-amber-400/70' : 'text-gray-500'}`}>
                    Share your code! You'll earn {referralInfo.isCenturion ? '2' : '1'} free month{referralInfo.isCenturion ? 's' : ''} when a referred business pays their first subscription.
                  </p>
                </div>
                
                {/* Stats Section */}
                <div className={`px-4 py-3 grid grid-cols-4 gap-2 ${referralInfo.isCenturion ? 'bg-black/20' : 'bg-zinc-900/50'}`}>
                  <div className="text-center">
                    <p className={`text-xl font-bold ${referralInfo.referralCredits > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                      {referralInfo.referralCredits}
                    </p>
                    <p className="text-gray-500 text-xs">Credits</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white">{referralInfo.totalReferrals || 0}</p>
                    <p className="text-gray-500 text-xs">Referrals</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-xl font-bold ${referralInfo.isCenturion ? 'text-amber-400' : 'text-brand-400'}`}>
                      {referralInfo.creditsEarned || 0}
                    </p>
                    <p className="text-gray-500 text-xs">Earned</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-purple-400">{referralInfo.creditsUsed || 0}</p>
                    <p className="text-gray-500 text-xs">Used</p>
                  </div>
                </div>
                
                {/* Referred Businesses List */}
                {referralInfo.referredBusinesses && referralInfo.referredBusinesses.length > 0 && (
                  <div className={`px-4 py-3 border-t ${referralInfo.isCenturion ? 'border-amber-500/20' : 'border-zinc-800'}`}>
                    <p className="text-gray-400 text-xs mb-2">Your Referrals:</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {referralInfo.referredBusinesses.map((ref, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm">{ref.businessName}</span>
                            {ref.isCenturion && (
                              <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">CC</span>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            ref.status === 'active' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {ref.status === 'active' ? 'Paid' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {referralInfo.pendingReferrals > 0 && (
                      <p className="text-yellow-400/70 text-xs mt-2">
                        {referralInfo.pendingReferrals} referral{referralInfo.pendingReferrals > 1 ? 's' : ''} pending first payment
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Reminder Messages */}
            <div className="space-y-3">
              {/* Bank Account Reminder - Yellow (only show if not connected or not fully enabled) */}
              {stripeStatus && (!stripeStatus.connected || !stripeStatus.chargesEnabled) && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Banknote className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-yellow-400 font-medium">Connect Your Bank Account</p>
                      <p className="text-yellow-200/70 text-sm mt-1">
                        Connect a bank account to receive customer deposit payments. Go to <button onClick={() => setActiveView('profile')} className="underline hover:text-yellow-300">Profile</button> to set this up.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Subscription Payment Reminder - Only show if hasPaymentMethod is true but subscription not active (edge case) */}
              {subscription && !subscription.freeAccessOverride && subscription.status === 'trial' && subscription.hasPaymentMethod && !subscription.stripeSubscriptionId && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-yellow-400 font-medium">Trial Active</p>
                      <p className="text-yellow-200/70 text-sm mt-1">
                        Your payment method is saved. Your subscription will activate after the trial ends ({subscription.trialDaysRemaining} days remaining).
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl font-medium hover:bg-red-500/20 hover:border-red-500/50 transition-all flex items-center justify-center gap-3 mt-4"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        )}

        {/* Availability View */}
        {activeView === 'availability' && (
          <div className="space-y-6">
            {/* Staff Selector Tabs */}
            {staffMembers.length > 0 && (
              <div className="bg-cardBg border border-zinc-800 rounded-xl p-2">
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
                          ? 'bg-brand-500 text-black'
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
              <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
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
                          ? 'bg-brand-500 text-black font-bold'
                          : dayInfo.isToday
                          ? 'bg-brand-500/30 text-brand-400 font-bold hover:bg-brand-500/40'
                          : 'bg-zinc-800 text-white hover:bg-zinc-700'
                      }`}
                    >
                      {dayInfo?.day}
                      {dayInfo?.hasSlots && selectedDate !== dayInfo.date && (
                        <span className="w-2 h-2 rounded-full bg-white mt-0.5"></span>
                      )}
                    </button>
                  ))}
                </div>

                <p className="text-gray-500 text-sm mt-4 text-center">
                  Select a date to manage availability • White dots = slots set
                </p>
              </div>

              {/* Time Slots */}
              {selectedDate && (
                <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
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

                  {/* Save Button - At Top for Mobile */}
                  <button
                    onClick={saveAvailability}
                    className="w-full bg-brand-500 text-black font-semibold py-3 rounded-lg hover:bg-brand-400 transition-colors mb-4"
                  >
                    Save Availability ({selectedSlots.length} slots)
                  </button>

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

                  {/* Time Slots Grid - 5 minute intervals */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-96 overflow-y-auto">
                    {generateTimeSlots().map(slot => (
                      <button
                        key={slot}
                        onClick={() => toggleSlot(slot)}
                        className={`py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                          selectedSlots.includes(slot)
                            ? 'bg-brand-500 text-black'
                            : 'bg-zinc-800 text-white hover:bg-zinc-700'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!selectedDate && (
                <div className="bg-cardBg border border-zinc-800 rounded-xl p-6 flex items-center justify-center">
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
            {/* Tabs for Current vs History */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setAppointmentTab('current')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    appointmentTab === 'current'
                      ? 'bg-brand-500 text-black'
                      : 'bg-zinc-800 text-gray-400 hover:text-white'
                  }`}
                >
                  Current ({pendingAppointments.length + confirmedAppointments.length})
                </button>
                <button
                  onClick={() => setAppointmentTab('history')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    appointmentTab === 'history'
                      ? 'bg-brand-500 text-black'
                      : 'bg-zinc-800 text-gray-400 hover:text-white'
                  }`}
                >
                  History ({historyAppointments.length})
                </button>
              </div>
              
              {/* Book for Customer Button */}
              {appointmentTab === 'current' && (
                <button
                  onClick={openBookForCustomer}
                  className="flex items-center gap-2 bg-brand-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-brand-400 transition-colors"
                >
                  <UserPlus className="w-4 h-4" /> Book for Customer
                </button>
              )}
            </div>

            {/* Current Appointments Tab */}
            {appointmentTab === 'current' && (
              <>
                {/* Pending Appointments */}
                {pendingAppointments.length > 0 && (
                  <div>
                    <h2 className="text-white text-xl font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-400" />
                      Pending Requests ({pendingAppointments.length})
                    </h2>
                    <div className="space-y-3">
                      {pendingAppointments.map(apt => (
                        <div key={apt.id} className="bg-cardBg border border-yellow-500/30 rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-white font-medium">{apt.customerName}</h4>
                              <p className="text-gray-400 text-sm">{apt.customerEmail}</p>
                              <p className="text-brand-400 mt-2">{apt.serviceName}</p>
                              {apt.staffName && <p className="text-gray-500 text-sm">with {apt.staffName}</p>}
                              <p className="text-gray-500 text-sm mt-1">
                                {formatDate(apt.date)} at {apt.time}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveBooking(apt)}
                                className="p-2 bg-brand-500 text-black rounded-lg hover:bg-brand-400 transition-colors"
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
                    <Check className="w-5 h-5 text-brand-400" />
                    Confirmed ({confirmedAppointments.length})
                  </h2>
                  {confirmedAppointments.length > 0 ? (
                    <div className="space-y-3">
                      {confirmedAppointments.map(apt => (
                        <div key={apt.id} className="bg-cardBg border border-zinc-800 rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-white font-medium">{apt.customerName}</h4>
                              <p className="text-brand-400">{apt.serviceName}</p>
                              {apt.staffName && <p className="text-gray-500 text-sm">with {apt.staffName}</p>}
                              <p className="text-gray-500 text-sm mt-1">
                                {formatDate(apt.date)} at {apt.time}
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-brand-500/20 text-brand-400 text-sm rounded-full">
                              Confirmed
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                      <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500">No confirmed appointments</p>
                    </div>
                  )}
                </div>

                {/* No appointments at all */}
                {pendingAppointments.length === 0 && confirmedAppointments.length === 0 && (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-12 text-center">
                    <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">No upcoming appointments</p>
                    <p className="text-gray-500 text-sm">New bookings will appear here</p>
                  </div>
                )}
              </>
            )}

            {/* History Tab */}
            {appointmentTab === 'history' && (
              <div>
                <h2 className="text-white text-xl font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  Appointment History
                </h2>
                {historyAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {historyAppointments.map(apt => (
                      <div key={apt.id} className="bg-cardBg/50 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-white font-medium">{apt.customerName}</h4>
                            <p className="text-gray-400">{apt.serviceName}</p>
                            {apt.staffName && <p className="text-gray-500 text-sm">with {apt.staffName}</p>}
                            <p className="text-gray-500 text-sm mt-1">
                              {formatDate(apt.date)} at {apt.time}
                            </p>
                            {apt.depositRefunded && (
                              <p className="text-yellow-400 text-xs mt-1">
                                Deposit refunded: £{apt.refundAmount?.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <span className={`px-3 py-1 text-sm rounded-full ${
                            apt.status === 'completed' || (apt.status === 'confirmed' && isDatePassed(apt.date))
                              ? 'bg-brand-500/20 text-brand-400'
                              : apt.status === 'cancelled'
                              ? 'bg-gray-500/20 text-gray-400'
                              : apt.status === 'declined'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {apt.status === 'confirmed' && isDatePassed(apt.date) 
                              ? 'Completed' 
                              : apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-12 text-center">
                    <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500">No appointment history yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Services & Staff View */}
        {activeView === 'services' && (
          <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-cardBg border border-zinc-800 rounded-xl p-1">
              {[
                { id: 'services', label: 'Services', icon: Settings },
                { id: 'staff', label: 'Staff', icon: Users }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setServicesSubTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    servicesSubTab === tab.id
                      ? 'bg-brand-500 text-black'
                      : 'text-gray-400 hover:text-white hover:bg-zinc-800'
                  }`}
                  data-testid={`services-tab-${tab.id}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Services Sub-tab */}
            {servicesSubTab === 'services' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-white text-xl font-semibold">Manage Services</h2>
                  <button
                    onClick={openAddService}
                    className="flex items-center gap-2 bg-brand-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-brand-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Service
                  </button>
                </div>

                {/* Info banner about staff assignment */}
                <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-4 mb-6">
                  <p className="text-brand-400 text-sm">
                    <strong>Note:</strong> New services are automatically assigned to all staff members. You can change which staff perform each service in the Staff tab.
                  </p>
                </div>

                {businessServices.length > 0 ? (
                  <div className="space-y-3">
                    {businessServices.map(service => (
                      <div key={service.id} className="bg-cardBg border border-zinc-800 rounded-xl p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-white font-medium text-base">{service.name}</h4>
                              <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${
                                service.active !== false
                                  ? 'bg-brand-500/20 text-brand-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              }`}>
                                {service.active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm mt-1 line-clamp-2">{service.description}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-brand-400 font-semibold">£{service.price}</span>
                              <span className="text-gray-500 text-sm flex items-center gap-1">
                                <Clock className="w-4 h-4" /> {service.duration} min
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleToggleActive(service)}
                              className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                                service.active !== false
                                  ? 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                                  : 'bg-brand-500/20 text-brand-400 hover:bg-brand-500/30'
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
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                    <Settings className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 mb-4">No services yet</p>
                    <button
                      onClick={openAddService}
                      className="bg-brand-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-brand-400 transition-colors"
                    >
                      Add Your First Service
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Staff Sub-tab */}
            {servicesSubTab === 'staff' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-white text-xl font-semibold">Staff Members</h2>
                    <p className="text-gray-500 text-sm">Manage up to 5 staff members for booking</p>
                  </div>
                  {staffMembers.length < 5 && (
                    <button
                      onClick={openAddStaff}
                      className="flex items-center gap-2 bg-brand-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-brand-400 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" /> Add Staff
                    </button>
                  )}
                </div>

                {/* Info banner about service assignment */}
                <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-4 mb-6">
                  <p className="text-brand-400 text-sm">
                    <strong>Note:</strong> New staff members are automatically assigned to all services. You can customise which services each staff member performs below.
                  </p>
                </div>

                {staffMembers.length > 0 ? (
                  <div className="space-y-3">
                    {staffMembers.map(staff => (
                      <div key={staff.id} className="bg-cardBg border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-brand-500/20 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-brand-400" />
                            </div>
                            <div>
                              <h4 className="text-white font-medium">{staff.name}</h4>
                              <p className="text-gray-500 text-sm">
                                {staff.serviceIds?.length || 0} service(s) assigned
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingStaff(staff);
                                setShowStaffModal(true);
                              }}
                              className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {!staff.isOwner && (
                              <button
                                onClick={() => {
                                  setStaffConfirmData({
                                    type: 'remove',
                                    staffId: staff.id,
                                    staffName: staff.name
                                  });
                                  setShowStaffConfirmModal(true);
                                }}
                                className="p-2 rounded-lg bg-zinc-800 text-red-400 hover:bg-zinc-700 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Services this staff can perform */}
                        <div className="mt-4 pt-4 border-t border-zinc-700">
                          <p className="text-gray-400 text-sm mb-2">Services:</p>
                          <div className="flex flex-wrap gap-2">
                            {businessServices.map(service => {
                              const isAssigned = staff.serviceIds?.includes(service.id);
                              return (
                                <button
                                  key={service.id}
                                  onClick={async () => {
                                    const newServiceIds = isAssigned
                                      ? staff.serviceIds.filter(id => id !== service.id)
                                      : [...(staff.serviceIds || []), service.id];
                                    try {
                                      await staffAPI.update(staff.id, { serviceIds: newServiceIds });
                                      loadData();
                                    } catch (error) {
                                      console.error('Failed to update staff services:', error);
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    isAssigned
                                      ? 'bg-brand-500 text-black'
                                      : 'bg-zinc-700 text-gray-400 hover:bg-zinc-600'
                                  }`}
                                >
                                  {service.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 mb-4">No staff members yet</p>
                    <button
                      onClick={openAddStaff}
                      className="bg-brand-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-brand-400 transition-colors"
                    >
                      Add Your First Staff Member
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Customers View */}
        {activeView === 'customers' && (
          <div>
            <h2 className="text-white text-xl font-semibold mb-6">Customers</h2>
            
            {customers.length > 0 ? (
              <div className="bg-cardBg border border-zinc-800 rounded-xl overflow-hidden">
                {/* Customer List - Alphabetically sorted */}
                <div className="divide-y divide-zinc-800">
                  {[...customers]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(customer => {
                      const customerAppointments = allAppointments.filter(a => a.userId === customer.id);
                      const isSelected = selectedCustomer?.id === customer.id;
                      
                      return (
                        <div key={customer.id}>
                          {/* Customer Row - Click to expand */}
                          <div 
                            onClick={() => setSelectedCustomer(isSelected ? null : customer)}
                            className={`p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors flex items-center justify-between ${
                              isSelected ? 'bg-zinc-800/50' : ''
                            }`}
                            data-testid={`customer-row-${customer.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-brand-500/20 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-brand-400" />
                              </div>
                              <div>
                                <h4 className="text-white font-medium">{customer.name}</h4>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-brand-400 font-semibold">
                                {customerAppointments.length} booking{customerAppointments.length !== 1 ? 's' : ''}
                              </span>
                              <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                            </div>
                          </div>
                          
                          {/* Expanded Customer Details */}
                          {isSelected && (
                            <div className="bg-zinc-800/30 p-4 border-t border-zinc-700">
                              <div className="grid md:grid-cols-2 gap-4 mb-4">
                                <div>
                                  <p className="text-gray-500 text-sm">Email</p>
                                  <p className="text-white">{customer.email}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 text-sm">Phone</p>
                                  <p className="text-white">{customer.phone || 'Not provided'}</p>
                                </div>
                              </div>
                              
                              {/* Booking History */}
                              {customerAppointments.length > 0 && (
                                <div className="mt-4">
                                  <p className="text-gray-400 font-medium mb-3">Booking History</p>
                                  <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {customerAppointments
                                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                                      .map(apt => (
                                        <div key={apt.id} className="flex items-center justify-between bg-zinc-800 rounded-lg p-3 text-sm">
                                          <div>
                                            <span className="text-white">{apt.serviceName}</span>
                                            {apt.staffName && <span className="text-gray-500 ml-2">with {apt.staffName}</span>}
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="text-gray-400">{formatDate(apt.date)} at {apt.time}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                              apt.status === 'confirmed' ? 'bg-brand-500/20 text-brand-400'
                                              : apt.status === 'completed' ? 'bg-blue-500/20 text-blue-400'
                                              : apt.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400'
                                              : apt.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400'
                                              : 'bg-red-500/20 text-red-400'
                                            }`}>
                                              {apt.status}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Delete Customer Button */}
                              <div className="mt-4 pt-4 border-t border-zinc-700">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCustomerToDelete(customer);
                                    setShowDeleteCustomerModal(true);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                                  data-testid={`delete-customer-${customer.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Customer Record
                                </button>
                                <p className="text-gray-500 text-xs mt-2">
                                  This will remove all booking records for this customer from your system.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No customers yet</p>
              </div>
            )}
          </div>
        )}

        {/* Analytics View (includes Revenue, Payouts, and Insights) */}
        {activeView === 'analytics' && (
          <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-cardBg border border-zinc-800 rounded-xl p-1 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: PieChart },
                { id: 'revenue', label: 'Revenue', icon: PoundSterling },
                { id: 'payouts', label: 'Payouts', icon: Banknote },
                { id: 'billing', label: 'Billing', icon: Receipt }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAnalyticsSubTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    analyticsSubTab === tab.id
                      ? 'bg-brand-500 text-black'
                      : 'text-gray-400 hover:text-white hover:bg-zinc-800'
                  }`}
                  data-testid={`analytics-tab-${tab.id}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Overview Sub-tab */}
            {analyticsSubTab === 'overview' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-white text-xl font-semibold">Business Insights</h2>
                  <button 
                    onClick={loadAnalytics}
                    disabled={analyticsLoading}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                    {analyticsLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {analyticsLoading && !analytics ? (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                    <p className="text-gray-400">Loading analytics...</p>
                  </div>
                ) : analytics ? (
                  <>
                    {/* Key Metrics Overview */}
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">Total Bookings</p>
                        <p className="text-white text-2xl font-bold">{analytics.averageMetrics.totalBookings}</p>
                        <p className="text-brand-400 text-sm">{analytics.averageMetrics.confirmedBookings} confirmed</p>
                      </div>
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">Avg. Booking Value</p>
                        <p className="text-brand-400 text-2xl font-bold">£{analytics.averageMetrics.averageBookingValue.toFixed(2)}</p>
                      </div>
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">Conversion Rate</p>
                        <p className="text-white text-2xl font-bold">{analytics.averageMetrics.conversionRate}%</p>
                        <p className="text-gray-500 text-sm">confirmed / total</p>
                      </div>
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">Customer Retention</p>
                        <p className="text-brand-400 text-2xl font-bold">{analytics.customerRetention.retentionRate}%</p>
                        <p className="text-gray-500 text-sm">{analytics.customerRetention.repeatCustomers} repeat customers</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Popular Services */}
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-brand-400" />
                          Most Popular Services
                        </h3>
                        {analytics.popularServices.length > 0 ? (
                          <div className="space-y-3">
                            {analytics.popularServices.map((service, index) => (
                              <div key={service.serviceId} className="flex items-center justify-between bg-zinc-800 rounded-lg p-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center text-brand-400 font-semibold text-sm">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <p className="text-white font-medium">{service.name}</p>
                                    <p className="text-gray-500 text-sm">{service.count} bookings</p>
                                  </div>
                                </div>
                                <p className="text-brand-400 font-semibold">£{service.revenue.toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">No service data yet</p>
                        )}
                      </div>

                      {/* Peak Hours */}
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                          <Clock className="w-5 h-5 text-brand-400" />
                          Peak Booking Hours
                        </h3>
                        {analytics.peakHours.length > 0 ? (
                          <div className="space-y-3">
                            {analytics.peakHours.map((hour, index) => (
                              <div key={hour.hour} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                                    index === 0 ? 'bg-brand-500 text-black' : 'bg-zinc-800 text-white'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <span className="text-white">{hour.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-zinc-800 rounded-full h-2">
                                    <div 
                                      className="bg-brand-500 h-2 rounded-full" 
                                      style={{ width: `${(hour.count / analytics.peakHours[0].count) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-gray-400 text-sm w-12">{hour.count}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">No booking time data yet</p>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Busiest Days */}
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-brand-400" />
                          Busiest Days
                        </h3>
                        {analytics.busiestDays.length > 0 ? (
                          <div className="space-y-3">
                            {analytics.busiestDays.map((day, index) => (
                              <div key={day.day} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                                    index === 0 ? 'bg-brand-500 text-black' : 'bg-zinc-800 text-white'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <span className="text-white">{day.day}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-zinc-800 rounded-full h-2">
                                    <div 
                                      className="bg-brand-500 h-2 rounded-full" 
                                      style={{ width: `${(day.count / analytics.busiestDays[0].count) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-gray-400 text-sm w-12">{day.count}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">No day data yet</p>
                        )}
                      </div>

                      {/* Booking Status Breakdown */}
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                          <PieChart className="w-5 h-5 text-brand-400" />
                          Booking Status Breakdown
                        </h3>
                        {analytics.bookingStatusBreakdown.length > 0 ? (
                          <div className="space-y-3">
                            {analytics.bookingStatusBreakdown.map((item) => {
                              const colors = {
                                confirmed: 'bg-brand-500',
                                completed: 'bg-green-500',
                                pending: 'bg-yellow-500',
                                cancelled: 'bg-red-500',
                                declined: 'bg-red-400'
                              };
                              return (
                                <div key={item.status} className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${colors[item.status] || 'bg-gray-500'}`} />
                                    <span className="text-white capitalize">{item.status}</span>
                                  </div>
                                  <span className="text-gray-400">{item.count}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">No status data yet</p>
                        )}
                      </div>
                    </div>

                    {/* Customer Insights */}
                    <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-brand-400" />
                        Customer Insights
                      </h3>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="bg-zinc-800 rounded-lg p-4 text-center">
                          <p className="text-3xl font-bold text-white">{analytics.customerRetention.totalCustomers}</p>
                          <p className="text-gray-400 text-sm">Total Customers</p>
                        </div>
                        <div className="bg-zinc-800 rounded-lg p-4 text-center">
                          <p className="text-3xl font-bold text-brand-400">{analytics.customerRetention.repeatCustomers}</p>
                          <p className="text-gray-400 text-sm">Repeat Customers</p>
                        </div>
                        <div className="bg-zinc-800 rounded-lg p-4 text-center">
                          <p className="text-3xl font-bold text-yellow-400">{analytics.customerRetention.newCustomers}</p>
                          <p className="text-gray-400 text-sm">First-time Customers</p>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Trend */}
                    <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-brand-400" />
                        6-Month Trend
                      </h3>
                      <div className="grid grid-cols-6 gap-2">
                        {analytics.monthlyTrend.map((month, index) => {
                          const maxBookings = Math.max(...analytics.monthlyTrend.map(m => m.bookings)) || 1;
                          const heightPercent = (month.bookings / maxBookings) * 100;
                          return (
                            <div key={index} className="text-center">
                              <div className="h-32 bg-zinc-800 rounded-lg flex flex-col justify-end p-1">
                                <div 
                                  className="bg-brand-500 rounded transition-all"
                                  style={{ height: `${heightPercent}%`, minHeight: month.bookings > 0 ? '8px' : '0' }}
                                />
                              </div>
                              <p className="text-xs text-gray-400 mt-2">{month.month}</p>
                              <p className="text-xs text-white">{month.bookings}</p>
                              <p className="text-xs text-brand-400">£{month.revenue}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                    <PieChart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">No analytics data available</p>
                  </div>
                )}
              </>
            )}

            {/* Revenue Sub-tab */}
            {analyticsSubTab === 'revenue' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-white text-xl font-semibold">Revenue</h2>
                    <p className="text-gray-500 text-sm mt-1">The figures below take into account all past and future bookings on your system</p>
                  </div>
                  <button 
                    onClick={loadRevenue}
                    disabled={revenueLoading}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${revenueLoading ? 'animate-spin' : ''}`} />
                    {revenueLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {revenueLoading && !revenueSummary ? (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                    <p className="text-gray-400">Loading revenue data...</p>
                  </div>
                ) : revenueSummary ? (
                  <>
                    {/* Overview Cards */}
                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Current Week */}
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">This Week</p>
                        <p className="text-white text-3xl font-bold">£{revenueSummary.currentWeek.revenue.toFixed(2)}</p>
                        <p className="text-gray-500 text-sm">{revenueSummary.currentWeek.bookingCount} bookings</p>
                        <div className={`flex items-center gap-1 mt-2 text-sm ${
                          revenueSummary.comparison.weekOverWeek.change >= 0 ? 'text-brand-400' : 'text-red-400'
                        }`}>
                          {revenueSummary.comparison.weekOverWeek.change >= 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span>
                            {revenueSummary.comparison.weekOverWeek.change >= 0 ? '+' : ''}
                            £{revenueSummary.comparison.weekOverWeek.change.toFixed(2)} vs last week
                          </span>
                        </div>
                      </div>

                      {/* Current Month */}
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">{revenueSummary.currentMonth.label}</p>
                        <p className="text-white text-3xl font-bold">£{revenueSummary.currentMonth.revenue.toFixed(2)}</p>
                        <p className="text-gray-500 text-sm">{revenueSummary.currentMonth.bookingCount} bookings</p>
                        <div className={`flex items-center gap-1 mt-2 text-sm ${
                          revenueSummary.comparison.monthOverMonth.change >= 0 ? 'text-brand-400' : 'text-red-400'
                        }`}>
                          {revenueSummary.comparison.monthOverMonth.change >= 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span>
                            {revenueSummary.comparison.monthOverMonth.change >= 0 ? '+' : ''}
                            £{revenueSummary.comparison.monthOverMonth.change.toFixed(2)} vs {revenueSummary.previousMonth.label}
                          </span>
                        </div>
                      </div>

                      {/* Current Year */}
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">{revenueSummary.currentYear.label}</p>
                        <p className="text-brand-400 text-3xl font-bold">£{revenueSummary.currentYear.revenue.toFixed(2)}</p>
                        <p className="text-gray-500 text-sm">{revenueSummary.currentYear.bookingCount} bookings</p>
                      </div>
                    </div>

                    {/* Revenue by Treatment/Service */}
                    {serviceRevenue && serviceRevenue.serviceRevenue && serviceRevenue.serviceRevenue.length > 0 && (
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                          <Settings className="w-5 h-5 text-brand-400" />
                          Revenue by Treatment
                        </h3>
                        <div className="space-y-3">
                          {serviceRevenue.serviceRevenue.map((service, index) => (
                            <div key={service.serviceId} className="flex items-center justify-between bg-zinc-800 rounded-lg p-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  index === 0 ? 'bg-brand-500 text-black' : 'bg-zinc-700 text-white'
                                }`}>
                                  {index + 1}
                                </div>
                                <div>
                                  <p className={`font-medium ${service.isDeleted ? 'text-gray-400' : 'text-white'}`}>
                                    {service.serviceName}
                                    {service.isDeleted && <span className="text-red-400 text-xs ml-2">(Deleted)</span>}
                                  </p>
                                  <p className="text-gray-500 text-sm">{service.bookingCount} booking{service.bookingCount !== 1 ? 's' : ''}</p>
                                </div>
                              </div>
                              <p className="text-brand-400 font-bold text-lg">£{service.totalRevenue.toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-zinc-700 flex justify-between items-center">
                          <p className="text-gray-400 font-medium">Total Revenue</p>
                          <p className="text-brand-400 font-bold text-xl">£{serviceRevenue.totalRevenue.toFixed(2)}</p>
                        </div>
                      </div>
                    )}

                    {/* Revenue by Staff - only show if more than one staff */}
                    {staffRevenue && staffRevenue.staffRevenue && staffRevenue.staffRevenue.length > 1 && (
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                          <Users className="w-5 h-5 text-brand-400" />
                          Revenue by Staff Member
                        </h3>
                        <div className="space-y-4">
                          {staffRevenue.staffRevenue.map((staff) => {
                            const curr_month_rev = staff.currentMonth?.revenue || 0;
                            const prev_month_rev = staff.previousMonth?.revenue || 0;
                            const change = curr_month_rev - prev_month_rev;
                            const totalRev = staff.currentYear?.revenue || 0;
                            const totalBookings = staff.currentYear?.bookingCount || 0;
                            return (
                              <div key={staff.staffId} className="bg-zinc-800 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-brand-500/20 rounded-full flex items-center justify-center">
                                      <User className="w-5 h-5 text-brand-400" />
                                    </div>
                                    <div>
                                      <p className="text-white font-medium">{staff.staffName}</p>
                                      <p className="text-gray-500 text-sm">{totalBookings} total bookings</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-brand-400 text-xl font-bold">£{totalRev.toFixed(2)}</p>
                                    <p className="text-gray-500 text-sm">all time</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                  <div className="bg-zinc-700/50 rounded p-2">
                                    <p className="text-white font-semibold">£{(staff.currentWeek?.revenue || 0).toFixed(2)}</p>
                                    <p className="text-gray-400 text-xs">This Week</p>
                                  </div>
                                  <div className="bg-zinc-700/50 rounded p-2">
                                    <p className="text-white font-semibold">£{curr_month_rev.toFixed(2)}</p>
                                    <p className="text-gray-400 text-xs">This Month</p>
                                  </div>
                                  <div className="bg-zinc-700/50 rounded p-2">
                                    <p className={`font-semibold ${change >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                                      {change >= 0 ? '+' : ''}£{change.toFixed(2)}
                                    </p>
                                    <p className="text-gray-400 text-xs">vs Last Month</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Monthly Revenue Table */}
                    {monthlyRevenue && monthlyRevenue.yearlyBreakdown && (
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-brand-400" />
                          Monthly Revenue Breakdown
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-zinc-700">
                                <th className="text-left text-gray-400 font-medium py-3 px-2">Month</th>
                                {monthlyRevenue.years.map(year => (
                                  <th key={year} className="text-right text-gray-400 font-medium py-3 px-2">{year}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {['January', 'February', 'March', 'April', 'May', 'June', 
                                'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                                <tr key={month} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                                  <td className="text-gray-300 py-3 px-2">{month}</td>
                                  {monthlyRevenue.years.map(year => {
                                    const yearData = monthlyRevenue.yearlyBreakdown[year];
                                    const monthData = yearData?.months?.[idx];
                                    const revenue = monthData?.revenue || 0;
                                    return (
                                      <td key={year} className={`text-right py-3 px-2 ${revenue > 0 ? 'text-brand-400' : 'text-gray-600'}`}>
                                        £{revenue.toFixed(2)}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                              {/* Year Total Row */}
                              <tr className="border-t-2 border-zinc-600 bg-zinc-800/50">
                                <td className="text-white font-bold py-3 px-2">Year Total</td>
                                {monthlyRevenue.years.map(year => {
                                  const yearData = monthlyRevenue.yearlyBreakdown[year];
                                  return (
                                    <td key={year} className="text-right text-brand-400 font-bold py-3 px-2">
                                      £{(yearData?.yearTotal || 0).toFixed(2)}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                    <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">No revenue data available</p>
                  </div>
                )}
              </>
            )}

            {/* Payouts Sub-tab */}
            {analyticsSubTab === 'payouts' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-white text-xl font-semibold">Payout History</h2>
                  <button 
                    onClick={loadPayouts}
                    disabled={payoutLoading}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${payoutLoading ? 'animate-spin' : ''}`} />
                    {payoutLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {payoutLoading && !payoutHistory ? (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                    <p className="text-gray-400">Loading payout data...</p>
                  </div>
                ) : payoutHistory ? (
                  <>
                    {/* Fee Breakdown Info */}
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                      <p className="text-gray-300 text-sm">
                        <span className="text-brand-400 font-medium">Fee Structure:</span> A {payoutHistory.summary.platformFeePercent || 5}% platform fee is deducted from each customer deposit to cover payment processing costs.
                      </p>
                    </div>

                    {/* Payout Summary Cards */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">Customer Deposits</p>
                        <p className="text-white text-2xl font-bold">£{(payoutHistory.summary.totalDeposits || 0).toFixed(2)}</p>
                        <p className="text-gray-500 text-sm">{payoutHistory.summary.transactionCount} transactions</p>
                      </div>
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">Platform Fees ({payoutHistory.summary.platformFeePercent || 5}%)</p>
                        <p className="text-yellow-400 text-2xl font-bold">-£{(payoutHistory.summary.totalPlatformFees || 0).toFixed(2)}</p>
                        <p className="text-gray-500 text-sm">Processing costs</p>
                      </div>
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">You Receive (95%)</p>
                        <p className="text-brand-400 text-2xl font-bold">£{payoutHistory.summary.totalReceived.toFixed(2)}</p>
                        <p className="text-gray-500 text-sm">After fees</p>
                      </div>
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-1">Net (After Refunds)</p>
                        <p className="text-brand-400 text-2xl font-bold">£{payoutHistory.summary.netReceived.toFixed(2)}</p>
                        {payoutHistory.summary.totalRefunded > 0 && (
                          <p className="text-red-400 text-sm">-£{payoutHistory.summary.totalRefunded.toFixed(2)} refunded</p>
                        )}
                      </div>
                    </div>

                    {/* Period Summary */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-3">This Month</p>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Deposits:</span>
                            <span className="text-white">£{(payoutHistory.summary.currentMonthDeposits || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Fees:</span>
                            <span className="text-yellow-400">-£{(payoutHistory.summary.currentMonthFees || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t border-zinc-700 pt-2">
                            <span className="text-gray-300 font-medium">You Receive:</span>
                            <span className="text-brand-400 font-bold">£{payoutHistory.summary.currentMonth.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                        <p className="text-gray-400 text-sm mb-3">Year to Date</p>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Deposits:</span>
                            <span className="text-white">£{(payoutHistory.summary.yearToDateDeposits || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Fees:</span>
                            <span className="text-yellow-400">-£{(payoutHistory.summary.yearToDateFees || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t border-zinc-700 pt-2">
                            <span className="text-gray-300 font-medium">You Receive:</span>
                            <span className="text-brand-400 font-bold">£{payoutHistory.summary.yearToDate.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payout Destination Notice */}
                    <div className={`rounded-xl p-4 flex items-start gap-3 ${
                      payoutHistory.stripeConnected ? 'bg-brand-500/10 border border-brand-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'
                    }`}>
                      {payoutHistory.stripeConnected ? (
                        <>
                          <Check className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-brand-400 font-medium">Deposits going to: {payoutHistory.payoutDestination}</p>
                            <p className="text-brand-200 text-sm">Customer deposits (minus 5% fee) are routed directly to your connected bank account.</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-yellow-400 font-medium">Deposits going to: Platform Account</p>
                            <p className="text-yellow-200 text-sm">Connect your bank account in Profile to receive deposits directly.</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Transaction History */}
                    <div className="bg-cardBg border border-zinc-800 rounded-xl overflow-hidden">
                      <div className="p-4 border-b border-zinc-800">
                        <h3 className="text-white font-medium flex items-center gap-2">
                          <Banknote className="w-5 h-5 text-brand-400" />
                          Recent Deposits
                        </h3>
                      </div>
                      {payoutHistory.payouts.length > 0 ? (
                        <div className="divide-y divide-zinc-800">
                          {payoutHistory.payouts.slice(0, 20).map((payout) => (
                            <div key={payout.id} className="p-4 hover:bg-zinc-800/50 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    payout.status === 'refunded' ? 'bg-red-500/20 text-red-400' : 'bg-brand-500/20 text-brand-400'
                                  }`}>
                                    {payout.status === 'refunded' ? <XCircle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                                  </div>
                                  <div>
                                    <p className="text-white font-medium">{payout.serviceName}</p>
                                    <p className="text-gray-500 text-sm">
                                      {payout.customerEmail} • {payout.bookingDate} at {payout.bookingTime}
                                      {payout.staffName && ` • ${payout.staffName}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {payout.status !== 'refunded' ? (
                                    <>
                                      <p className="text-gray-400 text-xs">
                                        Deposit: £{(payout.depositAmount || payout.amount).toFixed(2)}
                                        {payout.platformFee > 0 && <span className="text-yellow-400"> - £{payout.platformFee.toFixed(2)} fee</span>}
                                      </p>
                                      <p className="text-brand-400 font-semibold">
                                        +£{(payout.businessReceives || payout.amount).toFixed(2)}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-red-400 font-semibold">
                                      -£{payout.amount.toFixed(2)}
                                    </p>
                                  )}
                                  <p className="text-gray-500 text-xs">
                                    {formatDate(payout.date)}
                                  </p>
                                  {payout.status === 'refunded' && (
                                    <p className="text-red-400 text-xs">Refunded</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <Banknote className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-500">No deposits received yet</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                    <Banknote className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">No payout data available</p>
                  </div>
                )}
              </>
            )}

            {/* Billing Sub-tab */}
            {analyticsSubTab === 'billing' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-white text-xl font-semibold">Billing History</h2>
                  {!subscription?.freeAccessOverride && (
                    <button 
                      onClick={loadBilling}
                      disabled={billingLoading}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                      data-testid="refresh-billing-btn"
                    >
                      <RefreshCw className={`w-4 h-4 ${billingLoading ? 'animate-spin' : ''}`} />
                      {billingLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  )}
                </div>

                {/* Free Access Message */}
                {subscription?.freeAccessOverride && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Check className="w-6 h-6 text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-green-400 text-lg font-semibold">Free Access Granted</h3>
                        <p className="text-green-300/70 text-sm mt-1">No subscription payment is due. You have unlimited access to all Calendrax features.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Billing content for paid users */}
                {!subscription?.freeAccessOverride && (
                  <>
                    {billingLoading && billingInvoices.length === 0 ? (
                      <div className="bg-cardBg border border-zinc-800 rounded-xl p-8 text-center">
                        <Loader2 className="w-8 h-8 text-brand-400 animate-spin mx-auto mb-3" />
                        <p className="text-gray-400">Loading billing history...</p>
                      </div>
                    ) : (
                      <>
                        {/* Next Payment / Upcoming Invoice */}
                        <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-brand-400" />
                            Next Subscription Payment
                          </h3>
                          
                          {subscription?.status === 'trial' ? (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-white font-medium">Free Trial Period</p>
                                <p className="text-gray-400 text-sm mt-1">
                                  Your trial ends on: <span className="text-brand-400 font-medium">{subscription.trialEndDate ? formatDate(subscription.trialEndDate) : 'N/A'}</span>
                                </p>
                                {subscription.trialDaysLeft !== undefined && (
                                  <p className="text-gray-500 text-xs mt-1">{subscription.trialDaysLeft} days remaining</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-gray-400 text-sm">First payment</p>
                                <p className="text-brand-400 text-xl font-bold">£{subscription.price?.toFixed(2) || '15.00'}</p>
                              </div>
                            </div>
                          ) : billingUpcoming ? (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-gray-400 text-sm">{billingUpcoming.description || 'Calendrax Subscription'}</p>
                                {billingUpcoming.date && (
                                  <p className="text-white font-medium mt-1">
                                    Payment Date: <span className="text-brand-400">{formatDate(billingUpcoming.date)}</span>
                                  </p>
                                )}
                                {billingUpcoming.status === 'pending_payment_setup' && (
                                  <p className="text-yellow-400 text-xs mt-1">Payment method required</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-gray-400 text-sm">Amount due</p>
                                <p className="text-brand-400 text-2xl font-bold">£{billingUpcoming.amount?.toFixed(2) || '0.00'}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <p className="text-gray-400">No upcoming payment scheduled</p>
                              <p className="text-gray-500 text-sm mt-1">Set up your subscription to see billing details</p>
                            </div>
                          )}
                        </div>

                        {/* Invoice Info */}
                        <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4 flex items-start gap-3">
                          <FileText className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-brand-400 font-medium">Automatic Invoice Emails</p>
                            <p className="text-brand-200 text-sm">
                              Stripe automatically sends you an invoice email each time your subscription payment is processed.
                              You can download PDF invoices below for your records.
                            </p>
                          </div>
                        </div>

                        {/* Invoice List */}
                        <div className="bg-cardBg border border-zinc-800 rounded-xl overflow-hidden" data-testid="invoice-list">
                          <div className="p-4 border-b border-zinc-800">
                            <h3 className="text-white font-medium flex items-center gap-2">
                              <Receipt className="w-5 h-5 text-brand-400" />
                              Invoice History
                            </h3>
                          </div>
                          {billingInvoices.length > 0 ? (
                            <div className="divide-y divide-zinc-800">
                              {billingInvoices.map((invoice) => (
                                <div key={invoice.id} className="p-4 hover:bg-zinc-800/50 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        invoice.paid ? 'bg-brand-500/20 text-brand-400' : 'bg-yellow-500/20 text-yellow-400'
                                      }`}>
                                        {invoice.paid ? <Check className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                      </div>
                                      <div>
                                        <p className="text-white font-medium">{invoice.description || 'Subscription Payment'}</p>
                                        <p className="text-gray-600 text-xs">
                                          {formatDate(invoice.date)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <p className={`font-semibold ${invoice.paid ? 'text-brand-400' : 'text-yellow-400'}`}>
                                          £{invoice.amount?.toFixed(2) || '0.00'}
                                        </p>
                                        <p className={`text-xs ${invoice.paid ? 'text-gray-500' : 'text-yellow-400/70'}`}>
                                          {invoice.paid ? 'Paid' : 'Pending'}
                                        </p>
                                      </div>
                                      {invoice.pdfUrl && (
                                        <a
                                          href={invoice.pdfUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-2 bg-zinc-800 rounded-lg text-gray-400 hover:text-white hover:bg-zinc-700 transition-colors"
                                          title="Download PDF"
                                        >
                                          <Download className="w-4 h-4" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-8 text-center">
                              <Receipt className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                              <p className="text-gray-500">No invoices yet</p>
                              <p className="text-gray-600 text-sm mt-1">Invoices will appear here after your first payment</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
        {/* Profile View */}
        {activeView === 'profile' && (
          <div className="space-y-6">
            <h2 className="text-white text-xl font-semibold">Business Profile</h2>
            
            {/* Subscription Status Card */}
            {subscription && (
              <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-brand-400" />
                  Subscription & Payment
                </h3>
                <div className="grid md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Status</p>
                    <p className={`font-semibold ${subscription.status === 'trial' ? 'text-yellow-400' : subscription.status === 'active' ? 'text-brand-400' : 'text-red-400'}`}>
                      {subscription.status === 'trial' ? 'Free Trial' : subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                    </p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Staff Members</p>
                    <p className="text-white font-semibold">{subscription.staffCount}</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Monthly Price</p>
                    <p className="text-brand-400 font-semibold">£{subscription.priceMonthly?.toFixed(2)}</p>
                  </div>
                  {subscription.status === 'trial' && subscription.trialDaysRemaining > 0 && (
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Trial Ends In</p>
                      <p className="text-yellow-400 font-semibold">{subscription.trialDaysRemaining} days</p>
                    </div>
                  )}
                </div>
                
                {subscription.freeAccessOverride ? (
                  <p className="text-brand-400 text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" /> Free access granted by admin
                  </p>
                ) : subscription.status === 'trial' ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-yellow-400 font-medium">Set Up Payment Method</p>
                        <p className="text-yellow-200/70 text-sm mt-1">
                          Add your payment details before your trial ends to continue using Calendrax.
                        </p>
                      </div>
                      <button
                        onClick={handleSetupSubscriptionPayment}
                        disabled={subscriptionLoading}
                        className="flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50"
                      >
                        <CreditCard className="w-4 h-4" />
                        {subscriptionLoading ? 'Processing...' : 'Add Payment'}
                      </button>
                    </div>
                  </div>
                ) : subscription.status === 'active' ? (
                  <div className="flex items-center justify-between">
                    <p className="text-brand-400 text-sm flex items-center gap-2">
                      <Check className="w-4 h-4" /> Subscription active - Payment method on file
                    </p>
                    <button
                      onClick={handleSetupSubscriptionPayment}
                      disabled={subscriptionLoading}
                      className="text-gray-400 hover:text-white text-sm underline"
                    >
                      Update payment method
                    </button>
                  </div>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-red-400 font-medium">Payment Required</p>
                        <p className="text-red-200/70 text-sm mt-1">
                          Your subscription is inactive. Please add a payment method to continue.
                        </p>
                      </div>
                      <button
                        onClick={handleSetupSubscriptionPayment}
                        disabled={subscriptionLoading}
                        className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-400 transition-colors disabled:opacity-50"
                      >
                        <CreditCard className="w-4 h-4" />
                        {subscriptionLoading ? 'Processing...' : 'Add Payment'}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Pricing breakdown */}
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <p className="text-gray-500 text-sm">
                    Pricing: £10/month base + £5 for each additional staff member
                  </p>
                </div>
              </div>
            )}

            {/* Stripe Connect Card */}
            <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-brand-400" />
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
                    className="flex items-center gap-2 bg-brand-500 text-black px-6 py-3 rounded-lg font-medium hover:bg-brand-400 transition-colors disabled:opacity-50"
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
                    <div className={`w-3 h-3 rounded-full ${stripeStatus.chargesEnabled ? 'bg-brand-500' : 'bg-yellow-500'}`}></div>
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
            <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand-400" />
                Deposit Settings
              </h3>
              <p className="text-gray-400 mb-4">
                Choose how much deposit customers must pay when booking your services.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: 'none', label: 'No Deposit' },
                  { value: '20', label: '20%' },
                  { value: '50', label: '50%' },
                  { value: 'full', label: 'Pay in Full' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setProfileForm({...profileForm, depositLevel: option.value})}
                    className={`p-4 rounded-lg border transition-all ${
                      profileForm.depositLevel === option.value
                        ? 'bg-brand-500/20 border-brand-500 text-brand-400'
                        : 'bg-zinc-800 border-zinc-700 text-gray-400 hover:border-zinc-600'
                    }`}
                  >
                    <span className="font-semibold">{option.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-gray-500 text-sm mt-3">
                {profileForm.depositLevel === 'none' && 'Customers can book without any upfront payment.'}
                {profileForm.depositLevel === '20' && 'Customers pay 20% of the service price to confirm their booking. (Recommended)'}
                {profileForm.depositLevel === '50' && 'Customers pay 50% of the service price to confirm their booking.'}
                {profileForm.depositLevel === 'full' && 'Customers pay the full service price upfront when booking.'}
              </p>
            </div>
            
            {/* Business Details Form */}
            <form onSubmit={handleProfileSave} className="bg-cardBg border border-zinc-800 rounded-xl p-6 space-y-6">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-400" />
                Business Details
              </h3>
              
              {/* Logo Upload Section */}
              <div>
                <label className="text-gray-400 text-sm block mb-3">Business Logo</label>
                <div className="flex items-start gap-6">
                  {/* Logo Preview */}
                  <div className="relative">
                    <div className="w-24 h-24 bg-zinc-800 border-2 border-dashed border-zinc-600 rounded-xl overflow-hidden flex items-center justify-center">
                      {profileForm.logo ? (
                        <img 
                          src={profileForm.logo} 
                          alt="Business Logo" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <Image className="w-8 h-8 text-gray-500 mx-auto mb-1" />
                          <p className="text-gray-500 text-xs">No logo</p>
                        </div>
                      )}
                    </div>
                    {profileForm.logo && (
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-400 transition-colors"
                        title="Remove logo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Upload Button & Info */}
                  <div className="flex-1">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      data-testid="logo-upload-input"
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      data-testid="upload-logo-btn"
                    >
                      {logoUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          {profileForm.logo ? 'Change Logo' : 'Upload Logo'}
                        </>
                      )}
                    </button>
                    <p className="text-gray-500 text-xs mt-2">
                      Recommended: Square image, at least 200x200px. Max 2MB.
                    </p>
                    <p className="text-gray-600 text-xs mt-1">
                      Your logo appears on your business profile page and in the header.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Business Name</label>
                  <input
                    type="text"
                    value={profileForm.businessName}
                    onChange={(e) => setProfileForm({...profileForm, businessName: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Postcode</label>
                  <input
                    type="text"
                    value={profileForm.postcode}
                    onChange={(e) => setProfileForm({...profileForm, postcode: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-2">Description</label>
                <textarea
                  value={profileForm.description}
                  onChange={(e) => setProfileForm({...profileForm, description: e.target.value})}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-2">Address</label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
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
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 text-sm block mb-2">Website</label>
                  <input
                    type="url"
                    value={profileForm.website}
                    onChange={(e) => setProfileForm({...profileForm, website: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                    placeholder="https://"
                  />
                </div>
              </div>

              {/* Business Photos */}
              <div className="mt-6">
                <label className="text-gray-400 text-sm block mb-3 flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Business Photos (Max 3)
                </label>
                <p className="text-gray-500 text-xs mb-3">
                  These photos will be displayed on your public business page. 
                  <span className="text-brand-400 ml-1">The first photo becomes your hero/background image.</span>
                </p>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[0, 1, 2].map((index) => {
                    const photo = profileForm.photos[index];
                    return (
                      <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800">
                        {index === 0 && (
                          <span className="absolute top-2 left-2 bg-brand-500 text-black text-xs px-2 py-1 rounded-full z-10 font-medium">
                            Hero
                          </span>
                        )}
                        {photo ? (
                          <>
                            <img 
                              src={photo} 
                              alt={`Business photo ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {/* Overlay with replace and delete options */}
                            <div className="absolute inset-0 bg-appbg/50 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  photoInputRef.current.dataset.slot = index;
                                  photoInputRef.current.dataset.replace = 'true';
                                  photoInputRef.current?.click();
                                }}
                                className="bg-brand-500 hover:bg-brand-400 text-black px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                              >
                                <Upload className="w-4 h-4" />
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePhotoRemove(index)}
                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              photoInputRef.current.dataset.slot = index;
                              photoInputRef.current?.click();
                            }}
                            disabled={photoUploading}
                            className="w-full h-full border-2 border-dashed border-zinc-700 hover:border-brand-500 flex flex-col items-center justify-center gap-2 transition-colors rounded-xl"
                          >
                            {photoUploading ? (
                              <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
                            ) : (
                              <>
                                <Upload className="w-8 h-8 text-gray-500" />
                                <span className="text-gray-500 text-sm">Add Photo</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex items-center gap-2 bg-brand-500 text-black px-6 py-3 rounded-lg font-medium hover:bg-brand-400 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>

            {/* Change Password */}
            <div className="bg-cardBg border border-zinc-800 rounded-xl p-6 mt-6">
              <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                <Lock className="w-5 h-5 text-brand-400" />
                Change Password
              </h3>
              
              {!showPasswordForm ? (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white py-3 px-4 rounded-lg font-medium hover:bg-zinc-700 hover:border-brand-500/50 transition-all"
                >
                  Change Password
                </button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {passwordError && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
                      Password changed successfully!
                    </div>
                  )}
                  
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500 pr-12"
                      placeholder="Current Password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500 pr-12"
                      placeholder="New Password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                    placeholder="Confirm New Password"
                    required
                  />
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setPasswordError('');
                      }}
                      className="flex-1 bg-zinc-800 text-white py-3 rounded-lg font-medium hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="flex-1 bg-brand-500 text-black py-3 rounded-lg font-medium hover:bg-brand-400 transition-colors disabled:opacity-50"
                    >
                      {passwordSaving ? 'Saving...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Notification Preferences */}
            <div className="bg-cardBg border border-zinc-800 rounded-xl p-6 mt-6">
              <h3 className="text-white font-medium flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-brand-400" />
                Notification Preferences
              </h3>
              
              <div className="space-y-4">
                {/* Email Reminders Toggle */}
                <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-white font-medium">Email Reminders</p>
                      <p className="text-gray-500 text-sm">Receive booking notifications via email</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleNotificationPref('emailReminders')}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      notificationPrefs.emailReminders ? 'bg-brand-500' : 'bg-zinc-600'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      notificationPrefs.emailReminders ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Add to Home Screen */}
            <div className="bg-cardBg border border-zinc-800 rounded-xl p-6 mt-6">
              <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                <Smartphone className="w-5 h-5 text-brand-400" />
                Add to Home Screen
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Get quick access to your Calendrax dashboard right from your phone's home screen.
              </p>
              <button
                onClick={() => setShowInstallPrompt(true)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white py-3 px-4 rounded-lg font-medium hover:bg-zinc-700 hover:border-brand-500/50 transition-all flex items-center justify-center gap-2"
              >
                <Smartphone className="w-5 h-5" />
                Add Calendrax to Home Screen
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-appbg/80 flex items-center justify-center z-50 p-4">
          <div className="bg-cardBg border border-zinc-800 rounded-xl w-full max-w-md">
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Description</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500 min-h-20"
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
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500"
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
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-500 text-black font-semibold py-3 rounded-lg hover:bg-brand-400 transition-colors"
              >
                {editingService ? 'Update Service' : 'Add Service'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-appbg/80 flex items-center justify-center z-50 p-4">
          <div className="bg-cardBg border border-zinc-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-cardBg">
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500"
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
                        className="w-4 h-4 rounded border-zinc-600 text-brand-500 focus:ring-brand-500 focus:ring-offset-zinc-900"
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
                className="w-full bg-brand-500 text-black font-semibold py-3 rounded-lg hover:bg-brand-400 transition-colors"
              >
                {editingStaff ? 'Update Staff' : 'Add Staff'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Staff Subscription Confirmation Modal */}
      {showStaffConfirmModal && staffConfirmData && (
        <div className="fixed inset-0 bg-appbg/80 flex items-center justify-center z-50 p-4">
          <div className="bg-cardBg border border-zinc-800 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                staffConfirmData.type === 'add' ? 'bg-brand-500/20' : 'bg-yellow-500/20'
              }`}>
                {staffConfirmData.type === 'add' ? (
                  <UserPlus className={`w-8 h-8 ${staffConfirmData.type === 'add' ? 'text-brand-400' : 'text-yellow-400'}`} />
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

              {/* Warning about future bookings being deleted */}
              {staffConfirmData.type === 'delete' && staffConfirmData.futureBookingsCount > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-medium">Warning: Bookings Will Be Deleted</p>
                      <p className="text-red-300/80 text-sm mt-1">
                        {staffConfirmData.staffName} has <strong>{staffConfirmData.futureBookingsCount}</strong> future booking{staffConfirmData.futureBookingsCount !== 1 ? 's' : ''} that will be cancelled. 
                        Customers will be notified and any deposits will be refunded.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
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
                    <p className={`font-semibold ${staffConfirmData.type === 'add' ? 'text-brand-400' : 'text-yellow-400'}`}>
                      £{staffConfirmData.newPrice?.toFixed(2)}
                    </p>
                    <p className="text-gray-500 text-xs">{staffConfirmData.newStaffCount} staff</p>
                  </div>
                </div>
                <p className={`text-sm text-center mt-3 ${staffConfirmData.type === 'add' ? 'text-brand-400' : 'text-yellow-400'}`}>
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
                      ? 'bg-brand-500 text-black hover:bg-brand-400'
                      : staffConfirmData.futureBookingsCount > 0
                        ? 'bg-red-500 text-white hover:bg-red-400'
                        : 'bg-yellow-500 text-black hover:bg-yellow-400'
                  }`}
                >
                  {staffConfirmData.type === 'delete' && staffConfirmData.futureBookingsCount > 0 
                    ? 'Delete & Cancel Bookings'
                    : 'Confirm'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Customer Modal */}
      {showDeleteCustomerModal && customerToDelete && (
        <div className="fixed inset-0 bg-appbg/80 flex items-center justify-center z-50 p-4">
          <div className="bg-cardBg border border-zinc-800 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              
              <h3 className="text-white text-xl font-semibold text-center mb-2">
                Delete Customer Record
              </h3>
              
              <p className="text-gray-400 text-center mb-4">
                Are you sure you want to delete <span className="text-white font-medium">{customerToDelete.name}</span>'s record?
              </p>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 font-medium">What will happen</p>
                    <ul className="text-yellow-200/80 text-sm mt-1 space-y-1">
                      <li>• <strong>Future bookings</strong> will be cancelled and removed</li>
                      <li>• <strong>Past bookings</strong> will be preserved for revenue tracking</li>
                      <li>• Customer will no longer appear in your active customer list</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="bg-brand-500/10 border border-brand-500/30 rounded-lg p-4 mb-6">
                <p className="text-brand-400 text-sm">
                  <strong>Revenue preserved:</strong> Historical revenue from past appointments will still be included in your analytics.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteCustomerModal(false);
                    setCustomerToDelete(null);
                  }}
                  className="flex-1 bg-zinc-800 text-white font-semibold py-3 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCustomer}
                  className="flex-1 bg-red-500 text-white font-semibold py-3 rounded-lg hover:bg-red-400 transition-colors"
                  data-testid="confirm-delete-customer"
                >
                  Delete Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Book for Customer Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-appbg/80 flex items-center justify-center z-50 p-4">
          <div className="bg-cardBg border border-zinc-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-cardBg">
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500"
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
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500"
                  />
                  <input
                    type="email"
                    placeholder="Customer Email *"
                    value={bookingForm.customerEmail}
                    onChange={(e) => setBookingForm({...bookingForm, customerEmail: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500"
                  />
                  <input
                    type="tel"
                    placeholder="Customer Phone (Optional)"
                    value={bookingForm.customerPhone}
                    onChange={(e) => setBookingForm({...bookingForm, customerPhone: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              {/* Step 2: Service Selection */}
              <div>
                <label className="text-gray-400 text-sm block mb-2">Service</label>
                <select
                  value={bookingForm.serviceId}
                  onChange={(e) => setBookingForm({...bookingForm, serviceId: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500"
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
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500"
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500"
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
                              ? 'bg-brand-500 text-black'
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
                className="w-full bg-brand-500 text-black font-semibold py-3 rounded-lg hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Credentials Modal */}
      {newCustomerCredentials && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-cardBg border border-zinc-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-white text-lg font-semibold flex items-center gap-2">
                <Check className="w-5 h-5 text-green-400" />
                Booking Created - New Customer Account
              </h3>
              <button onClick={() => setNewCustomerCredentials(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                <p className="text-green-400 text-sm">
                  A new customer account has been created. Please share these login details with the customer so they can access their bookings.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="bg-zinc-800 rounded-lg p-4">
                  <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Email (Username)</label>
                  <div className="flex items-center justify-between">
                    <p className="text-white font-mono">{newCustomerCredentials.email}</p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(newCustomerCredentials.email);
                        alert('Email copied!');
                      }}
                      className="text-brand-400 hover:text-brand-300 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div className="bg-zinc-800 rounded-lg p-4">
                  <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Temporary Password</label>
                  <div className="flex items-center justify-between">
                    <p className="text-white font-mono text-lg">{newCustomerCredentials.temporaryPassword}</p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(newCustomerCredentials.temporaryPassword);
                        alert('Password copied!');
                      }}
                      className="text-brand-400 hover:text-brand-300 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-xs">
                  <strong>Note:</strong> The customer should change their password after first login for security.
                </p>
              </div>
              
              <button
                onClick={() => {
                  const text = `Your Calendrax Login Details:\n\nEmail: ${newCustomerCredentials.email}\nTemporary Password: ${newCustomerCredentials.temporaryPassword}\n\nPlease login at the Calendrax app and change your password.`;
                  navigator.clipboard.writeText(text);
                  alert('Login details copied to clipboard!');
                }}
                className="w-full mt-4 bg-brand-500 text-black font-semibold py-3 rounded-lg hover:bg-brand-400 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Copy All Details to Share
              </button>
              
              <button
                onClick={() => setNewCustomerCredentials(null)}
                className="w-full mt-2 bg-zinc-800 text-white font-medium py-3 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessOwnerDashboard;
