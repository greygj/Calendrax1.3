# Calendrax PRD (Product Requirements Document)

## Overview
Calendrax is a full-stack booking platform for service-based businesses. It enables business owners to manage appointments, services, staff, and accept payments, while customers can browse businesses and book services.

## Tech Stack
- **Frontend**: React.js, Tailwind CSS, Stripe Elements
- **Backend**: Python FastAPI, Motor (async MongoDB driver)
- **Database**: MongoDB Atlas
- **Payments**: Stripe Connect
- **Notifications**: Twilio (WhatsApp), SendGrid (Email)
- **Deployment**: Railway

## Core Features

### 1. User Roles
- **Customers**: Browse businesses, book services, manage appointments
- **Business Owners**: Manage services, staff, availability, accept payments
- **Platform Admin**: Approve businesses, manage users, grant free access

### 2. Calendrax Centurions (Founding Members Program)
First 100 business signups get special "Centurion" status with lifetime benefits:

**Pricing**:
- **Centurion**: £10/month (1 staff) + £5/month per additional staff
- **Standard**: £16/month (1 staff) + £8/month per additional staff

**Benefits**:
- Lifetime protected pricing
- Referral discount (TBD)
- Influence over future features
- Early access to new tools
- Free onboarding support
- Public founding member recognition (badge on public page + Founding Members page)

**Implementation**:
- Landing page counter showing current Centurion count
- Opt-in checkbox during business signup (hidden after 100)
- Mandatory card capture at signup (30-day free trial, auto-billing after)
- `/founding-members` page listing all Centurion businesses

### 3. Booking System
- Service selection with duration and pricing
- Staff member selection
- Real-time availability checking
- Deposit/payment options (None, 20%, 50%, 100%)
- 5% platform fee on deposits

### 4. Notifications
- Email reminders (booking confirmation, 24h reminder)
- WhatsApp notifications (via Twilio - requires business verification)

## Database Schema

### Users
```
{
  id, email, password (hashed), fullName, mobile, role,
  suspended, suspendedReason, createdAt
}
```

### Businesses
```
{
  id, ownerId, businessName, description, logo, postcode, address,
  approved, approvedAt, approvedBy, rejected, rejectedReason,
  stripeConnectAccountId, stripeConnectOnboarded,
  depositLevel, isCenturion, centurionJoinedAt, createdAt
}
```

### Subscriptions
```
{
  id, businessId, ownerId, staffCount, status,
  priceMonthly, pricingTier (centurion/standard),
  trialStartDate, trialEndDate, stripeCustomerId,
  stripePaymentMethodId, freeAccessOverride
}
```

## API Endpoints

### Centurions
- `GET /api/centurions/count` - Current count and availability
- `GET /api/centurions/list` - List of approved Centurion businesses
- `GET /api/centurions/pricing` - Both tier pricing info

### Stripe
- `POST /api/stripe/create-setup-intent` - For card capture during signup

### Admin
- `POST /api/admin/migrate-centurions` - Migrate existing businesses to Centurion

---

## Changelog

### 2025-02-14
- Implemented Calendrax Centurions founding members program
- Added landing page counter (13/100 currently)
- Added mandatory card capture for business signup
- Created Founding Members page (/founding-members)
- Added Centurion badge to public business pages
- Migrated 13 existing businesses to Centurion status
- Updated pricing tiers: Centurion (£10/£5) vs Standard (£16/£8)

### 2025-02-13
- Updated Subscription Information text on Business Owner Sign Up page
- Fixed form data persistence when viewing Terms/Privacy during signup
- Fixed white dots not appearing on availability calendar
- Balanced Services & Staff tabs to equal widths

### Previous
- MongoDB Atlas migration
- Profile data population fix
- Optional phone number
- WhatsApp toggle removal
- Expandable service descriptions
- Mobile header fix
- PWA/homescreen icon

---

## Known Issues

### WhatsApp Notifications (P1 - BLOCKED)
- Not working in production
- **Root Cause**: Not a code issue - requires Twilio Business Profile verification
- **Action Required**: User must complete verification in Twilio account

---

## Backlog

### P1 (High Priority)
- Referral discount system for Centurions (awaiting details)

### P2 (Medium Priority)
- None currently

### P3 (Future)
- Custom Centurion badge icon (user to design)
