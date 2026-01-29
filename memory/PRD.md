# Booka - Booking App PRD

## Original Problem Statement
Create a pixel-perfect clone of the "JG clinic app" (URL: https://bookingjg-production-a3e1.up.railway.app) and name it "Booka".

## Core Requirements

### Business Owner Features
- Sign up with fields for business name, logo upload, postcode, and description
- Dashboard with calendar (up to 6 months) to set availability in 15-minute slots
- Manage services: Add, Edit, Delete, and set Active/Inactive status
- View booking history per customer on a "Customers" page
- Receive notifications for new booking requests and Approve/Decline them

### Customer Features
- Dashboard listing all registered and approved businesses alphabetically
- Business page with services and embedded Google Map
- Receive notifications when booking is requested and confirmed
- "My Bookings" page to view and cancel bookings

### Platform Admin System
- Secure admin dashboard at `/admin` (platform_admin role only)
- View all users and businesses, edit details, suspend/delete accounts
- Approve new businesses before they become visible to customers
- UI placeholders for managing subscriptions and payments

### UI/UX Requirements
- Dark theme with lime green accents
- Responsive design for mobile devices
- User accounts must persist after logout

## Tech Stack
- **Frontend**: React, React Router, Tailwind CSS, shadcn/ui, Axios
- **Backend**: FastAPI, Python, MongoDB (motor for async)
- **Authentication**: JWT with password hashing (hashlib)

## Architecture
```
/app
├── backend/
│   ├── server.py         # All routes, models, and logic
│   └── tests/            # pytest test files
├── frontend/
│   └── src/
│       ├── context/AuthContext.js
│       ├── pages/
│       │   ├── AdminDashboard.js
│       │   ├── BusinessOwnerDashboard.js
│       │   ├── CustomerDashboard.js
│       │   ├── Login.js
│       │   └── Signup.js
│       └── services/api.js
```

## Database Schema
- **users**: `{id, fullName, email, password, role, suspended, createdAt}`
- **businesses**: `{id, ownerId, businessName, description, logo, postcode, approved, rejected}`
- **services**: `{id, businessId, name, description, duration, price, active}`
- **appointments**: `{id, userId, businessId, serviceId, date, time, status, paymentStatus}`
- **availability**: `{id, businessId, date, slots[]}`
- **notifications**: `{id, userId, type, title, message, read}`
- **subscriptions**: `{id, businessId, ownerId, plan, status}`

## Credentials
- **Admin**: admin@booka.com / admin123

---

## Completed Features (January 29, 2026)

### Phase 1: Core Authentication ✅
- [x] JWT-based authentication with three roles (Customer, Business Owner, Platform Admin)
- [x] Separate signup flows for Customer and Business Owner
- [x] Business owner signup includes: business name, logo upload, description, postcode
- [x] Login functionality for all user types
- [x] Data persistence after logout

### Phase 2: Customer Portal ✅
- [x] Customer dashboard with approved businesses list (alphabetical)
- [x] Business browsing with logo, description, and postcode
- [x] "My Bookings" page structure

### Phase 3: Business Owner Portal ✅
- [x] Business owner dashboard
- [x] Service management (CRUD)
- [x] Availability calendar
- [x] Appointments management
- [x] Customers page

### Phase 4: Admin Platform ✅
- [x] Secure /admin route with role-based access
- [x] Dashboard with stats (users, businesses, bookings)
- [x] User management (view, edit, suspend, delete)
- [x] Business management with approval/rejection workflow
- [x] Pending approval notifications
- [x] Subscriptions tab (UI placeholder - MOCKED)
- [x] Bookings management tab

### Bug Fixes ✅
- [x] Fixed MongoDB ObjectId serialization in login response
- [x] Fixed MongoDB ObjectId serialization in registration response
- [x] Fixed data persistence on logout

---

## MOCKED Features (Not Yet Implemented)
- **Payment/Subscription System**: UI placeholders only, no Stripe integration
- **Refund Processing**: UI only, no actual refund logic
- **Google Maps API**: Basic embed without API key

---

## Upcoming Tasks (P1)
1. Implement Stripe integration for business subscriptions
2. Implement customer payment flow for bookings
3. Add Google Maps API for accurate business location display

## Future/Backlog (P2)
1. Email notifications for bookings
2. SMS notifications via Twilio
3. Refactor server.py into modular structure (routes/, models/, auth/)
4. Advanced analytics for business owners
5. Customer reviews and ratings
