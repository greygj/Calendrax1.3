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
    createdAt: '2024-01-10'
  }
];

// Business profiles (for business owners)
export const mockBusinesses = [
  {
    id: 'b1',
    ownerId: '2',
    businessName: 'Wellness Spa',
    logo: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=100&h=100&fit=crop',
    postcode: 'SW1A 1AA',
    address: '10 Downing Street, London',
    description: 'Premium spa and wellness services',
    services: ['s1', 's2', 's3'],
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
    services: ['s4', 's5'],
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
    services: ['s6', 's7'],
    createdAt: '2024-02-15'
  },
  {
    id: 'b4',
    ownerId: '5',
    businessName: 'Glow Skincare Studio',
    logo: null,
    postcode: 'EH1 1YZ',
    address: 'Princes Street, Edinburgh',
    description: 'Professional skincare treatments',
    services: ['s8'],
    createdAt: '2024-03-01'
  },
  {
    id: 'b5',
    ownerId: '6',
    businessName: 'Zen Massage Therapy',
    logo: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=100&h=100&fit=crop',
    postcode: 'CF10 1BH',
    address: 'Queen Street, Cardiff',
    description: 'Relaxation and therapeutic massage',
    services: ['s1', 's2'],
    createdAt: '2024-03-10'
  }
];

export const mockServices = [
  {
    id: 's1',
    name: 'Deep Tissue Massage',
    description: 'Intensive massage targeting deep muscle layers',
    duration: 60,
    price: 80,
    category: 'Massage'
  },
  {
    id: 's2',
    name: 'Swedish Massage',
    description: 'Relaxing full-body massage',
    duration: 45,
    price: 60,
    category: 'Massage'
  },
  {
    id: 's3',
    name: 'Facial Treatment',
    description: 'Rejuvenating facial treatment',
    duration: 30,
    price: 50,
    category: 'Skincare'
  },
  {
    id: 's4',
    name: 'Manicure',
    description: 'Professional nail care and polish',
    duration: 30,
    price: 35,
    category: 'Nails'
  },
  {
    id: 's5',
    name: 'Pedicure',
    description: 'Foot care and nail treatment',
    duration: 45,
    price: 45,
    category: 'Nails'
  },
  {
    id: 's6',
    name: 'Personal Training Session',
    description: 'One-on-one fitness training',
    duration: 60,
    price: 50,
    category: 'Fitness'
  },
  {
    id: 's7',
    name: 'Group Fitness Class',
    description: 'High-energy group workout session',
    duration: 45,
    price: 15,
    category: 'Fitness'
  },
  {
    id: 's8',
    name: 'Anti-Aging Facial',
    description: 'Advanced skincare treatment for youthful skin',
    duration: 60,
    price: 95,
    category: 'Skincare'
  }
];

export const mockAppointments = [
  {
    id: '1',
    oderId: '1',
    businessId: 'b1',
    serviceId: 's1',
    date: '2024-07-20',
    time: '10:00',
    status: 'confirmed',
    customerName: 'John Doe'
  },
  {
    id: '2',
    userId: '1',
    businessId: 'b1',
    serviceId: 's2',
    date: '2024-07-25',
    time: '14:30',
    status: 'pending',
    customerName: 'John Doe'
  }
];

// Available time slots set by business owners
// Key format: "businessId_YYYY-MM-DD"
export const mockAvailability = {};

export const validRegistrationCodes = ['BOOKA2024', 'OWNER123', 'BUSINESS2024'];

// Helper function to add a new business
export const addBusiness = (business) => {
  mockBusinesses.push(business);
};

// Helper function to get businesses sorted alphabetically
export const getBusinessesSorted = () => {
  return [...mockBusinesses].sort((a, b) => 
    a.businessName.localeCompare(b.businessName)
  );
};

// Helper function to set availability for a business on a specific date
export const setAvailability = (businessId, date, slots) => {
  const key = `${businessId}_${date}`;
  mockAvailability[key] = slots;
};

// Helper function to get availability for a business on a specific date
export const getAvailability = (businessId, date) => {
  const key = `${businessId}_${date}`;
  return mockAvailability[key] || [];
};

// Helper function to add an appointment
export const addAppointment = (appointment) => {
  mockAppointments.push(appointment);
  // Remove the booked slot from availability
  const key = `${appointment.businessId}_${appointment.date}`;
  if (mockAvailability[key]) {
    mockAvailability[key] = mockAvailability[key].filter(slot => slot !== appointment.time);
  }
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
