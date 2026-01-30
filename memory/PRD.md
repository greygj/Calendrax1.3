# Calendrax - Booking App PRD

## Original Problem Statement
Create a pixel-perfect clone of the "JG clinic app" (URL: https://bookingjg-production-a3e1.up.railway.app) and name it "Calendrax".

## Core Requirements

### Business Owner Features
- Sign up with fields for business name, logo upload, postcode, and description
- Dashboard with calendar (up to 6 months) to set availability in 15-minute slots
- Manage services: Add, Edit, Delete, and set Active/Inactive status
- View booking history per customer on a "Customers" page
- Receive notifications for new booking requests and Approve/Decline them
- **Multi-staff booking system** - up to 5 staff members per business
- **Staff-based availability** - each staff member has their own availability calendar
- **Book for Customer** - business owner can create bookings for customers directly
- **Profile page** - edit business details (name, description, postcode, address, phone, email, website)

### Customer Features
- **Dashboard homepage** with welcome message, quick stats, upcoming bookings preview
- **Browse Businesses** page listing all registered and approved businesses alphabetically
- Business page with services, staff selection, and booking flow
- **Booking confirmation** message on screen after successful booking request
- **"My Bookings"** page for upcoming/pending bookings with cancel option
- **"Booking History"** page for past/cancelled/completed bookings
- **Profile page** with editable mandatory fields (Name, Email, Phone)
- **Dashboard button** on all pages for easy navigation
- Receive notifications when booking is requested and confirmed
- **Staff selection** - when multiple staff offer a service, customer selects which staff member

### Platform Admin System
- Secure admin dashboard at `/admin` (platform_admin role only)
- View all users and businesses, edit details, suspend/delete accounts
- Approve new businesses before they become visible to customers
- UI placeholders for managing subscriptions and payments

### UI/UX Requirements
- Dark theme with lime green accents
- Responsive design for mobile devices
- User accounts must persist after logout
- **Calendrax branding** with large custom logo
- Consistent navigation across all user pages

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
│       │   ├── BusinessPage.js (staff selection, dashboard button)
│       │   ├── CustomerDashboard.js (dashboard, profile, history)
│       │   ├── Login.js
│       │   └── Signup.js
│       └── services/api.js
```

## Database Schema
- **users**: `{id, fullName, email, mobile, password, role, suspended, createdAt}`
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
- **Customer**: testcustomer@test.com / test123

---

## Completed Features (January 29, 2026)

### Phase 1: Core Authentication ✅
- [x] JWT-based authentication with three roles (Customer, Business Owner, Platform Admin)
- [x] Separate signup flows for Customer and Business Owner
- [x] Business owner signup includes: business name, logo upload, description, postcode
- [x] Login functionality for all user types
- [x] Data persistence after logout

### Phase 2: Customer Portal ✅
- [x] **Dashboard homepage** with welcome message and quick stats
- [x] Customer dashboard with approved businesses list (alphabetical)
- [x] Business page with services, staff selection, and booking flow
- [x] **Booking confirmation** message after successful booking
- [x] **"My Bookings"** page for upcoming/pending bookings
- [x] **"Booking History"** page for past bookings (separated from active bookings)
- [x] **Profile page** with editable Name, Email, Phone (all mandatory)
- [x] **Dashboard button** on business pages for easy navigation
- [x] **Larger Calendrax logo** on Browse Businesses screen

### Phase 3: Business Owner Portal ✅
- [x] Business owner dashboard with stats
- [x] Service management (CRUD with delete fixed)
- [x] Availability calendar (per staff member)
- [x] Appointments management with approve/decline
- [x] Customers page
- [x] **Staff Management** - add, edit, delete staff (up to 5)
- [x] **Staff-based availability** - each staff has own calendar
- [x] **Profile Page** - edit business details
- [x] **Book for Customer** - create bookings directly for customers

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

### Phase 6: Payment Integration ✅ (January 29, 2026)
- [x] Stripe payment integration for booking deposits
- [x] Offer code system for testing (TESTFREE, BOOKLE100, STAFF2025 bypass payment)
- [x] Payment checkout session creation with Stripe
- [x] Payment status verification and polling
- [x] Booking completion after payment/bypass
- [x] Frontend booking flow with payment summary
- [x] "Complete Booking (Free)" option when valid offer code applied
- [x] BookingSuccess page for post-payment confirmation

### Phase 7: Stripe Connect & Subscription System ✅ (January 30, 2026)
- [x] **Dual Stripe Payment System** - Refactored to support two separate payment flows:
  - **Customer Deposits → Business Owners** via Stripe Connect (destination charges)
  - **Platform Subscription Fees → Calendrax** via standard Stripe
- [x] **Stripe Connect Integration** - Business owners can connect bank accounts to receive deposits directly
- [x] **Configurable Deposit Levels** - Business owners choose: No deposit, 10%, 20% (default), 50%, Pay in Full
- [x] **Staff-based Subscription Pricing**:
  - 1 Staff: £12/month (base)
  - 2 Staff: £20/month (+£8)
  - 3 Staff: £28/month (+£8)
  - 4 Staff: £36/month (+£8)
  - 5 Staff: £44/month (+£8)
- [x] **30-day Free Trial** - No payment required until trial ends
- [x] **Subscription Notifications** - Confirmation dialog when adding/removing staff shows price change
- [x] **Failed Payment Lockout** - Business owners blocked from login if subscription fails
- [x] **Admin Free Access Override** - Admin can grant/revoke free access to any business

### Phase 8: Revenue & Auto-Refunds ✅ (January 30, 2026)
- [x] **Auto-Refund on Decline** - When business declines a booking, deposit is automatically refunded via Stripe
- [x] **Staff Deletion Warning** - Shows count of future bookings that will be cancelled, refunds deposits automatically
- [x] **Revenue Dashboard** - New tab for business owners showing:
  - Total revenue for current week, month, and year
  - Week-over-week comparison with percentage change
  - Month-over-month comparison with percentage change
  - Revenue breakdown by staff member (week/month/year)
  - Booking counts for each period
  - Trending indicators (up/down arrows)

### Phase 9: Booking History ✅ (January 30, 2026)
- [x] **Customer Booking History** - Past bookings automatically move from "My Bookings" to "Booking History" when date passes
- [x] **Business Appointment History** - Added "Current" and "History" tabs to Appointments page
  - Current tab shows pending and confirmed upcoming appointments
  - History tab shows completed, cancelled, and declined appointments
- [x] Past confirmed bookings automatically show as "Completed" status

### Bug Fixes ✅
- [x] Fixed MongoDB ObjectId serialization in all endpoints
- [x] Fixed service delete button not working
- [x] Fixed staff delete button not working
- [x] Fixed data persistence on logout
- [x] Updated branding from "Booka" to "Calendrax"

---

## MOCKED Features (Not Yet Fully Implemented)
- **Stripe Connect Onboarding** - Backend code is ready but the Stripe account needs to be enrolled in Stripe Connect program
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

# Stripe (for payment processing) - Already configured
STRIPE_API_KEY=sk_test_emergent
```

---

## Subscription Pricing
| Staff Count | Monthly Price |
|-------------|---------------|
| 1 | £12.00 |
| 2 | £20.00 |
| 3 | £28.00 |
| 4 | £36.00 |
| 5 | £44.00 |

## Deposit Level Options
| Setting | Customer Pays |
|---------|---------------|
| No Deposit | £0 (book without payment) |
| 10% | 10% of service price |
| 20% | 20% of service price (default) |
| 50% | 50% of service price |
| Pay in Full | 100% of service price |

## Offer Codes for Testing
| Code | Description |
|------|-------------|
| TESTFREE | Bypasses payment for testing |
| BOOKLE100 | 100% discount for testing |
| STAFF2025 | Staff testing code |

---

### Phase 8: Payout History & Advanced Analytics ✅ (January 30, 2026)
- [x] **Payout History Tab** - New dashboard for business owners to track customer deposits:
  - Summary cards: Total Received, This Month, Year to Date, Net Received
  - Comparison with previous month
  - Bank account connection status notice
  - Transaction history list with service details
  - Refund tracking
- [x] **Advanced Analytics Tab** - Comprehensive business insights:
  - Key Metrics: Total Bookings, Avg Booking Value, Conversion Rate, Customer Retention
  - Most Popular Services ranking with revenue
  - Peak Booking Hours with visual bars
  - Busiest Days of the week
  - Booking Status Breakdown (confirmed, declined, etc.)
  - Customer Insights (total, repeat, first-time)
  - 6-Month Trend chart showing bookings and revenue

## Upcoming Tasks (P1)
1. Enable Stripe Connect on your Stripe account to activate business payout functionality
2. Add Google Maps API for accurate business location display
3. Provide SendGrid/Twilio API keys to enable email/SMS notifications

## Future/Backlog (P2)
1. Customer reviews and ratings
2. Refactor server.py into modular structure (routes/, models/, auth/)
