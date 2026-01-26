// Mock data for Booka app

export const mockUsers = [
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
    registrationCode: 'BOOKA2024',
    createdAt: '2024-01-10'
  }
];

export const mockServices = [
  {
    id: '1',
    name: 'Deep Tissue Massage',
    description: 'Intensive massage targeting deep muscle layers',
    duration: 60,
    price: 80,
    category: 'Massage'
  },
  {
    id: '2',
    name: 'Swedish Massage',
    description: 'Relaxing full-body massage',
    duration: 45,
    price: 60,
    category: 'Massage'
  },
  {
    id: '3',
    name: 'Facial Treatment',
    description: 'Rejuvenating facial treatment',
    duration: 30,
    price: 50,
    category: 'Skincare'
  }
];

export const mockAppointments = [
  {
    id: '1',
    userId: '1',
    serviceId: '1',
    date: '2024-07-20',
    time: '10:00',
    status: 'confirmed'
  },
  {
    id: '2',
    userId: '1',
    serviceId: '2',
    date: '2024-07-25',
    time: '14:30',
    status: 'pending'
  }
];

export const validRegistrationCodes = ['BOOKA2024', 'OWNER123', 'BUSINESS2024'];
