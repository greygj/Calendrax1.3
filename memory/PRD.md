# Booka - Booking App PRD

## Original Problem Statement
Create a pixel-perfect clone of the "JG clinic app" (URL: https://bookingjg-production-a3e1.up.railway.app) and name it "Bookle".

## Core Requirements

### Business Owner Features
- Sign up with fields for business name, logo upload, postcode, and description
- Dashboard with calendar (up to 6 months) to set availability in 15-minute slots
- Manage services: Add, Edit, Delete, and set Active/Inactive status
- View booking history per customer on a "Customers" page
- Receive notifications for new booking requests and Approve/Decline them
- **NEW: Multi-staff booking system** - up to 5 staff members per business
- **NEW: Staff-based availability** - each staff member has their own availability calendar
- **NEW: Book for Customer** - business owner can create bookings for customers directly
- **NEW: Profile page** - edit business details (name, description, postcode, address, phone, email, website)

### Customer Features
- Dashboard listing all registered and approved businesses alphabetically
- Business page with services and embedded Google Map
- **NEW: Staff selection** - when multiple staff offer a service, customer selects which staff member
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
- **Bookle branding** with custom logo

## Tech Stack
- **Frontend**: React, React Router, Tailwind CSS, shadcn/ui, Axios
- **Backend**: FastAPI, Python, MongoDB (motor for async)
- **Authentication**: JWT with password hashing (hashlib)
- **Notifications**: SendGrid (email), Twilio (SMS) - configured but pending API keys

## Architecture
```
/app
├── backend/
│   ├── server.py         # All routes, models, and logic
│   ├── notifications.py  # Email/SMS notification service
│   └── tests/            # pytest test files
├── frontend/
│   └── src/
│       ├── context/AuthContext.js
│       ├── pages/
│       │   ├── AdminDashboard.js
│       │   ├── BusinessOwnerDashboard.js (multi-staff, profile, book for customer)
│       │   ├── BusinessPage.js (staff selection)
│       │   ├── CustomerDashboard.js
│       │   ├── Login.js
│       │   └── Signup.js
│       └── services/api.js
```

## Database Schema
- **users**: `{id, fullName, email, password, role, suspended, createdAt}`
- **businesses**: `{id, ownerId, businessName, description, logo, postcode, address, phone, email, website, approved, rejected}`
- **services**: `{id, businessId, name, description, duration, price, active}`
- **staff**: `{id, businessId, name, serviceIds[], isOwner, active}`
- **appointments**: `{id, userId, businessId, serviceId, staffId, staffName, date, time, status, paymentStatus, bookedByOwner}`
- **availability**: `{businessId, staffId, date, slots[]}`
- **notifications**: `{id, userId, type, title, message, read}`
- **subscriptions**: `{id, businessId, ownerId, plan, status}`

## Credentials
- **Admin**: admin@booka.com / admin123
- **Business Owner**: greygj@gmail.com / password123

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
- [x] Business page with services, staff selection, and booking flow
- [x] "My Bookings" page structure

### Phase 3: Business Owner Portal ✅
- [x] Business owner dashboard with stats
- [x] Service management (CRUD with delete fixed)
- [x] Availability calendar (per staff member)
- [x] Appointments management with approve/decline
- [x] Customers page
- [x] **NEW: Staff Management** - add, edit, delete staff (up to 5)
- [x] **NEW: Staff-based availability** - each staff has own calendar
- [x] **NEW: Profile Page** - edit business details
- [x] **NEW: Book for Customer** - create bookings directly for customers

### Phase 4: Admin Platform ✅
- [x] Secure /admin route with role-based access
- [x] Dashboard with stats (users, businesses, bookings)
- [x] User management (view, edit, suspend, delete)
- [x] Business management with approval/rejection workflow
- [x] Pending approval notifications
- [x] Subscriptions tab (UI placeholder - MOCKED)
- [x] Bookings management tab

### Phase 5: Notifications ✅
- [x] In-app notifications for bookings
- [x] Email notification templates (SendGrid) - **PENDING API KEY**
- [x] SMS notification templates (Twilio) - **PENDING API KEY**
- [x] Notification triggers: booking created, approved, declined, cancelled

### Bug Fixes ✅
- [x] Fixed MongoDB ObjectId serialization in all endpoints
- [x] Fixed service delete button not working
- [x] Fixed data persistence on logout
- [x] Updated branding from "Booka" to "Bookle"

---

## MOCKED Features (Not Yet Implemented)
- **Payment/Subscription System**: UI placeholders only, no Stripe integration
- **Refund Processing**: UI only, no actual refund logic
- **Google Maps API**: Basic embed without API key
- **Email Notifications**: Code ready, awaiting SendGrid API key
- **SMS Notifications**: Code ready, awaiting Twilio credentials

---

## Environment Variables Needed
```
# SendGrid (for email notifications)
SENDGRID_API_KEY=your_api_key
SENDGRID_FROM_EMAIL=your_verified_email@domain.com

# Twilio (for SMS notifications)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890
```

---

## Upcoming Tasks (P1)
1. Implement Stripe integration for business subscriptions
2. Implement customer payment flow for bookings
3. Add Google Maps API for accurate business location display

## Future/Backlog (P2)
1. Customer reviews and ratings
2. Advanced analytics for business owners
3. Refactor server.py into modular structure (routes/, models/, auth/)
