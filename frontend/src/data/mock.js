// Mock data for Booka app
// Using localStorage for persistence

const STORAGE_KEYS = {
  USERS: 'booka_users',
  BUSINESSES: 'booka_businesses',
  SERVICES: 'booka_services',
  APPOINTMENTS: 'booka_appointments',
  AVAILABILITY: 'booka_availability',
  NOTIFICATIONS: 'booka_notifications'
};

// Initialize with default data if not exists
const initializeData = () => {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    const defaultUsers = [
      {
        id: '1',
        email: 'customer@booka.com',
        password: 'password123',
        fullName: 'John Doe',
        mobile: '+1234567890',
        role: 'customer',
        createdAt: '2024-01-15'
      },
      {
        id: '2',
        email: 'owner@booka.com',
        password: 'password123',
        fullName: 'Jane Smith',
        mobile: '+0987654321',
        role: 'business_owner',
        businessName: 'Wellness Spa',
        createdAt: '2024-01-10'
      }
    ];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));
  }

  if (!localStorage.getItem(STORAGE_KEYS.BUSINESSES)) {
    const defaultBusinesses = [
      {
        id: 'b1',
        ownerId: '2',
        businessName: 'Wellness Spa',
        logo: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=100&h=100&fit=crop',
        postcode: 'SW1A 1AA',
        address: '10 Downing Street, London',
        description: 'Premium spa and wellness services',
        createdAt: '2024-01-10'
      },
      {
        id: 'b2',
        ownerId: '3',
        businessName: 'Beauty Bar',
        logo: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=100&h=100&fit=crop',
        postcode: 'M1 1AE',
        address: 'Market Street, Manchester',
        description: 'Expert beauty and skincare treatments',
        createdAt: '2024-02-05'
      },
      {
        id: 'b3',
        ownerId: '4',
        businessName: 'Fitness First Gym',
        logo: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop',
        postcode: 'B1 1AA',
        address: 'New Street, Birmingham',
        description: 'State-of-the-art fitness facility',
        createdAt: '2024-02-15'
      }
    ];
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(defaultBusinesses));
  }

  if (!localStorage.getItem(STORAGE_KEYS.SERVICES)) {
    const defaultServices = [
      { id: 's1', businessId: 'b1', name: 'Deep Tissue Massage', description: 'Intensive massage targeting deep muscle layers', duration: 60, price: 80, category: 'Massage', active: true },
      { id: 's2', businessId: 'b1', name: 'Swedish Massage', description: 'Relaxing full-body massage', duration: 45, price: 60, category: 'Massage', active: true },
      { id: 's3', businessId: 'b1', name: 'Facial Treatment', description: 'Rejuvenating facial treatment', duration: 30, price: 50, category: 'Skincare', active: true },
      { id: 's4', businessId: 'b2', name: 'Manicure', description: 'Professional nail care and polish', duration: 30, price: 35, category: 'Nails', active: true },
      { id: 's5', businessId: 'b2', name: 'Pedicure', description: 'Foot care and nail treatment', duration: 45, price: 45, category: 'Nails', active: true },
      { id: 's6', businessId: 'b3', name: 'Personal Training', description: 'One-on-one fitness training', duration: 60, price: 50, category: 'Fitness', active: true },
      { id: 's7', businessId: 'b3', name: 'Group Fitness Class', description: 'High-energy group workout', duration: 45, price: 15, category: 'Fitness', active: true }
    ];
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(defaultServices));
  }

  if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.AVAILABILITY)) {
    localStorage.setItem(STORAGE_KEYS.AVAILABILITY, JSON.stringify({}));
  }

  if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
  }
};

// Initialize on load
initializeData();

// Users
export const getUsers = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
export const setUsers = (users) => localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
export const addUser = (user) => {
  const users = getUsers();
  users.push(user);
  setUsers(users);
};
export const findUserByEmail = (email) => getUsers().find(u => u.email === email);

// Businesses
export const getBusinesses = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.BUSINESSES) || '[]');
export const setBusinesses = (businesses) => localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
export const addBusiness = (business) => {
  const businesses = getBusinesses();
  businesses.push(business);
  setBusinesses(businesses);
};
export const getBusinessesSorted = () => [...getBusinesses()].sort((a, b) => a.businessName.localeCompare(b.businessName));
export const getBusinessById = (id) => getBusinesses().find(b => b.id === id);
export const getBusinessByOwnerId = (ownerId) => getBusinesses().find(b => b.ownerId === ownerId);

// Services
export const getServices = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.SERVICES) || '[]');
export const setServices = (services) => localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
export const getServicesByBusinessId = (businessId) => getServices().filter(s => s.businessId === businessId);
export const getActiveServicesByBusinessId = (businessId) => getServices().filter(s => s.businessId === businessId && s.active);
export const addService = (service) => {
  const services = getServices();
  services.push(service);
  setServices(services);
};
export const updateService = (serviceId, updates) => {
  const services = getServices();
  const index = services.findIndex(s => s.id === serviceId);
  if (index !== -1) {
    services[index] = { ...services[index], ...updates };
    setServices(services);
  }
};
export const deleteService = (serviceId) => {
  const services = getServices().filter(s => s.id !== serviceId);
  setServices(services);
};
export const toggleServiceActive = (serviceId) => {
  const services = getServices();
  const index = services.findIndex(s => s.id === serviceId);
  if (index !== -1) {
    services[index].active = !services[index].active;
    setServices(services);
  }
};

// Appointments
export const getAppointments = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.APPOINTMENTS) || '[]');
export const setAppointments = (appointments) => localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
export const addAppointment = (appointment) => {
  const appointments = getAppointments();
  appointments.push(appointment);
  setAppointments(appointments);
  
  // Remove the booked slot from availability
  const availability = getAvailabilityData();
  const key = `${appointment.businessId}_${appointment.date}`;
  if (availability[key]) {
    availability[key] = availability[key].filter(slot => slot !== appointment.time);
    setAvailabilityData(availability);
  }
  
  return appointment;
};
export const getAppointmentsByUserId = (userId) => getAppointments().filter(a => a.userId === userId);
export const getAppointmentsByBusinessId = (businessId) => getAppointments().filter(a => a.businessId === businessId);
export const getPendingAppointmentsByBusinessId = (businessId) => getAppointments().filter(a => a.businessId === businessId && a.status === 'pending');
export const updateAppointmentStatus = (appointmentId, status) => {
  const appointments = getAppointments();
  const index = appointments.findIndex(a => a.id === appointmentId);
  if (index !== -1) {
    appointments[index].status = status;
    setAppointments(appointments);
    return appointments[index];
  }
  return null;
};
export const cancelAppointment = (appointmentId) => {
  const appointments = getAppointments();
  const index = appointments.findIndex(a => a.id === appointmentId);
  if (index !== -1) {
    appointments[index].status = 'cancelled';
    setAppointments(appointments);
  }
};
export const getCustomersByBusinessId = (businessId) => {
  const appointments = getAppointmentsByBusinessId(businessId);
  const customerMap = new Map();
  
  appointments.forEach(apt => {
    if (!customerMap.has(apt.userId)) {
      customerMap.set(apt.userId, {
        userId: apt.userId,
        customerName: apt.customerName,
        customerEmail: apt.customerEmail,
        bookings: []
      });
    }
    customerMap.get(apt.userId).bookings.push(apt);
  });
  
  return Array.from(customerMap.values());
};
export const deleteCustomerBookings = (businessId, userId) => {
  const appointments = getAppointments().filter(a => !(a.businessId === businessId && a.userId === userId));
  setAppointments(appointments);
};
export const clearCustomerHistory = (businessId, userId) => {
  const appointments = getAppointments().map(a => {
    if (a.businessId === businessId && a.userId === userId) {
      return { ...a, status: 'cleared' };
    }
    return a;
  });
  setAppointments(appointments);
};

// Availability
export const getAvailabilityData = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.AVAILABILITY) || '{}');
export const setAvailabilityData = (data) => localStorage.setItem(STORAGE_KEYS.AVAILABILITY, JSON.stringify(data));
export const setAvailability = (businessId, date, slots) => {
  const availability = getAvailabilityData();
  const key = `${businessId}_${date}`;
  availability[key] = slots;
  setAvailabilityData(availability);
};
export const getAvailability = (businessId, date) => {
  const availability = getAvailabilityData();
  const key = `${businessId}_${date}`;
  return availability[key] || [];
};

// Notifications
export const getNotifications = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
export const setNotifications = (notifications) => localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
export const addNotification = (notification) => {
  const notifications = getNotifications();
  notifications.unshift({ ...notification, id: `n_${Date.now()}`, createdAt: new Date().toISOString(), read: false });
  setNotifications(notifications);
};
export const getNotificationsByUserId = (userId) => getNotifications().filter(n => n.userId === userId);
export const getUnreadNotificationsByUserId = (userId) => getNotifications().filter(n => n.userId === userId && !n.read);
export const markNotificationAsRead = (notificationId) => {
  const notifications = getNotifications();
  const index = notifications.findIndex(n => n.id === notificationId);
  if (index !== -1) {
    notifications[index].read = true;
    setNotifications(notifications);
  }
};
export const markAllNotificationsAsRead = (userId) => {
  const notifications = getNotifications().map(n => {
    if (n.userId === userId) {
      return { ...n, read: true };
    }
    return n;
  });
  setNotifications(notifications);
};

// Generate time slots at 15-minute intervals
export const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 8; hour < 20; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};

// For backwards compatibility
export const mockServices = getServices();
export const mockAppointments = getAppointments();
export const mockBusinesses = getBusinesses();
export const mockUsers = getUsers();
