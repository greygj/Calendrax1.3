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
  depositLevel, isCenturion, centurionJoinedAt,
  referralCode, referralCredits, referredBy, referralBonusPaid,
  createdAt
}
```

### Subscriptions
```
{
  id, businessId, ownerId, staffCount, status,
  priceMonthly, pricingTier (centurion/standard),
  trialStartDate, trialEndDate, stripeCustomerId,
  stripePaymentMethodId, hasPaymentMethod, freeAccessOverride
}
```

## API Endpoints

### Centurions
- `GET /api/centurions/count` - Current count and availability
- `GET /api/centurions/list` - List of approved Centurion businesses
- `GET /api/centurions/pricing` - Both tier pricing info

### Referrals
- `GET /api/referral/validate/{code}` - Validate a referral code
- `GET /api/referral/my-info` - Get current business's referral code and credits
- `POST /api/referral/award-credits/{business_id}` - Award credits on first payment (internal)
- `POST /api/admin/referral-credits/{business_id}` - Admin: add/remove credits
- `GET /api/admin/businesses-with-referrals` - Admin: list all businesses with referral info
- `POST /api/admin/migrate-referral-codes` - Admin: generate codes for existing businesses

### Stripe
- `POST /api/stripe/create-setup-intent` - For card capture during signup

### Admin
- `POST /api/admin/migrate-centurions` - Migrate existing businesses to Centurion

---

## Changelog

### 2026-02-24 (Session 4 - UI Consolidation)
- **Consolidated Notification Settings Card - BusinessOwnerDashboard**:
  - Combined separate "Notification Settings" (WhatsApp only) and "Notification Preferences" (Email only) cards
  - Now single "Notification Settings" card with both Email and WhatsApp toggles
  - Consistent styling with CustomerDashboard which already had unified card
  - Email toggle uses brand color, WhatsApp toggle uses green accent
  - Warning message shown when WhatsApp enabled but no phone number added

### 2026-02-16 (Session 3 - Frozen Account Feature)
- **Frozen Account Feature - TESTED & VERIFIED**:
  - Users whose trial has expired without a payment method see a "Frozen Account" overlay
  - Overlay blocks access to dashboard but allows adding payment method to reactivate
  - Backend `/api/auth/login` returns `accountFrozen: true`, `frozenMessage`, and `frozenDetails`
  - New endpoint `/api/billing/reactivate-account` to process payment and un-freeze account
  - Reactivation form with Stripe card input and "Add Card & Reactivate Account" button
  - Logout option available from frozen overlay
- **UI Changes - TESTED & VERIFIED**:
  - Mobile Number field on signup shows "(Optional - Not used for marketing)"
  - Availability Save button moved to top of time slots panel for better mobile UX
  - Time slots changed from 15-minute to 5-minute intervals
  - Centurion logo visible next to business name in dashboard header

### 2025-02-15 (Session 2)
- **Optional Card Entry on Signup**:
  - Business owners can now sign up without entering credit card details
  - Card Details section now shows "(Optional - can add later)" label
  - Added "Skip for now - add card later" button with yellow warning state
  - Clicking skip shows message about adding card before trial ends
  - "Actually, I want to add my card now" link to restore card input
  - Backend updated: `stripePaymentMethodId` no longer required in `/api/auth/register`
  - Subscription created with `hasPaymentMethod: false` when no card provided
- **Dashboard Trial Warning Banner**:
  - Prominent red gradient warning banner at top of dashboard
  - Shows for trial users without payment method
  - Displays exact trial end date (e.g., "17 March 2026")
  - Shows days remaining badge (e.g., "29 days left")
  - "Add Payment Method Now" CTA button navigates to Profile
  - Has `data-testid="trial-warning-banner"` for testing
  - Subtle pulse animation for attention
- **Landing Page Centurion Card - Collapsible**:
  - Smaller collapsed card showing key info:
    - "Calling All Business Owners"
    - "Take your chance to become a Calendrax Centurion!"
    - Logo & Counter (16/100)
    - "Secure LIFETIME reduced pricing (It will never increase - EVER)"
    - "Let's grow together"
  - "Learn More" button expands to show full benefits
  - Expanded view shows: pricing details, referral benefits, CTA button, links
  - "Show Less" button collapses the card
- **Landing Page Text Update**:
  - Changed "Book Your Next Appointment" to "Customers - Book Your Next Appointment"

### 2025-02-15
- Updated Centurion logo to new transparent background version
- Condensed Centurion banner for mobile view:
  - Compact benefits list with smaller text and spacing
  - Logo repositioned: smaller logo next to counter on mobile, full-size on left for desktop
  - CTA button and counter more prominent
  - "Book Your Next Appointment" section now visible without excessive scrolling
- Added count-up animation to Centurion counter (0 to current over 2 seconds)
- Added pulse glow animation on the counter number
- **Implemented Referral System**:
  - **Referral Codes**: Centurions get CC001-CC100 format, non-Centurions get CBO101+ format
  - **Signup Flow**: Added optional referral code input with real-time validation
  - **Dashboard Card**: Added Centurion/Referral card showing code, credits, and referral count
  - **Credit System**: Centurions earn 2 credits per referral, non-Centurions earn 1 credit
  - **Backend APIs**: `/api/referral/validate/{code}`, `/api/referral/my-info`, `/api/admin/referral-credits/{business_id}`
  - Migrated all 13 existing businesses to have referral codes (CC001-CC013)
- **Automatic Credit Billing**:
  - **Stripe Webhook Handler**: `invoice.created` event voids invoices and uses credits when available
  - **Daily Cron Job**: Runs at 6 AM UTC to process credit-based billing for all eligible subscriptions
  - **Admin Manual Trigger**: "Process Credit Billing" button in Admin Referrals tab
  - Credit usage recorded in `billing_history` collection
  - Stripe subscription paused when credit is used
- **Billing Integration with Credits**:
  - When subscription payment due: if credits > 0, skip Stripe charge and deduct 1 credit
  - Awards referral credits automatically when referred business makes first payment
  - New endpoints: `/api/billing/process-with-credits`, `/api/billing/credit-history`
- **Admin UI - Referrals Tab**:
  - New "Referrals" tab in Admin Dashboard
  - Stats: Centurion count, successful referrals, credits in circulation, credits used
  - Top referrers display
  - Business list with search, showing codes and credits
  - Add/remove credits controls for each business
  - "Process Credit Billing" button for manual trigger
- **Business Owner Dashboard - Expanded Referral Analytics**:
  - Enhanced Centurion/Referral card with stats row (Credits, Referrals, Earned, Used)
  - List of referred businesses with payment status (Paid/Pending)
  - Pending referrals indicator

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

## Completed Features

### Frozen Account & Reactivation Flow (P0 - COMPLETED)
- Backend detects frozen status on login for expired trials without payment
- Frontend displays modal overlay with Stripe card input
- Reactivation endpoint processes payment and updates subscription status
- Tested with user `frozen_test@test.com` / `Test123!`

---

## Backlog

### P1 (High Priority)
- Referral discount system for Centurions (awaiting details)

### P2 (Medium Priority)
- None currently

### P3 (Future)
- Custom Centurion badge icon (user to design)
