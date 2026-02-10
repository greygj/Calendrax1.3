# Calendrax - Booking Application PRD

## Original Problem Statement
Create "Calendrax," a comprehensive booking application with:
- Business Owner features (dashboard, services, staff, customers, calendar, notifications)
- Customer features (browse, book, manage bookings, profile)
- Platform Admin system
- Payments & Subscriptions (Stripe)
- Legal & Onboarding compliance

## User Personas
1. **Business Owner** - Manages services, staff, bookings, receives deposits
2. **Customer** - Browses businesses, books appointments
3. **Platform Admin** - Oversees all businesses, manages platform

## Core Requirements
- Multi-role authentication (JWT-based)
- Service and staff management with auto-assignment
- Calendar availability management (5am-11pm slots)
- Booking system with deposits (Stripe Connect, 5% platform fee)
- Subscription system (£10/month base + £5/additional staff, 30-day trial)
- Notification system (Email, WhatsApp)
- GDPR-compliant cookie consent

## UI Theme
- Background: `#313D4A`
- Cards: `#202830`  
- Accent: `#A69B90`
- Logo: Transparent Calendrax logo

## Tech Stack
- **Frontend:** React, Tailwind CSS, shadcn/ui
- **Backend:** FastAPI, Python
- **Database:** MongoDB
- **Payments:** Stripe (Live keys)
- **Notifications:** Twilio (WhatsApp)
- **Deployment:** Railway

---

## Completed Features

### Dec 2025 - Feb 2026
- [x] Full authentication system with role-based access
- [x] Business owner dashboard with all management features
- [x] Customer dashboard and booking flow
- [x] Platform admin dashboard
- [x] Stripe subscriptions with automatic invoicing
- [x] Stripe Connect for business deposits
- [x] Service/Staff auto-assignment (new service → all staff, new staff → all services)
- [x] Revenue analytics (by service, by staff, monthly tables 2026-2030)
- [x] Billing history and invoice viewing
- [x] Customer management with alphabetical list and deletion
- [x] Business profile with logo upload
- [x] Extended availability (5am-11pm)
- [x] Cookie consent banner (GDPR)
- [x] Terms & Privacy pages with content
- [x] Currency changed to GBP (£)
- [x] Dashboard reminder banners (bank account, payment method)
- [x] **Customer Dashboard Mobile Redesign** (Feb 2026)
  - Full-width navigation buttons
  - Removed top tab bar
  - Logout button at bottom
  - Home button for sub-view navigation
- [x] **Business Owner Dashboard Mobile Redesign** (Feb 2026)
  - Full-width navigation buttons with subtitles
  - Shows counts (appointments, services, staff, customers)
  - Removed top tab bar
  - Logout button at bottom
  - Back to Dashboard button in header for sub-views
- [x] **PWA "Add to Home Screen"** - InstallPrompt component, manifest.json
- [x] **Profile Enhancements** - Change password, email/WhatsApp notification toggles
- [x] **Customer Reviews System** - Full review submission, admin deletion, ratings display
- [x] **Auto Customer Account Creation** - Business owner booking creates customer with temp password
- [x] **Date Formatting** - All dates in dd-mm-yyyy format using dateUtils.js
- [x] **WhatsApp Notifications** (Feb 2026)
  - Twilio integration for WhatsApp messaging
  - Notification templates for booking events
  - User preferences respected (email/whatsapp toggles)
  - Test endpoint for admin verification
- [x] **SendGrid Email Integration** (Feb 2026)
  - SendGrid API configured for transactional emails
  - Booking confirmations, reminders, and notifications
  - From address: bookings@calendrax.co.uk
- [x] **Forgot Password Feature** (Feb 2026)
  - Password reset via email link
  - Secure token-based reset (1 hour expiry)
  - Beautiful email template with Calendrax branding
  - Reset password page with confirmation
- [x] **Trial Expiration Reminders** (Feb 2026)
  - Automatic daily check at 9:00 AM UTC
  - Reminders sent at 7, 3, and 1 day(s) before expiry
  - Email and WhatsApp notifications (based on user preferences)
  - Admin dashboard "Trials" tab for monitoring
  - Manual "Send Reminders Now" button for admin

---

## Prioritized Backlog

### P0 - Critical (Blocked)
- None - all critical features implemented!

### P1 - High Priority
- [ ] Appointment reminders (24h before booking) - scheduled task

### P2 - Medium Priority
- [ ] Google Maps API integration (currently basic embed)
- [ ] Backend refactoring (server.py → modular routes/models/services)
- [ ] Frontend refactoring (BusinessOwnerDashboard.js → smaller components)
- [ ] Export analytics as CSV/PDF reports

---

## Technical Debt
1. **BusinessOwnerDashboard.js** - 3000+ lines, needs component breakdown
2. **server.py** - Monolithic, needs modular structure

## Environment Variables (Railway)
Required for production:
```
FRONTEND_URL=https://calendrax13-production.up.railway.app
MONGO_URL=<production_mongo_url>
DB_NAME=<production_db>
STRIPE_API_KEY=<live_stripe_key>
TWILIO_ACCOUNT_SID=<twilio_sid>
TWILIO_AUTH_TOKEN=<twilio_token>
TWILIO_WHATSAPP_NUMBER=<whatsapp_number>
SENDGRID_API_KEY=<pending>
SENDGRID_FROM_EMAIL=<pending>
```

## Test Credentials
- Admin: `admin@booka.com` / `admin123`
- Business Owner: `greygj@gmail.com` / `password123`
- Customer: `gareth.grey@tickety-moo.com` / `password123`
