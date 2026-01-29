import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create axios instance with interceptors
const apiClient = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('booka_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('booka_token');
      localStorage.removeItem('booka_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  getMe: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.put('/auth/profile', data)
};

// Businesses
export const businessAPI = {
  getAll: () => apiClient.get('/businesses'),
  getById: (id) => apiClient.get(`/businesses/${id}`),
  getServices: (id) => apiClient.get(`/businesses/${id}/services`),
  getStaff: (id) => apiClient.get(`/businesses/${id}/staff`),
  getMine: () => apiClient.get('/my-business'),
  updateMine: (data) => apiClient.put('/my-business', data)
};

// Services
export const serviceAPI = {
  create: (data) => apiClient.post('/services', data),
  getMyServices: () => apiClient.get('/my-services'),
  update: (id, data) => apiClient.put(`/services/${id}`, data),
  delete: (id) => apiClient.delete(`/services/${id}`)
};

// Staff
export const staffAPI = {
  getAll: () => apiClient.get('/staff'),
  create: (data) => apiClient.post('/staff', data),
  update: (id, data) => apiClient.put(`/staff/${id}`, data),
  delete: (id) => apiClient.delete(`/staff/${id}`)
};

// Availability
export const availabilityAPI = {
  get: (businessId, date, staffId = null) => {
    if (staffId) {
      return apiClient.get(`/availability/${businessId}/${staffId}/${date}`);
    }
    return apiClient.get(`/availability/${businessId}/${date}`);
  },
  set: (businessId, date, slots, staffId = null) => {
    let url = `/availability?business_id=${businessId}&date=${date}`;
    if (staffId) {
      url += `&staff_id=${staffId}`;
    }
    return apiClient.post(url, slots);
  }
};

// Appointments
export const appointmentAPI = {
  create: (data) => apiClient.post('/appointments', data),
  bookForCustomer: (data) => apiClient.post('/appointments/book-for-customer', data),
  getMine: () => apiClient.get('/my-appointments'),
  getBusinessAppointments: () => apiClient.get('/business-appointments'),
  getBusinessCustomers: () => apiClient.get('/business-customers'),
  updateStatus: (id, status) => apiClient.put(`/appointments/${id}/status?status=${status}`),
  cancel: (id) => apiClient.put(`/appointments/${id}/cancel`)
};

// Notifications
export const notificationAPI = {
  getAll: () => apiClient.get('/notifications'),
  markRead: (id) => apiClient.put(`/notifications/${id}/read`),
  markAllRead: () => apiClient.put('/notifications/read-all')
};

// Admin
export const adminAPI = {
  getStats: () => apiClient.get('/admin/stats'),
  
  // Users
  getUsers: () => apiClient.get('/admin/users'),
  getUser: (id) => apiClient.get(`/admin/users/${id}`),
  updateUser: (id, data) => apiClient.put(`/admin/users/${id}`, data),
  deleteUser: (id) => apiClient.delete(`/admin/users/${id}`),
  
  // Businesses
  getBusinesses: () => apiClient.get('/admin/businesses'),
  updateBusiness: (id, data) => apiClient.put(`/admin/businesses/${id}`, data),
  deleteBusiness: (id) => apiClient.delete(`/admin/businesses/${id}`),
  
  // Subscriptions
  getSubscriptions: () => apiClient.get('/admin/subscriptions'),
  updateSubscription: (id, data) => apiClient.put(`/admin/subscriptions/${id}`, data),
  
  // Appointments
  getAppointments: () => apiClient.get('/admin/appointments'),
  refundAppointment: (id, amount) => apiClient.put(`/admin/appointments/${id}/refund?amount=${amount}`)
};

export default apiClient;
