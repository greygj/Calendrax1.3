from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks, Request, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import hashlib
import base64

# Import notification service
from notifications import (
    notify_booking_created, 
    notify_booking_approved, 
    notify_booking_declined, 
    notify_booking_cancelled,
    notify_customer_booking_cancelled,
    get_notification_status,
    send_trial_reminder,
    send_whatsapp
)

# Stripe SDK - using native stripe for Connect support
import stripe

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
# Add TLS settings for MongoDB Atlas if using srv connection
if 'mongodb+srv://' in mongo_url or 'mongodb.net' in mongo_url:
    # Ensure proper TLS settings for Atlas connections
    if '?' in mongo_url:
        if 'tls=' not in mongo_url.lower():
            mongo_url = mongo_url + '&tls=true&tlsAllowInvalidCertificates=true'
    else:
        mongo_url = mongo_url + '?tls=true&tlsAllowInvalidCertificates=true'
    
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    JWT_SECRET = 'dev-only-secret-key-change-in-production'
    print("WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable in production!")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
if not STRIPE_API_KEY:
    STRIPE_API_KEY = 'sk_test_placeholder'
    print("WARNING: STRIPE_API_KEY not set. Payments will not work!")
stripe.api_key = STRIPE_API_KEY

# Frontend URL for redirects (Stripe Connect, etc.)
FRONTEND_URL = os.environ.get('FRONTEND_URL', '')

# Offer codes for testing (bypass payment)
VALID_OFFER_CODES = {
    "TESTFREE": {"type": "bypass", "description": "Testing - bypass payment"},
    "BOOKLE100": {"type": "bypass", "description": "100% discount for testing"},
    "STAFF2025": {"type": "bypass", "description": "Staff testing code"}
}

# Deposit level options (percentage of service price)
DEPOSIT_LEVELS = {
    "none": 0,
    "20": 20,  # Default
    "50": 50,
    "full": 100
}

# Subscription pricing (GBP)
# Centurion (Founding Members) pricing - first 100 businesses
CENTURION_BASE_PRICE = 10.00  # 1 staff member
CENTURION_ADDITIONAL_STAFF = 5.00  # Per additional staff
# Standard pricing - after first 100 or if opted out
STANDARD_BASE_PRICE = 16.00  # 1 staff member
STANDARD_ADDITIONAL_STAFF = 8.00  # Per additional staff
# Legacy pricing (for backwards compatibility)
SUBSCRIPTION_BASE_PRICE = CENTURION_BASE_PRICE
SUBSCRIPTION_ADDITIONAL_STAFF = CENTURION_ADDITIONAL_STAFF
TRIAL_PERIOD_DAYS = 30
MAX_CENTURIONS = 100

# Create the main app
app = FastAPI(title="Booka API")

# CORS Middleware - must be added early
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserRole:
    CUSTOMER = "customer"
    BUSINESS_OWNER = "business_owner"
    PLATFORM_ADMIN = "platform_admin"

class UserBase(BaseModel):
    email: EmailStr
    fullName: str
    mobile: Optional[str] = None
    role: str = UserRole.CUSTOMER

class UserCreate(UserBase):
    password: str
    businessName: Optional[str] = None
    businessDescription: Optional[str] = None
    postcode: Optional[str] = None
    logo: Optional[str] = None
    # Centurion signup
    joinCenturion: Optional[bool] = False
    # Stripe payment method for business owners
    stripePaymentMethodId: Optional[str] = None
    # Referral code (optional - code of the business that referred them)
    referralCode: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    suspended: bool = False
    suspendedAt: Optional[datetime] = None
    suspendedReason: Optional[str] = None

class UserUpdate(BaseModel):
    fullName: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    suspended: Optional[bool] = None
    suspendedReason: Optional[str] = None

class Business(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ownerId: str
    businessName: str
    description: str = ""
    logo: Optional[str] = None
    postcode: str = ""
    address: str = ""
    approved: bool = False
    approvedAt: Optional[datetime] = None
    approvedBy: Optional[str] = None
    rejected: bool = False
    rejectedReason: Optional[str] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Stripe Connect fields
    stripeConnectAccountId: Optional[str] = None
    stripeConnectOnboarded: bool = False
    # Deposit level setting
    depositLevel: str = "20"  # Options: "none", "20", "50", "full"
    # Centurion (Founding Member) status
    isCenturion: bool = False
    centurionJoinedAt: Optional[datetime] = None
    # Referral system
    referralCode: Optional[str] = None  # CC001 for Centurions, CBO101 for non-Centurions
    referralCredits: int = 0  # Number of free month credits
    referredBy: Optional[str] = None  # Referral code that was used at signup
    referralBonusPaid: bool = False  # Whether referrer has been credited for this business

class BusinessUpdate(BaseModel):
    businessName: Optional[str] = None
    description: Optional[str] = None
    postcode: Optional[str] = None
    address: Optional[str] = None
    approved: Optional[bool] = None
    rejected: Optional[bool] = None
    depositLevel: Optional[str] = None
    rejectedReason: Optional[str] = None

class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    businessId: str
    name: str
    description: str = ""
    duration: int = 30
    price: float = 0
    category: str = ""
    active: bool = True
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ServiceCreate(BaseModel):
    name: str
    description: str = ""
    duration: int = 30
    price: float = 0
    category: str = ""

# Staff member model for multi-staff booking
class StaffCreate(BaseModel):
    name: str
    serviceIds: List[str] = []  # Services this staff member can perform

class StaffUpdate(BaseModel):
    name: Optional[str] = None
    serviceIds: Optional[List[str]] = None
    active: Optional[bool] = None

class Subscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    businessId: str
    ownerId: str
    staffCount: int = 1  # Number of staff members
    status: str = "trial"  # trial, active, inactive, cancelled, past_due
    priceMonthly: float = 14.0  # Base price for 1 staff
    pricingTier: str = "centurion"  # centurion or standard
    trialStartDate: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    trialEndDate: Optional[datetime] = None
    subscriptionStartDate: Optional[datetime] = None
    lastPaymentDate: Optional[datetime] = None
    lastPaymentStatus: str = "pending"  # pending, success, failed
    nextPaymentDate: Optional[datetime] = None
    failedPayments: int = 0
    stripeCustomerId: Optional[str] = None
    stripeSubscriptionId: Optional[str] = None
    stripePaymentMethodId: Optional[str] = None  # Saved card for auto-billing
    freeAccessOverride: bool = False  # Admin can grant free access
    freeAccessGrantedBy: Optional[str] = None
    freeAccessGrantedAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    businessId: str
    businessName: str
    customerId: str
    customerName: str
    appointmentId: Optional[str] = None
    rating: int  # 1-5 stars
    comment: str = ""
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    businessId: str
    appointmentId: Optional[str] = None
    rating: int  # 1-5 stars
    comment: str = ""

class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    customerName: str
    customerEmail: str
    businessId: str
    businessName: str
    serviceId: str
    serviceName: str
    date: str
    time: str
    status: str = "pending"  # pending, confirmed, declined, cancelled, completed
    paymentStatus: str = "pending"  # pending, deposit_paid, full_paid, refunded
    paymentAmount: float = 0
    depositAmount: float = 0
    refundedAmount: float = 0
    refundedAt: Optional[datetime] = None
    refundedBy: Optional[str] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Availability(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    businessId: str
    date: str
    slots: List[str] = []

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    type: str
    title: str
    message: str
    read: bool = False
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== UTILITIES ====================

def remove_mongo_id(doc):
    """Remove MongoDB _id from document"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [{k: v for k, v in d.items() if k != "_id"} for d in doc]
    return {k: v for k, v in doc.items() if k != "_id"}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

async def generate_referral_code(is_centurion: bool) -> str:
    """Generate a unique referral code.
    Centurions: CC001, CC002, etc.
    Non-Centurions: CBO101, CBO102, etc.
    """
    if is_centurion:
        # Count existing Centurion codes to get next number
        centurion_count = await db.businesses.count_documents({"referralCode": {"$regex": "^CC"}})
        next_num = centurion_count + 1
        return f"CC{next_num:03d}"
    else:
        # Count existing non-Centurion codes (starting at 101)
        non_centurion_count = await db.businesses.count_documents({"referralCode": {"$regex": "^CBO"}})
        next_num = 101 + non_centurion_count
        return f"CBO{next_num:03d}"

async def validate_referral_code(code: str) -> dict:
    """Validate a referral code and return the referring business."""
    if not code:
        return None
    code = code.upper().strip()
    business = await db.businesses.find_one({"referralCode": code})
    return remove_mongo_id(business) if business else None

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("suspended"):
        raise HTTPException(status_code=403, detail="Account suspended")
    return user

async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    if payload.get("role") != UserRole.PLATFORM_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    user = await db.users.find_one({"id": payload["user_id"], "role": UserRole.PLATFORM_ADMIN})
    if not user:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_business_owner(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if user.get("role") != UserRole.BUSINESS_OWNER:
        raise HTTPException(status_code=403, detail="Business owner access required")
    return user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Don't allow platform_admin registration
    if user_data.role == UserRole.PLATFORM_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot register as admin")
    
    # For business owners, payment method is now optional (can add later)
    # Card details are encouraged but not required during signup
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "fullName": user_data.fullName,
        "mobile": user_data.mobile,
        "role": user_data.role,
        "suspended": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # If business owner, create business
    business = None
    if user_data.role == UserRole.BUSINESS_OWNER:
        business_id = str(uuid.uuid4())
        
        # Check if can be Centurion
        centurion_count = await db.businesses.count_documents({"isCenturion": True})
        is_centurion = user_data.joinCenturion and centurion_count < MAX_CENTURIONS
        
        # Determine pricing tier
        if is_centurion:
            base_price = CENTURION_BASE_PRICE
            pricing_tier = "centurion"
        else:
            base_price = STANDARD_BASE_PRICE
            pricing_tier = "standard"
        
        # Generate referral code for this business
        referral_code = await generate_referral_code(is_centurion)
        
        # Validate referral code if provided
        referred_by_code = None
        if user_data.referralCode:
            referring_business = await validate_referral_code(user_data.referralCode)
            if referring_business:
                referred_by_code = user_data.referralCode.upper().strip()
        
        business_doc = {
            "id": business_id,
            "ownerId": user_id,
            "businessName": user_data.businessName or f"{user_data.fullName}'s Business",
            "description": user_data.businessDescription or "",
            "logo": user_data.logo,
            "postcode": user_data.postcode or "",
            "address": "",
            "phone": user_data.mobile or "",
            "email": user_data.email or "",
            "approved": False,  # Requires admin approval
            "rejected": False,
            "isCenturion": is_centurion,
            "centurionJoinedAt": datetime.now(timezone.utc).isoformat() if is_centurion else None,
            "referralCode": referral_code,
            "referralCredits": 0,
            "referredBy": referred_by_code,
            "referralBonusPaid": False,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.businesses.insert_one(business_doc)
        
        # Create Stripe customer and optionally attach payment method
        stripe_customer_id = None
        try:
            # Create Stripe customer
            customer = stripe.Customer.create(
                email=user_data.email,
                name=user_data.fullName,
                metadata={
                    "business_id": business_id,
                    "user_id": user_id
                }
            )
            stripe_customer_id = customer.id
            
            # Attach payment method to customer only if provided
            if user_data.stripePaymentMethodId:
                stripe.PaymentMethod.attach(
                    user_data.stripePaymentMethodId,
                    customer=stripe_customer_id
                )
                
                # Set as default payment method
                stripe.Customer.modify(
                    stripe_customer_id,
                    invoice_settings={
                        "default_payment_method": user_data.stripePaymentMethodId
                    }
                )
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error during registration: {e}")
            # Clean up user and business if Stripe fails
            await db.users.delete_one({"id": user_id})
            await db.businesses.delete_one({"id": business_id})
            raise HTTPException(status_code=400, detail=f"Failed to save card details: {str(e)}")
        
        # Create subscription with 30-day trial
        trial_end = datetime.now(timezone.utc) + timedelta(days=TRIAL_PERIOD_DAYS)
        subscription_doc = {
            "id": str(uuid.uuid4()),
            "businessId": business_id,
            "ownerId": user_id,
            "staffCount": 1,
            "status": "trial",
            "priceMonthly": base_price,
            "pricingTier": pricing_tier,
            "trialStartDate": datetime.now(timezone.utc).isoformat(),
            "trialEndDate": trial_end.isoformat(),
            "lastPaymentStatus": "pending",
            "failedPayments": 0,
            "stripeCustomerId": stripe_customer_id,
            "stripePaymentMethodId": user_data.stripePaymentMethodId if user_data.stripePaymentMethodId else None,
            "hasPaymentMethod": bool(user_data.stripePaymentMethodId),
            "freeAccessOverride": False,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.subscriptions.insert_one(subscription_doc)
        # Remove MongoDB _id before returning
        business = remove_mongo_id(business_doc)
    
    token = create_token(user_id, user_data.role)
    
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user_id,
            "email": user_data.email,
            "fullName": user_data.fullName,
            "mobile": user_data.mobile,
            "role": user_data.role
        },
        "business": business
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.get("suspended"):
        raise HTTPException(status_code=403, detail=f"Account suspended: {user.get('suspendedReason', 'Contact support')}")
    
    # Check subscription status for business owners
    subscription_blocked = False
    subscription_message = None
    subscription_status_data = None
    
    if user["role"] == UserRole.BUSINESS_OWNER:
        business = await db.businesses.find_one({"ownerId": user["id"]})
        if business:
            subscription = await db.subscriptions.find_one({"businessId": business["id"]})
            if subscription:
                # Check if subscription is blocked (failed payment and not free access)
                if not subscription.get("freeAccessOverride", False):
                    trial_end = subscription.get("trialEndDate")
                    trial_end_dt = None
                    trial_expired = False
                    
                    if trial_end:
                        trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00')) if isinstance(trial_end, str) else trial_end
                        trial_expired = datetime.now(timezone.utc) > trial_end_dt
                    
                    # Case 1: Trial expired without payment method
                    if subscription.get("status") == "trial" and trial_expired and not subscription.get("hasPaymentMethod"):
                        subscription_blocked = True
                        subscription_message = "Your free trial has ended. Please add a payment method to continue using Calendrax."
                        subscription_status_data = {
                            "reason": "trial_expired_no_payment",
                            "canReactivate": True
                        }
                    
                    # Case 2: Payment failed (card declined, expired, etc.)
                    elif subscription.get("status") in ["inactive", "past_due"] or subscription.get("lastPaymentStatus") == "failed":
                        subscription_blocked = True
                        subscription_message = "Your payment failed. Please update your payment method to continue using Calendrax."
                        subscription_status_data = {
                            "reason": "payment_failed",
                            "canReactivate": True
                        }
                    
                    # Case 3: Trial expired but has payment method (should auto-charge, but mark if still trial status)
                    elif subscription.get("status") == "trial" and trial_expired and subscription.get("hasPaymentMethod"):
                        # This shouldn't happen normally, but handle it
                        subscription_blocked = True
                        subscription_message = "Your subscription is being processed. If this persists, please contact support."
                        subscription_status_data = {
                            "reason": "subscription_pending",
                            "canReactivate": True
                        }
    
    # Instead of blocking login completely, allow login but return frozen status
    # The frontend will show a restricted view where user can only add payment
    
    token = create_token(user["id"], user["role"])
    
    # Get business if owner
    business = None
    if user["role"] == UserRole.BUSINESS_OWNER:
        business_doc = await db.businesses.find_one({"ownerId": user["id"]})
        if business_doc:
            # Convert to dict and remove MongoDB _id
            business = {k: v for k, v in business_doc.items() if k != "_id"}
    
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "fullName": user["fullName"],
            "mobile": user["mobile"],
            "role": user["role"]
        },
        "business": business,
        "accountFrozen": subscription_blocked,
        "frozenMessage": subscription_message,
        "frozenDetails": subscription_status_data
    }

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    business = None
    if user["role"] == UserRole.BUSINESS_OWNER:
        business_doc = await db.businesses.find_one({"ownerId": user["id"]})
        business = remove_mongo_id(business_doc)
    
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "fullName": user["fullName"],
            "mobile": user.get("mobile", ""),
            "role": user["role"]
        },
        "business": business
    }

@api_router.put("/auth/profile")
async def update_profile(updates: dict, user: dict = Depends(get_current_user)):
    """Update user profile (name, email, mobile)"""
    allowed_fields = ["fullName", "mobile", "email"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
    
    if "email" in update_data:
        # Check if email is already taken by another user
        existing = await db.users.find_one({"email": update_data["email"], "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
    
    if update_data:
        await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user["id"]})
    return {
        "success": True,
        "user": {
            "id": updated_user["id"],
            "email": updated_user["email"],
            "fullName": updated_user["fullName"],
            "mobile": updated_user.get("mobile", ""),
            "role": updated_user["role"]
        }
    }

@api_router.post("/auth/change-password")
async def change_password(data: dict, user: dict = Depends(get_current_user)):
    """Change user password"""
    current_password = data.get("currentPassword")
    new_password = data.get("newPassword")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current password and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Verify current password
    db_user = await db.users.find_one({"id": user["id"]})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hashed_current = hashlib.sha256(current_password.encode()).hexdigest()
    if db_user["password"] != hashed_current:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash and save new password
    hashed_new = hashlib.sha256(new_password.encode()).hexdigest()
    await db.users.update_one({"id": user["id"]}, {"$set": {"password": hashed_new}})
    
    return {"success": True, "message": "Password changed successfully"}

@api_router.post("/auth/forgot-password")
async def forgot_password(data: dict):
    """Request a password reset email"""
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Find user by email
    user = await db.users.find_one({"email": email.lower().strip()})
    
    # Always return success to prevent email enumeration attacks
    if not user:
        logger.info(f"Password reset requested for non-existent email: {email}")
        return {"success": True, "message": "If an account exists with this email, you will receive a password reset link."}
    
    # Generate reset token
    import secrets
    reset_token = secrets.token_urlsafe(32)
    reset_expiry = datetime.now(timezone.utc) + timedelta(hours=1)  # Token valid for 1 hour
    
    # Store reset token in database
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "resetToken": reset_token,
            "resetTokenExpiry": reset_expiry.isoformat()
        }}
    )
    
    # Send reset email
    frontend_url = FRONTEND_URL or "https://calendrax.co.uk"
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    from notifications import send_email
    
    subject = "Reset Your Calendrax Password"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2a2a2a; border-radius: 10px; padding: 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="https://customer-assets.emergentagent.com/job_3f85dde5-1e91-4759-bd85-f441b993a550/artifacts/s4024gg5_Calendrax1.3%20Logo%20Opaque%20%282%29.png" alt="Calendrax" style="height: 60px;">
            </div>
            <h1 style="color: #a3e635; margin-bottom: 20px; text-align: center;">Password Reset Request</h1>
            <p>Hello {user['fullName']},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" style="display: inline-block; background-color: #a3e635; color: #000000; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Reset Password</a>
            </div>
            <p style="color: #888; font-size: 14px;">This link will expire in 1 hour.</p>
            <p style="color: #888; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            <hr style="border: none; border-top: 1px solid #444; margin: 30px 0;">
            <p style="color: #666; font-size: 12px; text-align: center;">This is an automated message from Calendrax. Please do not reply to this email.</p>
        </div>
    </body>
    </html>
    """
    
    email_sent = send_email(user["email"], subject, html_content)
    if not email_sent:
        logger.error(f"Failed to send password reset email to {email}")
    
    return {"success": True, "message": "If an account exists with this email, you will receive a password reset link."}

@api_router.post("/auth/reset-password")
async def reset_password(data: dict):
    """Reset password using token from email"""
    token = data.get("token")
    new_password = data.get("newPassword")
    
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Find user with this reset token
    user = await db.users.find_one({"resetToken": token})
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    
    # Check if token has expired
    expiry = user.get("resetTokenExpiry")
    if expiry:
        expiry_dt = datetime.fromisoformat(expiry.replace('Z', '+00:00')) if isinstance(expiry, str) else expiry
        if datetime.now(timezone.utc) > expiry_dt:
            raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")
    
    # Hash and save new password
    hashed_password = hashlib.sha256(new_password.encode()).hexdigest()
    
    # Update password and clear reset token
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"password": hashed_password},
            "$unset": {"resetToken": "", "resetTokenExpiry": ""}
        }
    )
    
    logger.info(f"Password reset successful for user: {user['email']}")
    return {"success": True, "message": "Password has been reset successfully. You can now log in with your new password."}

@api_router.get("/auth/notification-preferences")
async def get_notification_preferences(user: dict = Depends(get_current_user)):
    """Get user notification preferences"""
    db_user = await db.users.find_one({"id": user["id"]})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Default to True if not set
    return {
        "emailReminders": db_user.get("emailReminders", True),
        "whatsappReminders": db_user.get("whatsappReminders", True)
    }

@api_router.put("/auth/notification-preferences")
async def update_notification_preferences(data: dict, user: dict = Depends(get_current_user)):
    """Update user notification preferences"""
    update_data = {}
    
    if "emailReminders" in data:
        update_data["emailReminders"] = bool(data["emailReminders"])
    if "whatsappReminders" in data:
        update_data["whatsappReminders"] = bool(data["whatsappReminders"])
    
    if update_data:
        await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    
    db_user = await db.users.find_one({"id": user["id"]})
    return {
        "success": True,
        "emailReminders": db_user.get("emailReminders", True),
        "whatsappReminders": db_user.get("whatsappReminders", True)
    }

# ==================== CENTURION (FOUNDING MEMBERS) ROUTES ====================

@api_router.get("/centurions/count")
async def get_centurion_count():
    """Get the current number of Centurion members"""
    count = await db.businesses.count_documents({"isCenturion": True})
    return {
        "count": count,
        "maxCenturions": MAX_CENTURIONS,
        "spotsRemaining": max(0, MAX_CENTURIONS - count),
        "isAvailable": count < MAX_CENTURIONS
    }

@api_router.get("/centurions/list")
async def get_centurion_list():
    """Get list of all Centurion businesses for the Founding Members page"""
    centurions = await db.businesses.find(
        {"isCenturion": True, "approved": True},
        {"businessName": 1, "description": 1, "logo": 1, "postcode": 1, "centurionJoinedAt": 1, "id": 1}
    ).sort("centurionJoinedAt", 1).to_list(MAX_CENTURIONS)
    return remove_mongo_id(centurions)

@api_router.get("/centurions/pricing")
async def get_pricing_info():
    """Get pricing information for both tiers"""
    return {
        "centurion": {
            "basePrice": CENTURION_BASE_PRICE,
            "additionalStaffPrice": CENTURION_ADDITIONAL_STAFF,
            "name": "Centurion (Founding Member)"
        },
        "standard": {
            "basePrice": STANDARD_BASE_PRICE,
            "additionalStaffPrice": STANDARD_ADDITIONAL_STAFF,
            "name": "Standard"
        },
        "maxCenturions": MAX_CENTURIONS
    }

# ==================== REFERRAL ROUTES ====================

@api_router.get("/referral/validate/{code}")
async def validate_referral(code: str):
    """Validate a referral code and return basic info about the referring business"""
    business = await validate_referral_code(code)
    if not business:
        return {"valid": False, "message": "Invalid referral code"}
    return {
        "valid": True,
        "businessName": business.get("businessName"),
        "isCenturion": business.get("isCenturion", False)
    }

@api_router.get("/referral/my-info")
async def get_my_referral_info(user: dict = Depends(require_business_owner)):
    """Get the current business owner's referral code and credits"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Count successful referrals
    referral_count = await db.businesses.count_documents({
        "referredBy": business.get("referralCode"),
        "referralBonusPaid": True
    })
    
    # Get list of referred businesses (names only for privacy)
    referred_businesses = await db.businesses.find(
        {"referredBy": business.get("referralCode")},
        {"businessName": 1, "referralBonusPaid": 1, "createdAt": 1, "isCenturion": 1}
    ).sort("createdAt", -1).to_list(50)
    
    # Count credits used
    credits_used = await db.billing_history.count_documents({
        "businessId": business["id"],
        "type": "credit_used"
    })
    
    # Calculate total credits earned
    total_credits_earned = business.get("referralCredits", 0) + credits_used
    
    return {
        "referralCode": business.get("referralCode"),
        "referralCredits": business.get("referralCredits", 0),
        "isCenturion": business.get("isCenturion", False),
        "totalReferrals": referral_count,
        "pendingReferrals": len([r for r in referred_businesses if not r.get("referralBonusPaid")]),
        "creditsEarned": total_credits_earned,
        "creditsUsed": credits_used,
        "referredBusinesses": [
            {
                "businessName": r.get("businessName"),
                "status": "active" if r.get("referralBonusPaid") else "pending",
                "isCenturion": r.get("isCenturion", False),
                "joinedAt": r.get("createdAt")
            } for r in referred_businesses
        ]
    }

@api_router.post("/referral/award-credits/{business_id}")
async def award_referral_credits(business_id: str):
    """Award referral credits when a referred business makes their first payment.
    Called internally when payment is successful.
    Centurions get 2 credits, non-Centurions get 1 credit."""
    
    # Find the business that made the payment
    business = await db.businesses.find_one({"id": business_id})
    if not business:
        return {"success": False, "message": "Business not found"}
    
    # Check if already credited
    if business.get("referralBonusPaid"):
        return {"success": False, "message": "Referral bonus already paid"}
    
    # Check if they were referred
    referred_by_code = business.get("referredBy")
    if not referred_by_code:
        return {"success": False, "message": "No referral code used"}
    
    # Find the referring business
    referring_business = await db.businesses.find_one({"referralCode": referred_by_code})
    if not referring_business:
        return {"success": False, "message": "Referring business not found"}
    
    # Determine credits to award (2 for Centurions, 1 for non-Centurions)
    credits_to_award = 2 if referring_business.get("isCenturion") else 1
    
    # Award credits to the referring business
    await db.businesses.update_one(
        {"id": referring_business["id"]},
        {"$inc": {"referralCredits": credits_to_award}}
    )
    
    # Mark this business as having paid the referral bonus
    await db.businesses.update_one(
        {"id": business_id},
        {"$set": {"referralBonusPaid": True}}
    )
    
    logger.info(f"Awarded {credits_to_award} referral credits to {referring_business['businessName']} for referring {business['businessName']}")
    
    return {
        "success": True,
        "creditsAwarded": credits_to_award,
        "referringBusiness": referring_business["businessName"]
    }

class ReferralCreditUpdate(BaseModel):
    credits: int  # Positive to add, negative to deduct

@api_router.post("/admin/referral-credits/{business_id}")
async def admin_update_referral_credits(
    business_id: str, 
    update: ReferralCreditUpdate,
    admin: dict = Depends(require_admin)
):
    """Admin endpoint to add or remove referral credits from a business"""
    business = await db.businesses.find_one({"id": business_id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    current_credits = business.get("referralCredits", 0)
    new_credits = max(0, current_credits + update.credits)  # Can't go below 0
    
    await db.businesses.update_one(
        {"id": business_id},
        {"$set": {"referralCredits": new_credits}}
    )
    
    action = "added" if update.credits > 0 else "removed"
    logger.info(f"Admin {admin['email']} {action} {abs(update.credits)} referral credits for business {business['businessName']}. New total: {new_credits}")
    
    return {
        "success": True,
        "previousCredits": current_credits,
        "creditsChanged": update.credits,
        "newCredits": new_credits,
        "businessName": business["businessName"]
    }

@api_router.get("/admin/businesses-with-referrals")
async def admin_get_businesses_with_referrals(admin: dict = Depends(require_admin)):
    """Admin endpoint to get all businesses with their referral info"""
    businesses = await db.businesses.find(
        {},
        {
            "id": 1, "businessName": 1, "isCenturion": 1, 
            "referralCode": 1, "referralCredits": 1, "referredBy": 1,
            "approved": 1, "createdAt": 1
        }
    ).sort("createdAt", -1).to_list(1000)
    
    return remove_mongo_id(businesses)

@api_router.post("/stripe/create-setup-intent")
async def create_setup_intent():
    """Create a Stripe SetupIntent for collecting card details during registration"""
    try:
        setup_intent = stripe.SetupIntent.create(
            usage='off_session',  # Allow charging later
            payment_method_types=['card']
        )
        return {
            "clientSecret": setup_intent.client_secret
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating setup intent: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ==================== BUSINESS ROUTES ====================

@api_router.get("/businesses")
async def get_businesses():
    # Only return approved businesses for public listing
    businesses = await db.businesses.find({"approved": True, "rejected": {"$ne": True}}).to_list(1000)
    return remove_mongo_id(businesses)

@api_router.get("/businesses/{business_id}")
async def get_business(business_id: str):
    business = await db.businesses.find_one({"id": business_id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    result = remove_mongo_id(business)
    # Include deposit info for customers
    deposit_level = business.get("depositLevel", "20")
    result["depositPercentage"] = DEPOSIT_LEVELS.get(deposit_level, 20)
    result["depositLevelLabel"] = {
        "none": "No deposit required",
        "20": "20% deposit",
        "50": "50% deposit",
        "full": "Full payment required"
    }.get(deposit_level, "20% deposit")
    return result

@api_router.get("/businesses/{business_id}/services")
async def get_business_services(business_id: str):
    services = await db.services.find({"businessId": business_id, "active": True}).to_list(1000)
    return remove_mongo_id(services)

# ==================== SERVICE ROUTES ====================

@api_router.post("/services")
async def create_service(service: ServiceCreate, user: dict = Depends(require_business_owner)):
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    service_id = str(uuid.uuid4())
    service_doc = {
        "id": service_id,
        "businessId": business["id"],
        **service.model_dump(),
        "active": True,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.services.insert_one(service_doc)
    
    # Auto-assign this service to all existing staff members (opt-out basis)
    await db.staff.update_many(
        {"businessId": business["id"]},
        {"$addToSet": {"serviceIds": service_id}}
    )
    
    return remove_mongo_id(service_doc)

@api_router.get("/my-services")
async def get_my_services(user: dict = Depends(require_business_owner)):
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        return []
    services = await db.services.find({"businessId": business["id"]}).to_list(1000)
    return remove_mongo_id(services)

@api_router.put("/services/{service_id}")
async def update_service(service_id: str, updates: dict, user: dict = Depends(require_business_owner)):
    business = await db.businesses.find_one({"ownerId": user["id"]})
    service = await db.services.find_one({"id": service_id, "businessId": business["id"]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    await db.services.update_one({"id": service_id}, {"$set": updates})
    return {"success": True}

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, user: dict = Depends(require_business_owner)):
    business = await db.businesses.find_one({"ownerId": user["id"]})
    result = await db.services.delete_one({"id": service_id, "businessId": business["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"success": True}

# ==================== STAFF ROUTES ====================

@api_router.get("/staff")
async def get_my_staff(user: dict = Depends(require_business_owner)):
    """Get all staff members for the business owner's business"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        return []
    staff = await db.staff.find({"businessId": business["id"]}).to_list(100)
    return remove_mongo_id(staff)

@api_router.get("/staff/subscription-preview")
async def preview_staff_subscription_change(action: str = "add", user: dict = Depends(require_business_owner)):
    """Preview subscription price change before adding or removing staff"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    current_count = await db.staff.count_documents({"businessId": business["id"]})
    if current_count == 0:
        current_count = 1
    
    # Get pricing tier
    pricing_tier = await get_business_pricing_tier(business["id"])
    
    current_price = calculate_subscription_price(current_count, pricing_tier)
    
    if action == "add":
        if current_count >= 5:
            raise HTTPException(status_code=400, detail="Maximum 5 staff members allowed")
        new_count = current_count + 1
        new_price = calculate_subscription_price(new_count, pricing_tier)
        return {
            "action": "add",
            "currentStaffCount": current_count,
            "newStaffCount": new_count,
            "currentPrice": current_price,
            "newPrice": new_price,
            "priceIncrease": new_price - current_price,
            "pricingTier": pricing_tier,
            "message": f"Adding a staff member will increase your subscription from £{current_price:.2f}/month to £{new_price:.2f}/month (+£{new_price - current_price:.2f})"
        }
    else:  # remove
        if current_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot have less than 1 staff member")
        new_count = current_count - 1
        new_price = calculate_subscription_price(new_count, pricing_tier)
        return {
            "action": "remove",
            "currentStaffCount": current_count,
            "newStaffCount": new_count,
            "currentPrice": current_price,
            "newPrice": new_price,
            "priceDecrease": current_price - new_price,
            "pricingTier": pricing_tier,
            "message": f"Removing a staff member will decrease your subscription from £{current_price:.2f}/month to £{new_price:.2f}/month (-£{current_price - new_price:.2f})"
        }

@api_router.post("/staff")
async def create_staff(staff_data: StaffCreate, user: dict = Depends(require_business_owner)):
    """Create a new staff member (max 5 per business)"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check staff count (max 5)
    existing_count = await db.staff.count_documents({"businessId": business["id"]})
    if existing_count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 staff members allowed")
    
    # Get all existing services for this business to auto-assign (opt-out basis)
    existing_services = await db.services.find({"businessId": business["id"]}).to_list(100)
    all_service_ids = [s["id"] for s in existing_services]
    
    staff_doc = {
        "id": str(uuid.uuid4()),
        "businessId": business["id"],
        "name": staff_data.name,
        "serviceIds": all_service_ids,  # Auto-assign all services
        "active": True,
        "isOwner": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.staff.insert_one(staff_doc)
    
    # Get pricing tier for subscription calculation
    pricing_tier = await get_business_pricing_tier(business["id"])
    
    # Calculate new subscription price and notify
    new_staff_count = existing_count + 1
    old_price = calculate_subscription_price(existing_count if existing_count > 0 else 1, pricing_tier)
    new_price = calculate_subscription_price(new_staff_count, pricing_tier)
    
    # Update subscription with new staff count
    await db.subscriptions.update_one(
        {"businessId": business["id"]},
        {"$set": {"staffCount": new_staff_count, "priceMonthly": new_price}}
    )
    
    result = remove_mongo_id(staff_doc)
    result["subscriptionUpdate"] = {
        "previousPrice": old_price,
        "newPrice": new_price,
        "staffCount": new_staff_count,
        "message": f"Your subscription will increase from £{old_price:.2f}/month to £{new_price:.2f}/month"
    }
    return result

@api_router.put("/staff/{staff_id}")
async def update_staff(staff_id: str, updates: StaffUpdate, user: dict = Depends(require_business_owner)):
    """Update a staff member"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    staff = await db.staff.find_one({"id": staff_id, "businessId": business["id"]})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if update_data:
        await db.staff.update_one({"id": staff_id}, {"$set": update_data})
    return {"success": True}

@api_router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, user: dict = Depends(require_business_owner)):
    """Delete a staff member (cannot delete owner) - also deletes their future bookings"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    staff = await db.staff.find_one({"id": staff_id, "businessId": business["id"]})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    if staff.get("isOwner"):
        raise HTTPException(status_code=400, detail="Cannot delete the business owner from staff")
    
    # Get current staff count for subscription calculation
    current_staff_count = await db.staff.count_documents({"businessId": business["id"]})
    pricing_tier = await get_business_pricing_tier(business["id"])
    old_price = calculate_subscription_price(current_staff_count, pricing_tier)
    new_staff_count = max(1, current_staff_count - 1)
    new_price = calculate_subscription_price(new_staff_count, pricing_tier)
    
    # Find and delete future bookings for this staff member
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    future_bookings = await db.appointments.find({
        "staffId": staff_id,
        "businessId": business["id"],
        "date": {"$gte": today},
        "status": {"$in": ["pending", "confirmed"]}
    }).to_list(1000)
    
    deleted_bookings_count = len(future_bookings)
    
    # Notify customers about cancelled bookings
    for booking in future_bookings:
        # Create notification for customer
        notification_doc = {
            "id": str(uuid.uuid4()),
            "userId": booking["userId"],
            "type": "booking_cancelled_staff_removed",
            "title": "Booking Cancelled",
            "message": f"Your booking for {booking['serviceName']} on {booking['date']} at {booking['time']} has been cancelled as the staff member is no longer available.",
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
        
        # If deposit was paid, process refund
        if booking.get("depositPaid") and booking.get("transactionId"):
            transaction = await db.payment_transactions.find_one({"id": booking["transactionId"]})
            if transaction and transaction.get("sessionId"):
                try:
                    checkout_session = stripe.checkout.Session.retrieve(transaction["sessionId"])
                    if checkout_session.payment_intent:
                        refund = stripe.Refund.create(
                            payment_intent=checkout_session.payment_intent,
                            reason="requested_by_customer"
                        )
                        await db.payment_transactions.update_one(
                            {"id": transaction["id"]},
                            {"$set": {
                                "refundId": refund.id,
                                "refundStatus": refund.status,
                                "refundAmount": refund.amount / 100,
                                "refundedAt": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                except Exception as e:
                    logger.error(f"Refund failed for booking {booking['id']}: {str(e)}")
    
    # Delete the future bookings
    await db.appointments.delete_many({
        "staffId": staff_id,
        "businessId": business["id"],
        "date": {"$gte": today},
        "status": {"$in": ["pending", "confirmed"]}
    })
    
    # Delete the staff member
    await db.staff.delete_one({"id": staff_id})
    
    # Update subscription with new staff count
    await db.subscriptions.update_one(
        {"businessId": business["id"]},
        {"$set": {"staffCount": new_staff_count, "priceMonthly": new_price}}
    )
    
    return {
        "success": True,
        "deletedBookings": deleted_bookings_count,
        "subscriptionUpdate": {
            "previousPrice": old_price,
            "newPrice": new_price,
            "staffCount": new_staff_count,
            "message": f"Your subscription will decrease from £{old_price:.2f}/month to £{new_price:.2f}/month"
        }
    }

@api_router.get("/staff/{staff_id}/future-bookings-count")
async def get_staff_future_bookings_count(staff_id: str, user: dict = Depends(require_business_owner)):
    """Get count of future bookings for a staff member (used for deletion warning)"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    count = await db.appointments.count_documents({
        "staffId": staff_id,
        "businessId": business["id"],
        "date": {"$gte": today},
        "status": {"$in": ["pending", "confirmed"]}
    })
    
    return {"futureBookingsCount": count}

@api_router.get("/businesses/{business_id}/staff")
async def get_business_staff(business_id: str):
    """Get active staff members for a business (public endpoint for booking)"""
    staff = await db.staff.find({"businessId": business_id, "active": True}).to_list(100)
    return remove_mongo_id(staff)

# ==================== AVAILABILITY ROUTES ====================

@api_router.get("/availability/{business_id}/{date}")
async def get_availability(business_id: str, date: str, staff_id: Optional[str] = None):
    """Get availability slots for a specific date and optionally a specific staff member"""
    query = {"businessId": business_id, "date": date}
    if staff_id:
        query["staffId"] = staff_id
    avail = await db.availability.find_one(query)
    return {"slots": avail["slots"] if avail else [], "staffId": staff_id}

@api_router.get("/availability/{business_id}/{staff_id}/{date}")
async def get_staff_availability(business_id: str, staff_id: str, date: str):
    """Get availability for a specific staff member on a date"""
    avail = await db.availability.find_one({"businessId": business_id, "staffId": staff_id, "date": date})
    return {"slots": avail["slots"] if avail else [], "staffId": staff_id}

@api_router.post("/availability")
async def set_availability(business_id: str, date: str, slots: List[str], staff_id: Optional[str] = None, user: dict = Depends(require_business_owner)):
    """Set availability for a specific date and staff member"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business or business["id"] != business_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"businessId": business_id, "date": date}
    if staff_id:
        query["staffId"] = staff_id
    
    await db.availability.update_one(
        query,
        {"$set": {"slots": slots, "staffId": staff_id}},
        upsert=True
    )
    return {"success": True}

# ==================== BUSINESS PROFILE ROUTES ====================

@api_router.get("/my-business")
async def get_my_business(user: dict = Depends(require_business_owner)):
    """Get the current business owner's business details"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return remove_mongo_id(business)

@api_router.put("/my-business")
async def update_my_business(updates: dict, user: dict = Depends(require_business_owner)):
    """Update the current business owner's business details"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Only allow updating certain fields (including depositLevel and photos)
    allowed_fields = ["businessName", "description", "postcode", "address", "logo", "phone", "email", "website", "depositLevel", "photos"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
    
    # Validate depositLevel if provided
    if "depositLevel" in update_data:
        if update_data["depositLevel"] not in DEPOSIT_LEVELS:
            raise HTTPException(status_code=400, detail="Invalid deposit level. Must be: none, 10, 20, 50, or full")
    
    # Validate photos array - max 3
    if "photos" in update_data:
        if not isinstance(update_data["photos"], list):
            raise HTTPException(status_code=400, detail="Photos must be an array")
        if len(update_data["photos"]) > 3:
            raise HTTPException(status_code=400, detail="Maximum 3 photos allowed")
    
    if update_data:
        await db.businesses.update_one({"id": business["id"]}, {"$set": update_data})
    
    updated_business = await db.businesses.find_one({"id": business["id"]})
    return remove_mongo_id(updated_business)

@api_router.post("/upload-business-photo")
async def upload_business_photo(file: UploadFile = File(...), user: dict = Depends(require_business_owner)):
    """Upload a business photo - stores as base64 data URL"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check current photo count
    current_photos = business.get("photos", [])
    if len(current_photos) >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 photos allowed")
    
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read file and convert to base64 data URL
    contents = await file.read()
    
    # Check file size (max 5MB)
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Create data URL
    base64_encoded = base64.b64encode(contents).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{base64_encoded}"
    
    return {"url": data_url}

# ==================== STRIPE CONNECT ROUTES ====================

def get_frontend_url(request: Request) -> str:
    """Get the frontend URL for redirects, using origin header with fallback to FRONTEND_URL env var"""
    origin = request.headers.get('origin', '')
    if origin and origin.startswith('http'):
        return origin
    # Fallback to configured FRONTEND_URL
    if FRONTEND_URL:
        return FRONTEND_URL
    # Last resort - try referer header
    referer = request.headers.get('referer', '')
    if referer:
        # Extract origin from referer (https://example.com/path -> https://example.com)
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return ''

@api_router.post("/stripe-connect/create-account")
async def create_stripe_connect_account(request: Request, user: dict = Depends(require_business_owner)):
    """Create a Stripe Connect account for the business owner"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Get the frontend URL for redirects
    frontend_url = get_frontend_url(request)
    logger.info(f"Stripe Connect: Frontend URL for redirects: {frontend_url}")
    
    if not frontend_url:
        logger.error("Stripe Connect: No frontend URL available for redirects")
        raise HTTPException(status_code=400, detail="Unable to determine redirect URL. Please try again.")
    
    # Check if already has a connect account
    if business.get("stripeConnectAccountId"):
        # Return the existing account link for onboarding completion
        try:
            logger.info(f"Stripe Connect: Creating account link for existing account {business['stripeConnectAccountId']}")
            account_link = stripe.AccountLink.create(
                account=business["stripeConnectAccountId"],
                refresh_url=f"{frontend_url}/dashboard?stripe_refresh=true",
                return_url=f"{frontend_url}/dashboard?stripe_connected=true",
                type="account_onboarding",
            )
            return {"url": account_link.url, "accountId": business["stripeConnectAccountId"]}
        except stripe.error.InvalidRequestError as e:
            # Account might be deleted or invalid, clear it and create a new one
            logger.warning(f"Stripe Connect: Existing account invalid, will create new one. Error: {e}")
            await db.businesses.update_one(
                {"id": business["id"]},
                {"$unset": {"stripeConnectAccountId": "", "stripeConnectOnboarded": ""}}
            )
        except Exception as e:
            logger.error(f"Stripe Connect: Error creating account link: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create account link: {str(e)}")
    
    try:
        # Create a new Express Connect account
        logger.info(f"Stripe Connect: Creating new Express account for user {user['email']}")
        account = stripe.Account.create(
            type="express",
            country="GB",
            email=user["email"],
            capabilities={
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
            business_type="individual",
            metadata={
                "business_id": business["id"],
                "owner_id": user["id"]
            }
        )
        
        logger.info(f"Stripe Connect: Account created with ID {account.id}")
        
        # Save the account ID to the business
        await db.businesses.update_one(
            {"id": business["id"]},
            {"$set": {"stripeConnectAccountId": account.id}}
        )
        
        # Create an account link for onboarding
        account_link = stripe.AccountLink.create(
            account=account.id,
            refresh_url=f"{frontend_url}/dashboard?stripe_refresh=true",
            return_url=f"{frontend_url}/dashboard?stripe_connected=true",
            type="account_onboarding",
        )
        
        logger.info(f"Stripe Connect: Account link created, redirecting to Stripe onboarding")
        return {"url": account_link.url, "accountId": account.id}
    except stripe.error.InvalidRequestError as e:
        logger.error(f"Stripe Connect: Invalid request error: {str(e)}")
        error_message = str(e)
        if "email" in error_message.lower():
            raise HTTPException(status_code=400, detail="This email is already associated with a Stripe account. Please use a different email or contact support.")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Stripe Connect error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create Stripe account: {str(e)}")

@api_router.get("/stripe-connect/status")
async def get_stripe_connect_status(user: dict = Depends(require_business_owner)):
    """Get the Stripe Connect account status for the business"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    if not business.get("stripeConnectAccountId"):
        return {
            "connected": False,
            "accountId": None,
            "chargesEnabled": False,
            "payoutsEnabled": False,
            "detailsSubmitted": False
        }
    
    try:
        account = stripe.Account.retrieve(business["stripeConnectAccountId"])
        
        # Update business onboarding status if completed
        if account.charges_enabled and account.payouts_enabled and not business.get("stripeConnectOnboarded"):
            await db.businesses.update_one(
                {"id": business["id"]},
                {"$set": {"stripeConnectOnboarded": True}}
            )
        
        return {
            "connected": True,
            "accountId": account.id,
            "chargesEnabled": account.charges_enabled,
            "payoutsEnabled": account.payouts_enabled,
            "detailsSubmitted": account.details_submitted,
            "email": account.email
        }
    except Exception as e:
        logger.error(f"Error retrieving Stripe account: {e}")
        return {
            "connected": False,
            "accountId": business.get("stripeConnectAccountId"),
            "error": str(e)
        }

@api_router.post("/stripe-connect/dashboard-link")
async def get_stripe_dashboard_link(user: dict = Depends(require_business_owner)):
    """Get a link to the Stripe Express dashboard for the business"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business or not business.get("stripeConnectAccountId"):
        raise HTTPException(status_code=404, detail="No Stripe account connected")
    
    try:
        login_link = stripe.Account.create_login_link(business["stripeConnectAccountId"])
        return {"url": login_link.url}
    except Exception as e:
        logger.error(f"Error creating login link: {e}")
        raise HTTPException(status_code=500, detail="Failed to create dashboard link")

# ==================== SUBSCRIPTION ROUTES ====================

def calculate_subscription_price(staff_count: int, pricing_tier: str = "centurion") -> float:
    """Calculate monthly subscription price based on staff count and pricing tier"""
    if pricing_tier == "centurion":
        base_price = CENTURION_BASE_PRICE
        additional_price = CENTURION_ADDITIONAL_STAFF
    else:
        base_price = STANDARD_BASE_PRICE
        additional_price = STANDARD_ADDITIONAL_STAFF
    
    if staff_count <= 1:
        return base_price
    return base_price + (additional_price * (staff_count - 1))

async def get_business_pricing_tier(business_id: str) -> str:
    """Get the pricing tier for a business"""
    subscription = await db.subscriptions.find_one({"businessId": business_id})
    if subscription:
        return subscription.get("pricingTier", "centurion")
    return "centurion"

@api_router.get("/my-subscription")
async def get_my_subscription(user: dict = Depends(require_business_owner)):
    """Get subscription details for the business"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    subscription = await db.subscriptions.find_one({"businessId": business["id"]})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Get current staff count
    staff_count = await db.staff.count_documents({"businessId": business["id"]})
    if staff_count == 0:
        staff_count = 1  # Minimum 1 staff (owner)
    
    # Get pricing tier
    pricing_tier = subscription.get("pricingTier", "centurion")
    
    # Calculate trial days remaining
    trial_days_remaining = 0
    if subscription.get("status") == "trial" and subscription.get("trialEndDate"):
        trial_end = subscription["trialEndDate"]
        if isinstance(trial_end, str):
            trial_end = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
        remaining = trial_end - datetime.now(timezone.utc)
        trial_days_remaining = max(0, remaining.days)
    
    return {
        "id": subscription["id"],
        "status": subscription.get("status", "trial"),
        "staffCount": staff_count,
        "priceMonthly": calculate_subscription_price(staff_count, pricing_tier),
        "pricingTier": pricing_tier,
        "isCenturion": business.get("isCenturion", False),
        "trialEndDate": subscription.get("trialEndDate"),
        "trialDaysRemaining": trial_days_remaining,
        "lastPaymentStatus": subscription.get("lastPaymentStatus"),
        "nextPaymentDate": subscription.get("nextPaymentDate"),
        "freeAccessOverride": subscription.get("freeAccessOverride", False),
        "hasPaymentMethod": bool(subscription.get("stripePaymentMethodId"))
    }

@api_router.get("/subscription/pricing")
async def get_subscription_pricing():
    """Get subscription pricing information"""
    return {
        "centurion": {
            "basePrice": CENTURION_BASE_PRICE,
            "additionalStaffPrice": CENTURION_ADDITIONAL_STAFF,
            "name": "Centurion (Founding Member)"
        },
        "standard": {
            "basePrice": STANDARD_BASE_PRICE,
            "additionalStaffPrice": STANDARD_ADDITIONAL_STAFF,
            "name": "Standard"
        },
        "trialDays": TRIAL_PERIOD_DAYS,
        "maxCenturions": MAX_CENTURIONS
    }

@api_router.post("/subscription/setup-payment")
async def setup_subscription_payment(request: Request, user: dict = Depends(require_business_owner)):
    """Create a Stripe Checkout session for subscription setup"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    subscription = await db.subscriptions.find_one({"businessId": business["id"]})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Get staff count for pricing
    staff_count = await db.staff.count_documents({"businessId": business["id"]})
    if staff_count == 0:
        staff_count = 1
    
    price = calculate_subscription_price(staff_count)
    origin_url = get_frontend_url(request)
    
    if not origin_url:
        raise HTTPException(status_code=400, detail="Unable to determine redirect URL. Please try again.")
    
    try:
        # Create or get Stripe customer
        if not subscription.get("stripeCustomerId"):
            customer = stripe.Customer.create(
                email=user["email"],
                name=user["fullName"],
                metadata={"business_id": business["id"]},
                # Enable automatic invoice emails
                invoice_settings={
                    "footer": "Thank you for using Calendrax!"
                }
            )
            await db.subscriptions.update_one(
                {"id": subscription["id"]},
                {"$set": {"stripeCustomerId": customer.id}}
            )
            customer_id = customer.id
        else:
            customer_id = subscription["stripeCustomerId"]
        
        # Create checkout session for subscription
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            customer_update={
                "name": "auto",
                "address": "auto"
            },
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "gbp",
                    "product_data": {
                        "name": f"Calendrax Subscription ({staff_count} staff)",
                        "description": f"Monthly subscription for {business['businessName']}"
                    },
                    "unit_amount": int(price * 100),  # Convert to pence
                    "recurring": {"interval": "month"}
                },
                "quantity": 1
            }],
            mode="subscription",
            success_url=f"{origin_url}/dashboard?subscription_success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin_url}/dashboard?subscription_cancelled=true",
            metadata={
                "business_id": business["id"],
                "subscription_id": subscription["id"],
                "staff_count": str(staff_count)
            },
            # Add description for the subscription
            subscription_data={
                "description": f"Calendrax Subscription for {business['businessName']}",
                "metadata": {
                    "business_id": business["id"],
                    "business_name": business["businessName"]
                }
            }
        )
        
        return {"url": checkout_session.url, "sessionId": checkout_session.id}
    except Exception as e:
        logger.error(f"Subscription setup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to setup subscription: {str(e)}")

@api_router.get("/subscription/verify/{session_id}")
async def verify_subscription_payment(session_id: str, user: dict = Depends(require_business_owner)):
    """Verify subscription payment was successful and update status"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    subscription = await db.subscriptions.find_one({"businessId": business["id"]})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    try:
        # Retrieve the checkout session
        checkout_session = stripe.checkout.Session.retrieve(session_id)
        
        if checkout_session.payment_status == "paid":
            # Update subscription status
            await db.subscriptions.update_one(
                {"id": subscription["id"]},
                {"$set": {
                    "status": "active",
                    "stripeSubscriptionId": checkout_session.subscription,
                    "stripeCustomerId": checkout_session.customer,
                    "lastPaymentStatus": "success",
                    "lastPaymentDate": datetime.now(timezone.utc).isoformat(),
                    "subscriptionStartDate": datetime.now(timezone.utc).isoformat()
                }}
            )
            return {"success": True, "status": "active"}
        else:
            return {"success": False, "status": checkout_session.payment_status}
    except Exception as e:
        logger.error(f"Error verifying subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to verify subscription")

@api_router.post("/webhook/subscription")
async def subscription_webhook(request: Request):
    """Handle Stripe webhook events for subscriptions"""
    try:
        body = await request.body()
        sig_header = request.headers.get("Stripe-Signature")
        
        # For now, just parse the event without signature verification
        # In production, you should verify the webhook signature
        import json
        event = json.loads(body)
        
        event_type = event.get("type", "")
        data = event.get("data", {}).get("object", {})
        
        if event_type == "checkout.session.completed":
            # Subscription payment successful
            metadata = data.get("metadata", {})
            subscription_id = metadata.get("subscription_id")
            
            if subscription_id:
                await db.subscriptions.update_one(
                    {"id": subscription_id},
                    {"$set": {
                        "status": "active",
                        "stripeSubscriptionId": data.get("subscription"),
                        "stripeCustomerId": data.get("customer"),
                        "lastPaymentStatus": "success",
                        "lastPaymentDate": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Award referral credits on first successful payment
                business = await db.businesses.find_one({"id": sub.get("businessId")})
                if business and business.get("referredBy") and not business.get("referralBonusPaid"):
                    # Find the referring business
                    referring_business = await db.businesses.find_one({"referralCode": business["referredBy"]})
                    if referring_business:
                        # Centurions get 2 credits, non-Centurions get 1
                        credits_to_award = 2 if referring_business.get("isCenturion") else 1
                        await db.businesses.update_one(
                            {"id": referring_business["id"]},
                            {"$inc": {"referralCredits": credits_to_award}}
                        )
                        await db.businesses.update_one(
                            {"id": business["id"]},
                            {"$set": {"referralBonusPaid": True}}
                        )
                        logger.info(f"Awarded {credits_to_award} referral credits to {referring_business['businessName']} for {business['businessName']}'s first payment")
        
        elif event_type == "invoice.created":
            # Invoice created - check if we should use referral credits instead
            customer_id = data.get("customer")
            invoice_id = data.get("id")
            amount_due = data.get("amount_due", 0)
            
            # Only process subscription invoices (not one-time payments)
            if data.get("subscription") and amount_due > 0:
                sub = await db.subscriptions.find_one({"stripeCustomerId": customer_id})
                if sub:
                    # Skip if this subscription has free access - credits shouldn't be used
                    if sub.get("freeAccessOverride", False):
                        logger.info(f"Skipping credit usage for subscription {sub.get('id')} - has free access override")
                    else:
                        business = await db.businesses.find_one({"id": sub.get("businessId")})
                        if business and business.get("referralCredits", 0) > 0:
                            # Business has credits - void the invoice and use a credit instead
                            try:
                                # Void the invoice in Stripe
                                stripe.Invoice.void_invoice(invoice_id)
                                
                                # Deduct a credit
                                await db.businesses.update_one(
                                    {"id": business["id"]},
                                    {"$inc": {"referralCredits": -1}}
                                )
                                
                                # Record the credit usage
                                credit_usage_doc = {
                                    "id": str(uuid.uuid4()),
                                    "businessId": business["id"],
                                    "type": "credit_used",
                                    "amount": amount_due / 100,  # Convert from pence to pounds
                                    "stripeInvoiceId": invoice_id,
                                    "creditsBefore": business.get("referralCredits", 0),
                                    "creditsAfter": business.get("referralCredits", 0) - 1,
                                    "date": datetime.now(timezone.utc).isoformat(),
                                    "description": f"Monthly subscription paid via referral credit (invoice voided)"
                                }
                                await db.billing_history.insert_one(credit_usage_doc)
                                
                                # Update subscription status
                                await db.subscriptions.update_one(
                                    {"id": sub["id"]},
                                    {"$set": {
                                        "lastPaymentStatus": "credit_used",
                                        "lastPaymentDate": datetime.now(timezone.utc).isoformat(),
                                        "status": "active"
                                    }}
                                )
                                
                                logger.info(f"Used referral credit for {business['businessName']}. Invoice {invoice_id} voided. Credits remaining: {business.get('referralCredits', 0) - 1}")
                            except Exception as credit_err:
                                logger.error(f"Failed to void invoice with credit: {credit_err}")
                                # Let the invoice proceed normally if voiding fails
        
        elif event_type == "invoice.payment_succeeded":
            # Recurring payment successful
            customer_id = data.get("customer")
            sub = await db.subscriptions.find_one({"stripeCustomerId": customer_id})
            if sub:
                await db.subscriptions.update_one(
                    {"id": sub["id"]},
                    {"$set": {
                        "lastPaymentStatus": "success",
                        "lastPaymentDate": datetime.now(timezone.utc).isoformat(),
                        "failedPayments": 0
                    }}
                )
                
                # Award referral credits if this is the first successful recurring payment
                business = await db.businesses.find_one({"id": sub.get("businessId")})
                if business and business.get("referredBy") and not business.get("referralBonusPaid"):
                    referring_business = await db.businesses.find_one({"referralCode": business["referredBy"]})
                    if referring_business:
                        credits_to_award = 2 if referring_business.get("isCenturion") else 1
                        await db.businesses.update_one(
                            {"id": referring_business["id"]},
                            {"$inc": {"referralCredits": credits_to_award}}
                        )
                        await db.businesses.update_one(
                            {"id": business["id"]},
                            {"$set": {"referralBonusPaid": True}}
                        )
                        logger.info(f"Awarded {credits_to_award} referral credits to {referring_business['businessName']} for {business['businessName']}'s first payment")
        
        elif event_type == "invoice.payment_failed":
            # Payment failed
            customer_id = data.get("customer")
            sub = await db.subscriptions.find_one({"stripeCustomerId": customer_id})
            if sub:
                failed_count = sub.get("failedPayments", 0) + 1
                new_status = "past_due" if failed_count < 3 else "inactive"
                await db.subscriptions.update_one(
                    {"id": sub["id"]},
                    {"$set": {
                        "lastPaymentStatus": "failed",
                        "failedPayments": failed_count,
                        "status": new_status
                    }}
                )
        
        elif event_type == "customer.subscription.deleted":
            # Subscription cancelled
            stripe_sub_id = data.get("id")
            sub = await db.subscriptions.find_one({"stripeSubscriptionId": stripe_sub_id})
            if sub:
                await db.subscriptions.update_one(
                    {"id": sub["id"]},
                    {"$set": {"status": "cancelled"}}
                )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Subscription webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

@api_router.post("/subscription/cancel")
async def cancel_subscription(user: dict = Depends(require_business_owner)):
    """Cancel the subscription (effective at end of billing period)"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    subscription = await db.subscriptions.find_one({"businessId": business["id"]})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # If in trial, just cancel immediately
    if subscription.get("status") == "trial":
        await db.subscriptions.update_one(
            {"id": subscription["id"]},
            {"$set": {"status": "cancelled"}}
        )
        return {"success": True, "message": "Trial cancelled"}
    
    # Cancel Stripe subscription if exists
    if subscription.get("stripeSubscriptionId"):
        try:
            stripe.Subscription.modify(
                subscription["stripeSubscriptionId"],
                cancel_at_period_end=True
            )
        except Exception as e:
            logger.error(f"Error cancelling Stripe subscription: {e}")
    
    await db.subscriptions.update_one(
        {"id": subscription["id"]},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"success": True, "message": "Subscription will be cancelled at the end of the billing period"}

# ==================== BILLING HISTORY ROUTES ====================

@api_router.get("/billing/invoices")
async def get_billing_invoices(user: dict = Depends(require_business_owner)):
    """Get all invoices for the business owner's subscription"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    subscription = await db.subscriptions.find_one({"businessId": business["id"]})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    invoices = []
    
    # Get Stripe customer ID
    customer_id = subscription.get("stripeCustomerId")
    if customer_id:
        try:
            # Fetch invoices from Stripe
            stripe_invoices = stripe.Invoice.list(
                customer=customer_id,
                limit=50
            )
            
            for inv in stripe_invoices.data:
                invoices.append({
                    "id": inv.id,
                    "number": inv.number,
                    "status": inv.status,
                    "amount": inv.amount_paid / 100,  # Convert from pence to pounds
                    "currency": inv.currency.upper(),
                    "date": datetime.fromtimestamp(inv.created, tz=timezone.utc).isoformat(),
                    "periodStart": datetime.fromtimestamp(inv.period_start, tz=timezone.utc).isoformat() if inv.period_start else None,
                    "periodEnd": datetime.fromtimestamp(inv.period_end, tz=timezone.utc).isoformat() if inv.period_end else None,
                    "pdfUrl": inv.invoice_pdf,
                    "hostedUrl": inv.hosted_invoice_url,
                    "description": inv.description or f"Calendrax Subscription",
                    "paid": inv.paid
                })
        except Exception as e:
            logger.error(f"Error fetching Stripe invoices: {e}")
    
    return {
        "invoices": invoices,
        "customerId": customer_id,
        "totalInvoices": len(invoices)
    }

@api_router.get("/billing/upcoming")
async def get_upcoming_invoice(user: dict = Depends(require_business_owner)):
    """Get the upcoming invoice for the subscription"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    subscription = await db.subscriptions.find_one({"businessId": business["id"]})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    customer_id = subscription.get("stripeCustomerId")
    stripe_sub_id = subscription.get("stripeSubscriptionId")
    
    if not customer_id or not stripe_sub_id:
        # Calculate what the next invoice would be
        staff_count = await db.staff.count_documents({"businessId": business["id"]})
        if staff_count == 0:
            staff_count = 1
        price = calculate_subscription_price(staff_count)
        
        return {
            "upcoming": {
                "amount": price,
                "currency": "GBP",
                "staffCount": staff_count,
                "description": f"Calendrax Subscription ({staff_count} staff)",
                "status": "pending_payment_setup"
            }
        }
    
    try:
        # Fetch upcoming invoice from Stripe
        upcoming = stripe.Invoice.upcoming(customer=customer_id)
        
        return {
            "upcoming": {
                "amount": upcoming.amount_due / 100,
                "currency": upcoming.currency.upper(),
                "date": datetime.fromtimestamp(upcoming.next_payment_attempt, tz=timezone.utc).isoformat() if upcoming.next_payment_attempt else None,
                "description": "Calendrax Subscription",
                "status": "scheduled"
            }
        }
    except stripe.error.InvalidRequestError as e:
        # No upcoming invoice (e.g., subscription cancelled)
        return {"upcoming": None}
    except Exception as e:
        logger.error(f"Error fetching upcoming invoice: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch upcoming invoice")

@api_router.post("/billing/enable-invoice-emails")
async def enable_invoice_emails(user: dict = Depends(require_business_owner)):
    """Enable automatic invoice emails for the customer"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    subscription = await db.subscriptions.find_one({"businessId": business["id"]})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    customer_id = subscription.get("stripeCustomerId")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found. Please set up payment first.")
    
    try:
        # Update customer to enable invoice emails
        stripe.Customer.modify(
            customer_id,
            invoice_settings={
                "custom_fields": None,
                "default_payment_method": None,
                "footer": "Thank you for using Calendrax!",
                "rendering_options": None
            }
        )
        
        # Also update the subscription to send invoice emails
        stripe_sub_id = subscription.get("stripeSubscriptionId")
        if stripe_sub_id:
            stripe.Subscription.modify(
                stripe_sub_id,
                collection_method="charge_automatically"
            )
        
        return {"success": True, "message": "Invoice emails enabled"}
    except Exception as e:
        logger.error(f"Error enabling invoice emails: {e}")
        raise HTTPException(status_code=500, detail="Failed to enable invoice emails")

# ==================== ACCOUNT REACTIVATION ====================

class ReactivateAccountRequest(BaseModel):
    paymentMethodId: str

@api_router.post("/billing/reactivate-account")
async def reactivate_account(request: ReactivateAccountRequest, user: dict = Depends(get_current_user)):
    """
    Reactivate a frozen account by adding payment method and charging immediately.
    Used when:
    1. Trial expired without payment method
    2. Payment failed (card declined/expired)
    """
    if user["role"] != UserRole.BUSINESS_OWNER:
        raise HTTPException(status_code=403, detail="Only business owners can reactivate accounts")
    
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    subscription = await db.subscriptions.find_one({"businessId": business["id"]})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Check if account is actually frozen
    if subscription.get("freeAccessOverride"):
        return {"success": True, "message": "Account has free access - no reactivation needed"}
    
    customer_id = subscription.get("stripeCustomerId")
    
    try:
        # If no Stripe customer exists, create one
        if not customer_id:
            customer = stripe.Customer.create(
                email=user["email"],
                name=user.get("fullName", ""),
                metadata={
                    "business_id": business["id"],
                    "user_id": user["id"]
                }
            )
            customer_id = customer.id
            await db.subscriptions.update_one(
                {"id": subscription["id"]},
                {"$set": {"stripeCustomerId": customer_id}}
            )
        
        # Attach the new payment method
        stripe.PaymentMethod.attach(
            request.paymentMethodId,
            customer=customer_id
        )
        
        # Set as default payment method
        stripe.Customer.modify(
            customer_id,
            invoice_settings={
                "default_payment_method": request.paymentMethodId
            }
        )
        
        # Calculate the subscription price
        staff_count = await db.staff.count_documents({"businessId": business["id"]})
        if staff_count == 0:
            staff_count = 1
        
        is_centurion = business.get("isCenturion", False)
        monthly_price = calculate_subscription_price(staff_count, is_centurion)
        
        # Check for referral credits first
        referral_credits = business.get("referralCredits", 0)
        
        if referral_credits > 0:
            # Use a credit instead of charging
            await db.businesses.update_one(
                {"id": business["id"]},
                {"$inc": {"referralCredits": -1}}
            )
            
            # Update subscription status to active
            await db.subscriptions.update_one(
                {"id": subscription["id"]},
                {"$set": {
                    "status": "active",
                    "hasPaymentMethod": True,
                    "stripePaymentMethodId": request.paymentMethodId,
                    "lastPaymentStatus": "credit_used",
                    "lastPaymentDate": datetime.now(timezone.utc).isoformat(),
                    "nextBillingDate": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                }}
            )
            
            # Create notification
            notification_doc = {
                "id": str(uuid.uuid4()),
                "userId": user["id"],
                "type": "account_reactivated",
                "title": "Account Reactivated",
                "message": f"Your account has been reactivated using 1 referral credit. You have {referral_credits - 1} credit(s) remaining.",
                "read": False,
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification_doc)
            
            return {
                "success": True,
                "paymentMethod": "credit_used",
                "message": f"Account reactivated using 1 referral credit. {referral_credits - 1} credit(s) remaining.",
                "amountCharged": 0,
                "creditsRemaining": referral_credits - 1
            }
        
        # No credits - charge the card immediately
        payment_intent = stripe.PaymentIntent.create(
            amount=int(monthly_price * 100),  # Convert to pence
            currency="gbp",
            customer=customer_id,
            payment_method=request.paymentMethodId,
            off_session=True,
            confirm=True,
            description=f"Calendrax Subscription - {business.get('businessName', 'Business')}",
            metadata={
                "business_id": business["id"],
                "subscription_id": subscription["id"],
                "type": "reactivation"
            }
        )
        
        if payment_intent.status == "succeeded":
            # Update subscription status to active
            await db.subscriptions.update_one(
                {"id": subscription["id"]},
                {"$set": {
                    "status": "active",
                    "hasPaymentMethod": True,
                    "stripePaymentMethodId": request.paymentMethodId,
                    "lastPaymentStatus": "succeeded",
                    "lastPaymentDate": datetime.now(timezone.utc).isoformat(),
                    "lastPaymentAmount": monthly_price,
                    "nextBillingDate": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                    "failedPayments": 0
                }}
            )
            
            # Create notification
            notification_doc = {
                "id": str(uuid.uuid4()),
                "userId": user["id"],
                "type": "account_reactivated",
                "title": "Account Reactivated",
                "message": f"Your account has been reactivated. £{monthly_price:.2f} has been charged to your card.",
                "read": False,
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification_doc)
            
            return {
                "success": True,
                "paymentMethod": "card",
                "message": f"Account reactivated successfully. £{monthly_price:.2f} charged.",
                "amountCharged": monthly_price
            }
        else:
            raise HTTPException(status_code=400, detail="Payment failed. Please try a different card.")
            
    except stripe.error.CardError as e:
        logger.error(f"Card error during reactivation: {e}")
        raise HTTPException(status_code=400, detail=f"Card declined: {e.user_message}")
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error during reactivation: {e}")
        raise HTTPException(status_code=500, detail="Payment processing failed. Please try again.")
    except Exception as e:
        logger.error(f"Error reactivating account: {e}")
        raise HTTPException(status_code=500, detail="Failed to reactivate account")

# ==================== REFERRAL CREDIT BILLING ====================

@api_router.post("/billing/process-with-credits")
async def process_billing_with_credits(user: dict = Depends(require_business_owner)):
    """
    Process monthly subscription billing, checking for referral credits first.
    If credits > 0: Skip Stripe charge, deduct 1 credit, mark as paid via credit.
    If credits = 0: Process normal Stripe charge.
    """
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    subscription = await db.subscriptions.find_one({"businessId": business["id"]})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Check if business has free access override
    if subscription.get("freeAccessOverride"):
        return {
            "success": True,
            "paymentMethod": "free_access",
            "message": "Free access granted - no payment required"
        }
    
    referral_credits = business.get("referralCredits", 0)
    
    if referral_credits > 0:
        # Use a credit instead of charging
        await db.businesses.update_one(
            {"id": business["id"]},
            {"$inc": {"referralCredits": -1}}
        )
        
        # Record the credit usage
        credit_usage_doc = {
            "id": str(uuid.uuid4()),
            "businessId": business["id"],
            "type": "credit_used",
            "amount": subscription.get("priceMonthly", 0),
            "creditsBefore": referral_credits,
            "creditsAfter": referral_credits - 1,
            "date": datetime.now(timezone.utc).isoformat(),
            "description": f"Subscription paid via referral credit"
        }
        await db.billing_history.insert_one(credit_usage_doc)
        
        # Update subscription status
        await db.subscriptions.update_one(
            {"id": subscription["id"]},
            {"$set": {
                "lastPaymentStatus": "credit_used",
                "lastPaymentDate": datetime.now(timezone.utc).isoformat(),
                "status": "active"
            }}
        )
        
        logger.info(f"Business {business['businessName']} used 1 referral credit. Remaining: {referral_credits - 1}")
        
        return {
            "success": True,
            "paymentMethod": "referral_credit",
            "creditsUsed": 1,
            "creditsRemaining": referral_credits - 1,
            "message": "Subscription paid using referral credit"
        }
    else:
        # No credits - proceed with normal Stripe charge
        # This would typically be handled by Stripe's automatic billing
        return {
            "success": True,
            "paymentMethod": "stripe",
            "creditsRemaining": 0,
            "message": "No credits available - Stripe will process payment automatically"
        }

@api_router.get("/billing/credit-history")
async def get_credit_history(user: dict = Depends(require_business_owner)):
    """Get the credit usage history for a business"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    history = await db.billing_history.find(
        {"businessId": business["id"], "type": "credit_used"}
    ).sort("date", -1).to_list(100)
    
    return remove_mongo_id(history)

@api_router.get("/admin/referral-stats")
async def admin_get_referral_stats(admin: dict = Depends(require_admin)):
    """Get overall referral statistics for admin dashboard"""
    # Total referral codes issued
    total_businesses = await db.businesses.count_documents({"referralCode": {"$exists": True, "$ne": None}})
    centurion_businesses = await db.businesses.count_documents({"isCenturion": True})
    
    # Total credits awarded (sum of all referralCredits + credits used)
    pipeline = [
        {"$group": {"_id": None, "totalCredits": {"$sum": "$referralCredits"}}}
    ]
    credits_result = await db.businesses.aggregate(pipeline).to_list(1)
    current_credits = credits_result[0]["totalCredits"] if credits_result else 0
    
    # Credits used
    credits_used = await db.billing_history.count_documents({"type": "credit_used"})
    
    # Successful referrals (businesses that have paid their referral bonus)
    successful_referrals = await db.businesses.count_documents({"referralBonusPaid": True})
    
    # Top referrers
    top_referrers_pipeline = [
        {"$match": {"referralCode": {"$exists": True, "$ne": None}}},
        {"$lookup": {
            "from": "businesses",
            "localField": "referralCode",
            "foreignField": "referredBy",
            "as": "referrals"
        }},
        {"$project": {
            "businessName": 1,
            "referralCode": 1,
            "referralCredits": 1,
            "isCenturion": 1,
            "referralCount": {"$size": {"$filter": {"input": "$referrals", "cond": {"$eq": ["$$this.referralBonusPaid", True]}}}}
        }},
        {"$match": {"referralCount": {"$gt": 0}}},
        {"$sort": {"referralCount": -1}},
        {"$limit": 10}
    ]
    top_referrers = await db.businesses.aggregate(top_referrers_pipeline).to_list(10)
    
    return {
        "totalBusinesses": total_businesses,
        "centurionBusinesses": centurion_businesses,
        "nonCenturionBusinesses": total_businesses - centurion_businesses,
        "currentCreditsInCirculation": current_credits,
        "creditsUsed": credits_used,
        "successfulReferrals": successful_referrals,
        "topReferrers": remove_mongo_id(top_referrers)
    }

# ==================== TRIAL REMINDER ROUTES ====================

@api_router.post("/admin/send-trial-reminders")
async def send_trial_reminders(admin: dict = Depends(require_admin)):
    """
    Send trial expiration reminders to business owners.
    Sends reminders on days 25, 28, and 30 of the trial period.
    This should be called by a cron job daily.
    """
    reminder_days = [5, 2, 0]  # Days remaining: 5 days, 2 days, 0 days (last day)
    
    results = {
        "checked": 0,
        "reminders_sent": 0,
        "errors": 0,
        "details": []
    }
    
    # Find all subscriptions in trial status
    subscriptions = await db.subscriptions.find({"status": "trial"}).to_list(1000)
    results["checked"] = len(subscriptions)
    
    for sub in subscriptions:
        try:
            # Calculate days remaining
            trial_end = sub.get("trialEndDate")
            if not trial_end:
                continue
                
            if isinstance(trial_end, str):
                trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
            else:
                trial_end_dt = trial_end
            
            days_remaining = (trial_end_dt - datetime.now(timezone.utc)).days
            
            # Check if we should send a reminder today
            if days_remaining not in reminder_days:
                continue
            
            # Get business and owner details
            business = await db.businesses.find_one({"id": sub["businessId"]})
            if not business:
                continue
                
            owner = await db.users.find_one({"id": sub["ownerId"]})
            if not owner:
                continue
            
            # Check if reminder was already sent today for this milestone
            reminder_key = f"trial_reminder_{days_remaining}_{sub['id']}"
            existing_reminder = await db.trial_reminders.find_one({"key": reminder_key})
            if existing_reminder:
                continue
            
            # Send the reminder
            reminder_result = await send_trial_reminder(
                owner_email=owner["email"],
                owner_phone=owner.get("mobile"),
                owner_name=owner["fullName"],
                business_name=business["businessName"],
                days_remaining=days_remaining,
                monthly_price=sub.get("priceMonthly", 12.00)
            )
            
            # Record that we sent this reminder
            await db.trial_reminders.insert_one({
                "key": reminder_key,
                "subscriptionId": sub["id"],
                "businessId": sub["businessId"],
                "ownerId": sub["ownerId"],
                "daysRemaining": days_remaining,
                "sentAt": datetime.now(timezone.utc).isoformat(),
                "result": reminder_result
            })
            
            results["reminders_sent"] += 1
            results["details"].append({
                "business": business["businessName"],
                "owner_email": owner["email"],
                "days_remaining": days_remaining,
                "result": reminder_result
            })
            
        except Exception as e:
            logger.error(f"Error sending trial reminder for subscription {sub.get('id')}: {str(e)}")
            results["errors"] += 1
    
    return results


@api_router.post("/admin/test-trial-reminder/{business_id}")
async def test_trial_reminder(business_id: str, admin: dict = Depends(require_admin)):
    """
    Test trial reminder by sending one to a specific business owner.
    For testing purposes only - sends a reminder immediately regardless of trial status.
    """
    business = await db.businesses.find_one({"id": business_id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    owner = await db.users.find_one({"id": business["ownerId"]})
    if not owner:
        raise HTTPException(status_code=404, detail="Business owner not found")
    
    subscription = await db.subscriptions.find_one({"businessId": business_id})
    monthly_price = subscription.get("priceMonthly", 12.00) if subscription else 12.00
    
    # Send test reminder with 5 days remaining
    result = await send_trial_reminder(
        owner_email=owner["email"],
        owner_phone=owner.get("mobile"),
        owner_name=owner["fullName"],
        business_name=business["businessName"],
        days_remaining=5,
        monthly_price=monthly_price
    )
    
    return {
        "success": True,
        "business": business["businessName"],
        "owner_email": owner["email"],
        "owner_phone": owner.get("mobile"),
        "result": result
    }

# ==================== PAYMENT ROUTES ====================

class PaymentRequest(BaseModel):
    serviceIds: List[str]  # Changed to list for multiple services
    businessId: str
    staffId: Optional[str] = None
    date: str
    time: str
    originUrl: str
    offerCode: Optional[str] = None
    
    # For backward compatibility
    @property
    def serviceId(self):
        return self.serviceIds[0] if self.serviceIds else None

@api_router.post("/payments/validate-offer-code")
async def validate_offer_code(data: dict, user: dict = Depends(get_current_user)):
    """Validate an offer code"""
    code = data.get("code", "").upper().strip()
    if code in VALID_OFFER_CODES:
        return {
            "valid": True,
            "type": VALID_OFFER_CODES[code]["type"],
            "message": "Valid offer code - payment will be bypassed"
        }
    return {"valid": False, "message": "Invalid offer code"}

@api_router.post("/payments/create-checkout")
async def create_checkout_session(request: Request, data: PaymentRequest, user: dict = Depends(get_current_user)):
    """Create a Stripe checkout session for booking deposit based on business settings"""
    
    # Validate business first
    business = await db.businesses.find_one({"id": data.businessId})
    if not business or not business.get("approved"):
        raise HTTPException(status_code=400, detail="Business not available")
    
    # Fetch all selected services
    services = []
    total_price = 0
    total_duration = 0
    service_names = []
    
    for sid in data.serviceIds:
        service = await db.services.find_one({"id": sid})
        if not service:
            raise HTTPException(status_code=404, detail=f"Service {sid} not found")
        services.append(service)
        total_price += float(service["price"])
        total_duration += int(service.get("duration", 30))
        service_names.append(service["name"])
    
    if not services:
        raise HTTPException(status_code=400, detail="No services selected")
    
    # Get deposit level from business settings (default to 20%)
    deposit_level = business.get("depositLevel", "20")
    deposit_percentage = DEPOSIT_LEVELS.get(deposit_level, 20)
    
    # Check for valid offer code (bypass payment)
    if data.offerCode:
        code = data.offerCode.upper().strip()
        if code in VALID_OFFER_CODES:
            # Create a pending booking transaction with bypass
            transaction_id = str(uuid.uuid4())
            transaction_doc = {
                "id": transaction_id,
                "userId": user["id"],
                "serviceIds": data.serviceIds,
                "serviceId": data.serviceIds[0],  # For backward compatibility
                "businessId": data.businessId,
                "staffId": data.staffId,
                "date": data.date,
                "time": data.time,
                "totalDuration": total_duration,
                "amount": 0,
                "fullPrice": total_price,
                "currency": "gbp",
                "status": "bypassed",
                "paymentStatus": "bypassed",
                "offerCode": code,
                "sessionId": None,
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            await db.payment_transactions.insert_one(transaction_doc)
            
            return {
                "bypassed": True,
                "transactionId": transaction_id,
                "message": "Payment bypassed with offer code",
                "totalDuration": total_duration
            }
    
    # If deposit is "none" (0%), bypass payment
    if deposit_percentage == 0:
        transaction_id = str(uuid.uuid4())
        transaction_doc = {
            "id": transaction_id,
            "userId": user["id"],
            "serviceIds": data.serviceIds,
            "serviceId": data.serviceIds[0],
            "businessId": data.businessId,
            "staffId": data.staffId,
            "date": data.date,
            "time": data.time,
            "totalDuration": total_duration,
            "amount": 0,
            "fullPrice": total_price,
            "currency": "gbp",
            "status": "bypassed",
            "paymentStatus": "no_deposit",
            "sessionId": None,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction_doc)
        
        return {
            "bypassed": True,
            "transactionId": transaction_id,
            "message": "No deposit required for this business",
            "totalDuration": total_duration
        }
    
    # Calculate deposit based on total price
    deposit_amount = round(total_price * (deposit_percentage / 100), 2)
    
    if deposit_amount < 0.50:
        deposit_amount = 0.50  # Stripe minimum is 50 cents/pence
    
    # Create transaction record first
    transaction_id = str(uuid.uuid4())
    
    # Build success and cancel URLs
    success_url = f"{data.originUrl}/booking-success?session_id={{CHECKOUT_SESSION_ID}}&transaction_id={transaction_id}"
    cancel_url = f"{data.originUrl}/business/{data.businessId}?cancelled=true"
    
    # Build service description for checkout
    services_description = ", ".join(service_names)
    
    # Check if business has Stripe Connect and use it for destination charges
    stripe_account_id = business.get("stripeConnectAccountId") if business.get("stripeConnectOnboarded") else None
    
    try:
        # Build checkout session parameters
        checkout_params = {
            "payment_method_types": ["card"],
            "line_items": [{
                "price_data": {
                    "currency": "gbp",
                    "product_data": {
                        "name": f"Deposit for {services_description}" if len(services) > 1 else f"Deposit for {services[0]['name']}",
                        "description": f"Booking at {business['businessName']} on {data.date} at {data.time} ({total_duration} mins)"
                    },
                    "unit_amount": int(deposit_amount * 100),  # Convert to pence
                },
                "quantity": 1
            }],
            "mode": "payment",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "metadata": {
                "transaction_id": transaction_id,
                "user_id": user["id"],
                "service_ids": ",".join(data.serviceIds),
                "business_id": data.businessId,
                "staff_id": data.staffId or "",
                "date": data.date,
                "time": data.time,
                "service_names": services_description,
                "business_name": business["businessName"],
                "full_price": str(total_price),
                "deposit_amount": str(deposit_amount),
                "total_duration": str(total_duration)
            }
        }
        
        # Platform application fee (5% of deposit to cover Stripe fees)
        PLATFORM_FEE_PERCENT = 5
        application_fee = int(deposit_amount * 100 * PLATFORM_FEE_PERCENT / 100)  # In pence
        
        # If business has connected Stripe account, route payment to them (destination charge)
        if stripe_account_id:
            checkout_params["payment_intent_data"] = {
                "application_fee_amount": application_fee,  # Platform takes 5%
                "transfer_data": {
                    "destination": stripe_account_id
                }
            }
            logger.info(f"Creating checkout with destination charge to {stripe_account_id}, application fee: {application_fee} pence")
        else:
            logger.info("Creating checkout without destination (business not connected)")
        
        # Create checkout session using native Stripe SDK
        session = stripe.checkout.Session.create(**checkout_params)
        
        # Save transaction record
        transaction_doc = {
            "id": transaction_id,
            "userId": user["id"],
            "userEmail": user["email"],
            "serviceIds": data.serviceIds,
            "serviceId": data.serviceIds[0],  # For backward compatibility
            "businessId": data.businessId,
            "staffId": data.staffId,
            "date": data.date,
            "time": data.time,
            "totalDuration": total_duration,
            "amount": deposit_amount,
            "fullPrice": total_price,
            "applicationFee": application_fee / 100 if stripe_account_id else 0,  # Platform fee in pounds
            "businessReceives": deposit_amount - (application_fee / 100) if stripe_account_id else 0,
            "currency": "gbp",
            "status": "pending",
            "paymentStatus": "initiated",
            "sessionId": session.id,
            "stripeConnectAccountId": stripe_account_id,  # Track where payment goes
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction_doc)
        
        return {
            "url": session.url,
            "sessionId": session.id,
            "transactionId": transaction_id,
            "depositAmount": deposit_amount,
            "fullPrice": service_price,
            "paymentDestination": "business" if stripe_account_id else "platform"
        }
    except Exception as e:
        logger.error(f"Stripe checkout error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create payment session: {str(e)}")

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Get the status of a payment session"""
    
    # Find the transaction
    transaction = await db.payment_transactions.find_one({"sessionId": session_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed, return cached status
    if transaction.get("paymentStatus") in ["paid", "completed"]:
        return {
            "status": transaction["status"],
            "paymentStatus": transaction["paymentStatus"],
            "transactionId": transaction["id"]
        }
    
    # Check status using native Stripe SDK
    try:
        checkout_session = stripe.checkout.Session.retrieve(session_id)
        
        # Update transaction status
        new_status = "completed" if checkout_session.payment_status == "paid" else checkout_session.status
        new_payment_status = checkout_session.payment_status
        
        await db.payment_transactions.update_one(
            {"sessionId": session_id},
            {"$set": {
                "status": new_status,
                "paymentStatus": new_payment_status,
                "paymentIntentId": checkout_session.payment_intent,
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "status": new_status,
            "paymentStatus": new_payment_status,
            "transactionId": transaction["id"],
            "amount": checkout_session.amount_total / 100 if checkout_session.amount_total else 0,
            "currency": checkout_session.currency
        }
    except Exception as e:
        logger.error(f"Error checking payment status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")

@api_router.post("/payments/complete-booking")
async def complete_booking_after_payment(data: dict, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Complete booking after successful payment or offer code bypass"""
    
    transaction_id = data.get("transactionId")
    session_id = data.get("sessionId")
    
    # Find the transaction
    query = {"id": transaction_id} if transaction_id else {"sessionId": session_id}
    transaction = await db.payment_transactions.find_one(query)
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Check if booking already created
    existing_booking = await db.appointments.find_one({"transactionId": transaction["id"]})
    if existing_booking:
        return {"success": True, "appointment": remove_mongo_id(existing_booking), "message": "Booking already exists"}
    
    # Verify payment is completed or bypassed
    is_bypassed = transaction.get("status") == "bypassed"
    is_paid = transaction.get("paymentStatus") in ["paid", "completed"]
    
    if not is_bypassed and not is_paid:
        # Double-check with Stripe if we have a session
        if transaction.get("sessionId"):
            from fastapi import Request as FastAPIRequest
            # We need to verify with Stripe
            pass  # Skip re-verification for now, trust transaction status
        raise HTTPException(status_code=400, detail="Payment not completed")
    
    # Get all services for the booking
    service_ids = transaction.get("serviceIds", [transaction.get("serviceId")])
    if isinstance(service_ids, str):
        service_ids = [service_ids]
    
    services = []
    service_names = []
    total_price = 0
    total_duration = transaction.get("totalDuration", 0)
    
    for sid in service_ids:
        service = await db.services.find_one({"id": sid})
        if service:
            services.append(service)
            service_names.append(service["name"])
            total_price += float(service["price"])
            if total_duration == 0:
                total_duration += int(service.get("duration", 30))
    
    business = await db.businesses.find_one({"id": transaction["businessId"]})
    
    if not services or not business:
        raise HTTPException(status_code=404, detail="Services or business not found")
    
    # Get staff member if specified
    staff_name = None
    if transaction.get("staffId"):
        staff = await db.staff.find_one({"id": transaction["staffId"], "businessId": business["id"]})
        if staff:
            staff_name = staff.get("name")
    
    # Get business owner details for notification
    business_owner = await db.users.find_one({"id": business["ownerId"]})
    
    # Build service names string
    services_display = ", ".join(service_names)
    
    # Create the appointment
    deposit_amount = transaction.get("amount", 0)
    appointment_doc = {
        "id": str(uuid.uuid4()),
        "transactionId": transaction["id"],
        "userId": user["id"],
        "customerName": user["fullName"],
        "customerEmail": user["email"],
        "customerPhone": user.get("mobile"),
        "businessId": business["id"],
        "businessName": business["businessName"],
        "serviceIds": service_ids,
        "serviceId": service_ids[0],  # For backward compatibility
        "serviceName": services_display,
        "staffId": transaction.get("staffId"),
        "staffName": staff_name,
        "date": transaction["date"],
        "time": transaction["time"],
        "duration": total_duration,
        "status": "pending",
        "paymentStatus": "deposit_paid" if not is_bypassed else "bypassed",
        "paymentAmount": total_price,
        "depositAmount": float(deposit_amount),
        "depositPaid": not is_bypassed,
        "offerCodeUsed": transaction.get("offerCode"),
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(appointment_doc)
    
    # Create in-app notification for business owner
    payment_note = f" (£{deposit_amount:.2f} deposit paid)" if not is_bypassed else " (Offer code used)"
    notification_doc = {
        "id": str(uuid.uuid4()),
        "userId": business["ownerId"],
        "type": "new_booking",
        "title": "New Booking Request",
        "message": f"{user['fullName']} requested {services_display} ({total_duration} mins) on {transaction['date']} at {transaction['time']}" + (f" with {staff_name}" if staff_name else "") + payment_note,
        "read": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    # Send email/SMS notification to business owner (in background)
    if business_owner:
        # Get business owner's notification preferences
        bo_email_enabled = business_owner.get("emailReminders", True)
        bo_whatsapp_enabled = business_owner.get("whatsappReminders", True)
        background_tasks.add_task(
            notify_booking_created,
            business_owner_email=business_owner["email"],
            business_owner_phone=business_owner.get("mobile"),
            business_name=business["businessName"],
            customer_name=user["fullName"],
            service_name=services_display,
            date=transaction["date"],
            time=transaction["time"],
            email_enabled=bo_email_enabled,
            whatsapp_enabled=bo_whatsapp_enabled
        )
    
    # Remove slots from availability for the total duration
    # Calculate all time slots that need to be blocked
    start_time = transaction["time"]
    slots_to_remove = []
    
    # Parse start time and calculate all slots to block
    try:
        start_hour, start_min = map(int, start_time.split(":"))
        current_minutes = start_hour * 60 + start_min
        end_minutes = current_minutes + total_duration
        
        # Block in 30-minute increments
        while current_minutes < end_minutes:
            hour = current_minutes // 60
            minute = current_minutes % 60
            slot_time = f"{hour:02d}:{minute:02d}"
            slots_to_remove.append(slot_time)
            current_minutes += 30  # Assuming 30-minute slot intervals
    except:
        # Fallback: just remove the start time
        slots_to_remove = [start_time]
    
    # Remove all slots
    avail_query = {"businessId": business["id"], "date": transaction["date"]}
    if transaction.get("staffId"):
        avail_query["staffId"] = transaction["staffId"]
    
    for slot in slots_to_remove:
        await db.availability.update_one(
            avail_query,
            {"$pull": {"slots": slot}}
        )
    
    logger.info(f"Blocked {len(slots_to_remove)} slots for booking: {slots_to_remove}")
    
    return {"success": True, "appointment": remove_mongo_id(appointment_doc)}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events for customer deposits"""
    try:
        body = await request.body()
        import json
        event = json.loads(body)
        
        event_type = event.get("type", "")
        data = event.get("data", {}).get("object", {})
        
        logger.info(f"Received Stripe webhook: {event_type}")
        
        if event_type == "checkout.session.completed":
            session_id = data.get("id")
            payment_status = data.get("payment_status")
            
            if session_id:
                await db.payment_transactions.update_one(
                    {"sessionId": session_id},
                    {"$set": {
                        "status": "completed" if payment_status == "paid" else payment_status,
                        "paymentStatus": payment_status,
                        "paymentIntentId": data.get("payment_intent"),
                        "webhookEventType": event_type,
                        "updatedAt": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logger.info(f"Updated transaction for session {session_id}: {payment_status}")
        
        elif event_type == "payment_intent.succeeded":
            payment_intent_id = data.get("id")
            await db.payment_transactions.update_one(
                {"paymentIntentId": payment_intent_id},
                {"$set": {
                    "status": "completed",
                    "paymentStatus": "paid",
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Stripe webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

# ==================== APPOINTMENT ROUTES ====================

@api_router.post("/appointments")
async def create_appointment(appointment_data: dict, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Create appointment - NOTE: For paid bookings, use /payments/create-checkout instead"""
    business = await db.businesses.find_one({"id": appointment_data["businessId"]})
    if not business or not business.get("approved"):
        raise HTTPException(status_code=400, detail="Business not available")
    
    service = await db.services.find_one({"id": appointment_data["serviceId"]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Get staff member if specified
    staff_id = appointment_data.get("staffId")
    staff_name = None
    if staff_id:
        staff = await db.staff.find_one({"id": staff_id, "businessId": business["id"]})
        if staff:
            staff_name = staff.get("name")
    
    # Get business owner details for notification
    business_owner = await db.users.find_one({"id": business["ownerId"]})
    
    appointment_doc = {
        "id": str(uuid.uuid4()),
        "userId": user["id"],
        "customerName": user["fullName"],
        "customerEmail": user["email"],
        "customerPhone": user.get("mobile"),
        "businessId": business["id"],
        "businessName": business["businessName"],
        "serviceId": service["id"],
        "serviceName": service["name"],
        "staffId": staff_id,
        "staffName": staff_name,
        "date": appointment_data["date"],
        "time": appointment_data["time"],
        "status": "pending",
        "paymentStatus": "pending",
        "paymentAmount": service["price"],
        "depositAmount": 0,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(appointment_doc)
    
    # Create in-app notification for business owner
    notification_doc = {
        "id": str(uuid.uuid4()),
        "userId": business["ownerId"],
        "type": "new_booking",
        "title": "New Booking Request",
        "message": f"{user['fullName']} requested {service['name']} on {appointment_data['date']} at {appointment_data['time']}" + (f" with {staff_name}" if staff_name else ""),
        "read": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    # Send email/SMS notification to business owner (in background)
    if business_owner:
        # Get business owner's notification preferences
        bo_email_enabled = business_owner.get("emailReminders", True)
        bo_whatsapp_enabled = business_owner.get("whatsappReminders", True)
        background_tasks.add_task(
            notify_booking_created,
            business_owner_email=business_owner["email"],
            business_owner_phone=business_owner.get("mobile"),
            business_name=business["businessName"],
            customer_name=user["fullName"],
            service_name=service["name"],
            date=appointment_data["date"],
            time=appointment_data["time"],
            email_enabled=bo_email_enabled,
            whatsapp_enabled=bo_whatsapp_enabled
        )
    
    # Remove slot from availability (for specific staff if applicable)
    avail_query = {"businessId": business["id"], "date": appointment_data["date"]}
    if staff_id:
        avail_query["staffId"] = staff_id
    await db.availability.update_one(
        avail_query,
        {"$pull": {"slots": appointment_data["time"]}}
    )
    
    return remove_mongo_id(appointment_doc)

@api_router.post("/appointments/book-for-customer")
async def book_for_customer(appointment_data: dict, background_tasks: BackgroundTasks, user: dict = Depends(require_business_owner)):
    """Business owner books an appointment for a customer (auto-confirmed)"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    service = await db.services.find_one({"id": appointment_data["serviceId"], "businessId": business["id"]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Get or create customer
    customer_id = appointment_data.get("customerId")
    customer_name = appointment_data.get("customerName")
    customer_email = appointment_data.get("customerEmail")
    customer_phone = appointment_data.get("customerPhone")
    
    if customer_id:
        # Existing customer
        customer = await db.users.find_one({"id": customer_id})
        if customer:
            customer_name = customer["fullName"]
            customer_email = customer["email"]
            customer_phone = customer.get("mobile")
    
    new_customer_created = False
    temp_password = None
    
    if not customer_id and customer_email:
        # Check if customer exists by email
        existing = await db.users.find_one({"email": customer_email})
        if existing:
            customer_id = existing["id"]
            customer_name = existing["fullName"]
        else:
            # Create a new customer account with a temporary password
            import secrets
            import string
            customer_id = str(uuid.uuid4())
            # Generate a readable temporary password (8 chars, letters and numbers)
            alphabet = string.ascii_letters + string.digits
            temp_password = ''.join(secrets.choice(alphabet) for _ in range(8))
            hashed_password = hashlib.sha256(temp_password.encode()).hexdigest()
            
            new_customer = {
                "id": customer_id,
                "email": customer_email,
                "fullName": customer_name or "Guest Customer",
                "mobile": customer_phone or "",
                "password": hashed_password,
                "role": "customer",
                "suspended": False,
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(new_customer)
            new_customer_created = True
    
    # Get staff member if specified
    staff_id = appointment_data.get("staffId")
    staff_name = None
    if staff_id:
        staff = await db.staff.find_one({"id": staff_id, "businessId": business["id"]})
        if staff:
            staff_name = staff.get("name")
    
    # Create the appointment (auto-confirmed since business owner is booking)
    appointment_doc = {
        "id": str(uuid.uuid4()),
        "userId": customer_id,
        "customerName": customer_name,
        "customerEmail": customer_email,
        "customerPhone": customer_phone,
        "businessId": business["id"],
        "businessName": business["businessName"],
        "serviceId": service["id"],
        "serviceName": service["name"],
        "staffId": staff_id,
        "staffName": staff_name,
        "date": appointment_data["date"],
        "time": appointment_data["time"],
        "status": "confirmed",  # Auto-confirmed
        "paymentStatus": "pending",
        "paymentAmount": service["price"],
        "depositAmount": 0,
        "bookedByOwner": True,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(appointment_doc)
    
    # Send confirmation notification to customer if they exist in system
    if customer_id and customer_email:
        notification_doc = {
            "id": str(uuid.uuid4()),
            "userId": customer_id,
            "type": "booking_confirmed",
            "title": "Booking Confirmed",
            "message": f"Your appointment for {service['name']} at {business['businessName']} on {appointment_data['date']} at {appointment_data['time']} has been confirmed.",
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
        
        # Get customer notification preferences
        customer_user = await db.users.find_one({"id": customer_id})
        cust_email_enabled = customer_user.get("emailReminders", True) if customer_user else True
        cust_whatsapp_enabled = customer_user.get("whatsappReminders", True) if customer_user else True
        
        # Send email notification
        background_tasks.add_task(
            notify_booking_approved,
            customer_email=customer_email,
            customer_phone=customer_phone,
            customer_name=customer_name,
            business_name=business["businessName"],
            service_name=service["name"],
            date=appointment_data["date"],
            time=appointment_data["time"],
            email_enabled=cust_email_enabled,
            whatsapp_enabled=cust_whatsapp_enabled
        )
    
    # Remove slot from availability
    avail_query = {"businessId": business["id"], "date": appointment_data["date"]}
    if staff_id:
        avail_query["staffId"] = staff_id
    await db.availability.update_one(
        avail_query,
        {"$pull": {"slots": appointment_data["time"]}}
    )
    
    result = remove_mongo_id(appointment_doc)
    
    # Include new customer login details if a new account was created
    if new_customer_created and temp_password:
        result["newCustomerCreated"] = True
        result["customerCredentials"] = {
            "email": customer_email,
            "temporaryPassword": temp_password
        }
    
    return result

@api_router.get("/business-customers")
async def get_business_customers(user: dict = Depends(require_business_owner)):
    """Get all customers who have booked with this business"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        return []
    
    # Get unique customers from appointments
    appointments = await db.appointments.find({"businessId": business["id"]}).to_list(1000)
    customer_ids = list(set([apt.get("userId") for apt in appointments if apt.get("userId")]))
    
    customers = []
    for cid in customer_ids:
        customer = await db.users.find_one({"id": cid})
        if customer:
            customers.append({
                "id": customer["id"],
                "fullName": customer["fullName"],
                "email": customer["email"],
                "mobile": customer.get("mobile", "")
            })
    
    return customers

@api_router.get("/my-appointments")
async def get_my_appointments(user: dict = Depends(get_current_user)):
    appointments = await db.appointments.find({"userId": user["id"]}).to_list(1000)
    return remove_mongo_id(appointments)

@api_router.get("/business-appointments")
async def get_business_appointments(user: dict = Depends(require_business_owner)):
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        return []
    appointments = await db.appointments.find({"businessId": business["id"]}).to_list(1000)
    return remove_mongo_id(appointments)

@api_router.put("/appointments/{appointment_id}/status")
async def update_appointment_status(appointment_id: str, status: str, background_tasks: BackgroundTasks, user: dict = Depends(require_business_owner)):
    business = await db.businesses.find_one({"ownerId": user["id"]})
    appointment = await db.appointments.find_one({"id": appointment_id, "businessId": business["id"]})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    refund_result = None
    
    # If declining and deposit was paid, process refund
    if status == "declined" and appointment.get("depositPaid") and appointment.get("transactionId"):
        transaction = await db.payment_transactions.find_one({"id": appointment["transactionId"]})
        if transaction and transaction.get("sessionId"):
            try:
                # Get the payment intent from the checkout session to refund
                checkout_session = stripe.checkout.Session.retrieve(transaction["sessionId"])
                if checkout_session.payment_intent:
                    refund = stripe.Refund.create(
                        payment_intent=checkout_session.payment_intent,
                        reason="requested_by_customer"
                    )
                    refund_result = {
                        "refundId": refund.id,
                        "amount": refund.amount / 100,  # Convert from pence
                        "status": refund.status
                    }
                    
                    # Update transaction with refund info
                    await db.payment_transactions.update_one(
                        {"id": transaction["id"]},
                        {"$set": {
                            "refundId": refund.id,
                            "refundStatus": refund.status,
                            "refundAmount": refund.amount / 100,
                            "refundedAt": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    # Update appointment with refund info
                    await db.appointments.update_one(
                        {"id": appointment_id},
                        {"$set": {
                            "depositRefunded": True,
                            "refundAmount": refund.amount / 100
                        }}
                    )
            except Exception as e:
                logger.error(f"Refund failed for appointment {appointment_id}: {str(e)}")
                refund_result = {"error": str(e)}
    
    await db.appointments.update_one({"id": appointment_id}, {"$set": {"status": status}})
    
    # Get customer details for notification
    customer = await db.users.find_one({"id": appointment["userId"]})
    
    # Create in-app notification for customer
    refund_note = ""
    if status == "declined" and refund_result and not refund_result.get("error"):
        refund_note = f" Your deposit of £{refund_result['amount']:.2f} has been refunded."
    
    notification_doc = {
        "id": str(uuid.uuid4()),
        "userId": appointment["userId"],
        "type": f"booking_{status}",
        "title": f"Booking {status.title()}",
        "message": f"Your booking for {appointment['serviceName']} has been {status}.{refund_note}",
        "read": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    # Send email/SMS notification to customer (in background)
    if customer:
        # Get customer's notification preferences
        cust_email_enabled = customer.get("emailReminders", True)
        cust_whatsapp_enabled = customer.get("whatsappReminders", True)
        
        if status == "confirmed":
            background_tasks.add_task(
                notify_booking_approved,
                customer_email=customer["email"],
                customer_phone=customer.get("mobile"),
                customer_name=customer["fullName"],
                business_name=appointment["businessName"],
                service_name=appointment["serviceName"],
                date=appointment["date"],
                time=appointment["time"],
                email_enabled=cust_email_enabled,
                whatsapp_enabled=cust_whatsapp_enabled
            )
        elif status == "declined":
            background_tasks.add_task(
                notify_booking_declined,
                customer_email=customer["email"],
                customer_phone=customer.get("mobile"),
                customer_name=customer["fullName"],
                business_name=appointment["businessName"],
                service_name=appointment["serviceName"],
                date=appointment["date"],
                time=appointment["time"],
                email_enabled=cust_email_enabled,
                whatsapp_enabled=cust_whatsapp_enabled
            )
    
    return {"success": True, "refund": refund_result}

@api_router.put("/appointments/{appointment_id}/cancel")
async def cancel_appointment(appointment_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Cancel an appointment - only business owner can cancel"""
    # Get the appointment
    appointment = await db.appointments.find_one({"id": appointment_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Verify the user is the business owner
    business = await db.businesses.find_one({"id": appointment["businessId"]})
    if not business or business["ownerId"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment")
    
    await db.appointments.update_one({"id": appointment_id}, {"$set": {"status": "cancelled"}})
    
    # Get customer for notification
    customer = await db.users.find_one({"id": appointment["userId"]})
    
    # Create in-app notification for customer
    notification_doc = {
        "id": str(uuid.uuid4()),
        "userId": appointment["userId"],
        "type": "booking_cancelled",
        "title": "Booking Cancelled",
        "message": f"Your booking for {appointment['serviceName']} on {appointment['date']} at {appointment['time']} at {business['businessName']} has been cancelled.",
        "read": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    # Send email/WhatsApp notification to customer (in background)
    if customer:
        customer_email_enabled = customer.get("emailReminders", True)
        customer_whatsapp_enabled = customer.get("whatsappReminders", True)
        background_tasks.add_task(
            notify_customer_booking_cancelled,
            customer_email=customer["email"],
            customer_phone=customer.get("mobile"),
            customer_name=customer["fullName"],
            business_name=business["businessName"],
            service_name=appointment["serviceName"],
            date=appointment["date"],
            time=appointment["time"],
            email_enabled=customer_email_enabled,
            whatsapp_enabled=customer_whatsapp_enabled
        )
    
    return {"success": True}

@api_router.put("/appointments/{appointment_id}/attendance")
async def mark_appointment_attendance(
    appointment_id: str, 
    attendance: str,  # 'show' or 'no_show'
    user: dict = Depends(get_current_user)
):
    """Mark customer attendance for a past appointment"""
    if attendance not in ['show', 'no_show']:
        raise HTTPException(status_code=400, detail="Attendance must be 'show' or 'no_show'")
    
    # Get the appointment and verify ownership
    appointment = await db.appointments.find_one({"id": appointment_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Verify user owns the business
    business = await db.businesses.find_one({"id": appointment["businessId"], "ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=403, detail="Not authorized to update this appointment")
    
    # Update the appointment with attendance
    await db.appointments.update_one(
        {"id": appointment_id}, 
        {"$set": {"attendance": attendance}}
    )
    
    return {"success": True, "attendance": attendance}

# ==================== NOTIFICATION ROUTES ====================

@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find({"userId": user["id"]}).sort("createdAt", -1).to_list(100)
    return remove_mongo_id(notifications)

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "userId": user["id"]},
        {"$set": {"read": True}}
    )
    return {"success": True}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"userId": user["id"]},
        {"$set": {"read": True}}
    )
    return {"success": True}

@api_router.get("/notifications/status")
async def get_external_notification_status():
    """Check if email and SMS notifications are configured"""
    return get_notification_status()

@api_router.post("/notifications/test-whatsapp")
async def test_whatsapp_notification(data: dict, user: dict = Depends(require_admin)):
    """Send a test WhatsApp message (admin only)"""
    phone = data.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")
    
    message = data.get("message", "🧪 *Test Message from Calendrax*\n\nIf you receive this, WhatsApp notifications are working correctly!")
    
    success = send_whatsapp(phone, message)
    
    if success:
        return {"success": True, "message": f"Test WhatsApp message sent to {phone}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send WhatsApp message. Check logs for details.")

# ==================== REVENUE ROUTES ====================

def get_week_range(date: datetime):
    """Get start and end of the week containing the given date (Monday to Sunday)"""
    start = date - timedelta(days=date.weekday())
    end = start + timedelta(days=6)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

def get_month_range(date: datetime):
    """Get start and end of the month containing the given date"""
    start = date.replace(day=1)
    # Get last day of month
    if date.month == 12:
        end = date.replace(year=date.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        end = date.replace(month=date.month + 1, day=1) - timedelta(days=1)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

def get_year_range(date: datetime):
    """Get start and end of the calendar year"""
    start = date.replace(month=1, day=1)
    end = date.replace(month=12, day=31)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

async def calculate_revenue(business_id: str, start_date: str, end_date: str, staff_id: str = None):
    """Calculate revenue for a given date range"""
    query = {
        "businessId": business_id,
        "date": {"$gte": start_date, "$lte": end_date},
        "status": {"$in": ["confirmed", "completed"]}
    }
    if staff_id:
        query["staffId"] = staff_id
    
    appointments = await db.appointments.find(query).to_list(10000)
    
    total_revenue = sum(float(apt.get("paymentAmount", 0)) for apt in appointments)
    booking_count = len(appointments)
    
    return {
        "revenue": round(total_revenue, 2),
        "bookingCount": booking_count
    }

@api_router.get("/revenue")
async def get_revenue_summary(user: dict = Depends(require_business_owner)):
    """Get revenue summary for the business"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    now = datetime.now(timezone.utc)
    
    # Current week
    current_week_start, current_week_end = get_week_range(now)
    current_week = await calculate_revenue(business["id"], current_week_start, current_week_end)
    
    # Previous week (for comparison)
    prev_week_date = now - timedelta(weeks=1)
    prev_week_start, prev_week_end = get_week_range(prev_week_date)
    prev_week = await calculate_revenue(business["id"], prev_week_start, prev_week_end)
    
    # Current month
    current_month_start, current_month_end = get_month_range(now)
    current_month = await calculate_revenue(business["id"], current_month_start, current_month_end)
    
    # Previous month (for comparison)
    prev_month_date = now.replace(day=1) - timedelta(days=1)
    prev_month_start, prev_month_end = get_month_range(prev_month_date)
    prev_month = await calculate_revenue(business["id"], prev_month_start, prev_month_end)
    
    # Current year
    current_year_start, current_year_end = get_year_range(now)
    current_year = await calculate_revenue(business["id"], current_year_start, current_year_end)
    
    # Previous year (for comparison)
    prev_year_date = now.replace(year=now.year - 1)
    prev_year_start, prev_year_end = get_year_range(prev_year_date)
    prev_year = await calculate_revenue(business["id"], prev_year_start, prev_year_end)
    
    # Calculate week-over-week and month-over-month changes
    week_change = current_week["revenue"] - prev_week["revenue"]
    week_change_percent = ((current_week["revenue"] - prev_week["revenue"]) / prev_week["revenue"] * 100) if prev_week["revenue"] > 0 else 0
    
    month_change = current_month["revenue"] - prev_month["revenue"]
    month_change_percent = ((current_month["revenue"] - prev_month["revenue"]) / prev_month["revenue"] * 100) if prev_month["revenue"] > 0 else 0
    
    return {
        "currentWeek": {
            **current_week,
            "startDate": current_week_start,
            "endDate": current_week_end,
            "label": f"Week of {current_week_start}"
        },
        "previousWeek": {
            **prev_week,
            "startDate": prev_week_start,
            "endDate": prev_week_end,
            "label": f"Week of {prev_week_start}"
        },
        "currentMonth": {
            **current_month,
            "startDate": current_month_start,
            "endDate": current_month_end,
            "label": now.strftime("%B %Y")
        },
        "previousMonth": {
            **prev_month,
            "startDate": prev_month_start,
            "endDate": prev_month_end,
            "label": prev_month_date.strftime("%B %Y")
        },
        "currentYear": {
            **current_year,
            "startDate": current_year_start,
            "endDate": current_year_end,
            "label": str(now.year)
        },
        "previousYear": {
            **prev_year,
            "startDate": prev_year_start,
            "endDate": prev_year_end,
            "label": str(now.year - 1)
        },
        "comparison": {
            "weekOverWeek": {
                "change": round(week_change, 2),
                "percentChange": round(week_change_percent, 1)
            },
            "monthOverMonth": {
                "change": round(month_change, 2),
                "percentChange": round(month_change_percent, 1)
            }
        }
    }

@api_router.get("/revenue/by-staff")
async def get_revenue_by_staff(user: dict = Depends(require_business_owner)):
    """Get revenue breakdown by staff member"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    now = datetime.now(timezone.utc)
    
    # Get date ranges
    current_week_start, current_week_end = get_week_range(now)
    prev_week_date = now - timedelta(weeks=1)
    prev_week_start, prev_week_end = get_week_range(prev_week_date)
    
    current_month_start, current_month_end = get_month_range(now)
    prev_month_date = now.replace(day=1) - timedelta(days=1)
    prev_month_start, prev_month_end = get_month_range(prev_month_date)
    
    current_year_start, current_year_end = get_year_range(now)
    
    # Get all staff members
    staff_members = await db.staff.find({"businessId": business["id"]}).to_list(100)
    
    staff_revenue = []
    for staff in staff_members:
        staff_data = {
            "staffId": staff["id"],
            "staffName": staff["name"],
            "isOwner": staff.get("isOwner", False),
            "currentWeek": await calculate_revenue(business["id"], current_week_start, current_week_end, staff["id"]),
            "previousWeek": await calculate_revenue(business["id"], prev_week_start, prev_week_end, staff["id"]),
            "currentMonth": await calculate_revenue(business["id"], current_month_start, current_month_end, staff["id"]),
            "previousMonth": await calculate_revenue(business["id"], prev_month_start, prev_month_end, staff["id"]),
            "currentYear": await calculate_revenue(business["id"], current_year_start, current_year_end, staff["id"])
        }
        
        # Calculate changes for this staff member
        prev_week_rev = staff_data["previousWeek"]["revenue"]
        curr_week_rev = staff_data["currentWeek"]["revenue"]
        prev_month_rev = staff_data["previousMonth"]["revenue"]
        curr_month_rev = staff_data["currentMonth"]["revenue"]
        
        staff_data["weekChange"] = round(curr_week_rev - prev_week_rev, 2)
        staff_data["weekChangePercent"] = round(((curr_week_rev - prev_week_rev) / prev_week_rev * 100) if prev_week_rev > 0 else 0, 1)
        staff_data["monthChange"] = round(curr_month_rev - prev_month_rev, 2)
        staff_data["monthChangePercent"] = round(((curr_month_rev - prev_month_rev) / prev_month_rev * 100) if prev_month_rev > 0 else 0, 1)
        
        staff_revenue.append(staff_data)
    
    # Sort by current month revenue (highest first)
    staff_revenue.sort(key=lambda x: x["currentMonth"]["revenue"], reverse=True)
    
    return {
        "staffRevenue": staff_revenue,
        "dateRanges": {
            "currentWeek": {"start": current_week_start, "end": current_week_end, "label": f"Week of {current_week_start}"},
            "previousWeek": {"start": prev_week_start, "end": prev_week_end, "label": f"Week of {prev_week_start}"},
            "currentMonth": {"start": current_month_start, "end": current_month_end, "label": now.strftime("%B %Y")},
            "previousMonth": {"start": prev_month_start, "end": prev_month_end, "label": prev_month_date.strftime("%B %Y")},
            "currentYear": {"start": current_year_start, "end": current_year_end, "label": str(now.year)}
        }
    }

@api_router.get("/revenue/by-service")
async def get_revenue_by_service(user: dict = Depends(require_business_owner)):
    """Get revenue breakdown by service/treatment including deleted services"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Get all appointments for this business (confirmed and completed)
    appointments = await db.appointments.find({
        "businessId": business["id"],
        "status": {"$in": ["confirmed", "completed"]}
    }).to_list(10000)
    
    # Get current services
    current_services = await db.services.find({"businessId": business["id"]}).to_list(100)
    service_map = {s["id"]: s["name"] for s in current_services}
    
    # Calculate revenue by service
    service_revenue = {}
    for apt in appointments:
        # Handle multi-service bookings
        service_ids = apt.get("serviceIds", [apt.get("serviceId")] if apt.get("serviceId") else [])
        total_price = apt.get("totalPrice", 0)
        
        # If single service, use it directly
        if len(service_ids) == 1:
            service_id = service_ids[0]
            service_name = apt.get("serviceName") or service_map.get(service_id, "Unknown Service")
            
            if service_id not in service_revenue:
                service_revenue[service_id] = {
                    "serviceId": service_id,
                    "serviceName": service_name,
                    "totalRevenue": 0,
                    "bookingCount": 0,
                    "isDeleted": service_id not in service_map
                }
            
            service_revenue[service_id]["totalRevenue"] += total_price
            service_revenue[service_id]["bookingCount"] += 1
        else:
            # For multi-service bookings, try to split by individual service prices
            # Or divide evenly if not possible
            for service_id in service_ids:
                service_name = service_map.get(service_id, "Unknown Service")
                
                if service_id not in service_revenue:
                    service_revenue[service_id] = {
                        "serviceId": service_id,
                        "serviceName": service_name,
                        "totalRevenue": 0,
                        "bookingCount": 0,
                        "isDeleted": service_id not in service_map
                    }
                
                # Divide revenue equally among services in multi-service booking
                service_revenue[service_id]["totalRevenue"] += total_price / len(service_ids)
                service_revenue[service_id]["bookingCount"] += 1
    
    # Convert to list and sort by revenue
    services_list = list(service_revenue.values())
    services_list.sort(key=lambda x: x["totalRevenue"], reverse=True)
    
    # Calculate total
    total_revenue = sum(s["totalRevenue"] for s in services_list)
    
    return {
        "serviceRevenue": services_list,
        "totalRevenue": round(total_revenue, 2),
        "serviceCount": len(services_list)
    }

@api_router.get("/revenue/monthly")
async def get_monthly_revenue(user: dict = Depends(require_business_owner)):
    """Get monthly revenue breakdown for current year and future years (2027-2030)"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    now = datetime.now(timezone.utc)
    current_year = now.year
    years_to_include = [current_year, 2027, 2028, 2029, 2030]
    
    # Make sure we include current year even if it's after 2030
    if current_year not in years_to_include:
        years_to_include = [current_year] + years_to_include
    years_to_include = sorted(list(set(years_to_include)))
    
    month_names = ["January", "February", "March", "April", "May", "June", 
                   "July", "August", "September", "October", "November", "December"]
    
    yearly_data = {}
    
    for year in years_to_include:
        monthly_data = []
        year_total = 0
        
        for month_num in range(1, 13):
            # Get month range
            month_start = f"{year}-{month_num:02d}-01"
            if month_num == 12:
                month_end = f"{year}-12-31"
            else:
                next_month = month_num + 1
                month_end = f"{year}-{next_month:02d}-01"
            
            revenue_data = await calculate_revenue(business["id"], month_start, month_end)
            
            monthly_data.append({
                "month": month_names[month_num - 1],
                "monthNum": month_num,
                "revenue": round(revenue_data["revenue"], 2),
                "bookingCount": revenue_data["bookingCount"]
            })
            year_total += revenue_data["revenue"]
        
        yearly_data[str(year)] = {
            "year": year,
            "months": monthly_data,
            "yearTotal": round(year_total, 2)
        }
    
    return {
        "yearlyBreakdown": yearly_data,
        "years": years_to_include
    }

@api_router.delete("/business-customers/{customer_id}")
async def delete_business_customer(customer_id: str, user: dict = Depends(require_business_owner)):
    """Delete future appointments for a customer while preserving past booking history for revenue tracking"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check if customer has any appointments with this business
    customer_appointments = await db.appointments.find({
        "businessId": business["id"],
        "userId": customer_id
    }).to_list(1000)
    
    if not customer_appointments:
        raise HTTPException(status_code=404, detail="Customer not found for this business")
    
    # Get today's date for comparison
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Count past and future appointments
    past_appointments = [apt for apt in customer_appointments if apt.get("date", "") < today]
    future_appointments = [apt for apt in customer_appointments if apt.get("date", "") >= today]
    
    # Calculate past revenue to preserve
    past_revenue = sum(apt.get("totalPrice", 0) for apt in past_appointments)
    
    # Delete only future appointments
    if future_appointments:
        future_ids = [apt["id"] for apt in future_appointments]
        delete_result = await db.appointments.delete_many({
            "businessId": business["id"],
            "userId": customer_id,
            "id": {"$in": future_ids}
        })
        deleted_count = delete_result.deleted_count
    else:
        deleted_count = 0
    
    return {
        "success": True,
        "message": f"Customer's future bookings deleted. Past booking history preserved for revenue tracking.",
        "deletedAppointments": deleted_count,
        "preservedAppointments": len(past_appointments),
        "preservedRevenue": round(past_revenue, 2)
    }


# ==================== PAYOUT HISTORY ROUTES ====================

@api_router.get("/payouts")
async def get_payout_history(user: dict = Depends(require_business_owner)):
    """Get payout history for the business - customer deposits received"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Get all completed payment transactions for this business
    transactions = await db.payment_transactions.find({
        "businessId": business["id"],
        "paymentStatus": {"$in": ["paid", "completed"]}
    }).sort("createdAt", -1).to_list(500)
    
    payouts = []
    total_deposits = 0
    total_fees = 0
    total_received = 0
    total_refunded = 0
    
    for tx in transactions:
        deposit_amount = float(tx.get("amount", 0))
        application_fee = float(tx.get("applicationFee", 0))
        business_receives = float(tx.get("businessReceives", deposit_amount - application_fee))
        refund_amount = float(tx.get("refundAmount", 0))
        
        # Get appointment details
        appointment = await db.appointments.find_one({"transactionId": tx["id"]})
        
        payout = {
            "id": tx["id"],
            "date": tx.get("createdAt", ""),
            "depositAmount": deposit_amount,
            "platformFee": application_fee,
            "businessReceives": business_receives,
            "amount": business_receives,  # Keep for backward compatibility
            "currency": tx.get("currency", "gbp"),
            "customerEmail": tx.get("userEmail", ""),
            "serviceName": appointment.get("serviceName", "Unknown Service") if appointment else "Unknown Service",
            "staffName": appointment.get("staffName", "") if appointment else "",
            "bookingDate": tx.get("date", ""),
            "bookingTime": tx.get("time", ""),
            "status": "refunded" if tx.get("refundId") else "received",
            "refundAmount": refund_amount,
            "refundedAt": tx.get("refundedAt"),
            "destination": "business" if tx.get("stripeConnectAccountId") else "platform"
        }
        payouts.append(payout)
        
        if tx.get("refundId"):
            total_refunded += refund_amount
        else:
            total_deposits += deposit_amount
            total_fees += application_fee
            total_received += business_receives
    
    # Calculate summary by period
    now = datetime.now(timezone.utc)
    current_month_start, current_month_end = get_month_range(now)
    prev_month_date = now.replace(day=1) - timedelta(days=1)
    prev_month_start, prev_month_end = get_month_range(prev_month_date)
    current_year_start, current_year_end = get_year_range(now)
    
    # Calculate period totals (using businessReceives, not deposit amount)
    def get_period_totals(start, end):
        period_txs = [tx for tx in transactions if tx.get("createdAt", "")[:10] >= start and tx.get("createdAt", "")[:10] <= end and not tx.get("refundId")]
        deposits = sum(float(tx.get("amount", 0)) for tx in period_txs)
        fees = sum(float(tx.get("applicationFee", 0)) for tx in period_txs)
        received = sum(float(tx.get("businessReceives", tx.get("amount", 0))) for tx in period_txs)
        return {"deposits": deposits, "fees": fees, "received": received}
    
    current_month_totals = get_period_totals(current_month_start, current_month_end)
    prev_month_totals = get_period_totals(prev_month_start, prev_month_end)
    year_totals = get_period_totals(current_year_start, current_year_end)
    
    stripe_connected = business.get("stripeConnectOnboarded", False)
    
    return {
        "payouts": payouts,
        "summary": {
            "totalDeposits": round(total_deposits, 2),
            "totalPlatformFees": round(total_fees, 2),
            "totalReceived": round(total_received, 2),
            "totalRefunded": round(total_refunded, 2),
            "netReceived": round(total_received - total_refunded, 2),
            "currentMonth": round(current_month_totals["received"], 2),
            "currentMonthDeposits": round(current_month_totals["deposits"], 2),
            "currentMonthFees": round(current_month_totals["fees"], 2),
            "previousMonth": round(prev_month_totals["received"], 2),
            "yearToDate": round(year_totals["received"], 2),
            "yearToDateDeposits": round(year_totals["deposits"], 2),
            "yearToDateFees": round(year_totals["fees"], 2),
            "transactionCount": len(payouts),
            "platformFeePercent": 5
        },
        "stripeConnected": stripe_connected,
        "payoutDestination": "Your Bank Account" if stripe_connected else "Platform Account (Connect bank to receive directly)"
    }

# ==================== ADVANCED ANALYTICS ROUTES ====================

@api_router.get("/analytics")
async def get_advanced_analytics(user: dict = Depends(require_business_owner)):
    """Get advanced analytics for the business"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    now = datetime.now(timezone.utc)
    current_month_start, current_month_end = get_month_range(now)
    prev_month_date = now.replace(day=1) - timedelta(days=1)
    prev_month_start, prev_month_end = get_month_range(prev_month_date)
    current_year_start, current_year_end = get_year_range(now)
    
    # Get all appointments for analysis
    all_appointments = await db.appointments.find({"businessId": business["id"]}).to_list(10000)
    
    # Get services for popularity analysis
    services = await db.services.find({"businessId": business["id"]}).to_list(100)
    service_map = {s["id"]: s["name"] for s in services}
    
    # 1. Service Popularity Analysis
    service_bookings = {}
    for apt in all_appointments:
        sid = apt.get("serviceId")
        if sid:
            if sid not in service_bookings:
                service_bookings[sid] = {"count": 0, "revenue": 0, "name": service_map.get(sid, "Unknown")}
            service_bookings[sid]["count"] += 1
            service_bookings[sid]["revenue"] += float(apt.get("paymentAmount", 0))
    
    popular_services = sorted(
        [{"serviceId": k, **v} for k, v in service_bookings.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:5]
    
    # 2. Peak Hours Analysis (when most bookings happen)
    hour_distribution = {}
    for apt in all_appointments:
        time_str = apt.get("time", "")
        if time_str:
            hour = int(time_str.split(":")[0]) if ":" in time_str else 0
            hour_distribution[hour] = hour_distribution.get(hour, 0) + 1
    
    peak_hours = sorted(
        [{"hour": k, "count": v, "label": f"{k}:00 - {k+1}:00"} for k, v in hour_distribution.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:5]
    
    # 3. Day of Week Analysis
    day_distribution = {}
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for apt in all_appointments:
        date_str = apt.get("date", "")
        if date_str:
            try:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                day_num = date_obj.weekday()
                day_distribution[day_num] = day_distribution.get(day_num, 0) + 1
            except:
                pass
    
    busiest_days = sorted(
        [{"day": day_names[k], "dayNum": k, "count": v} for k, v in day_distribution.items()],
        key=lambda x: x["count"],
        reverse=True
    )
    
    # 4. Customer Retention Analysis
    customer_booking_counts = {}
    for apt in all_appointments:
        uid = apt.get("userId")
        if uid:
            customer_booking_counts[uid] = customer_booking_counts.get(uid, 0) + 1
    
    total_customers = len(customer_booking_counts)
    repeat_customers = sum(1 for count in customer_booking_counts.values() if count > 1)
    new_customers = total_customers - repeat_customers
    retention_rate = round((repeat_customers / total_customers * 100) if total_customers > 0 else 0, 1)
    
    # 5. Booking Status Breakdown
    status_counts = {}
    for apt in all_appointments:
        status = apt.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # 6. Monthly Trend (last 6 months)
    monthly_trend = []
    for i in range(5, -1, -1):
        trend_date = now - timedelta(days=30 * i)
        month_start, month_end = get_month_range(trend_date)
        month_apts = [
            apt for apt in all_appointments 
            if apt.get("date", "")[:10] >= month_start and apt.get("date", "")[:10] <= month_end
        ]
        month_revenue = sum(float(apt.get("paymentAmount", 0)) for apt in month_apts if apt.get("status") in ["confirmed", "completed"])
        monthly_trend.append({
            "month": trend_date.strftime("%b %Y"),
            "bookings": len(month_apts),
            "revenue": round(month_revenue, 2)
        })
    
    # 7. Average Metrics
    confirmed_apts = [apt for apt in all_appointments if apt.get("status") in ["confirmed", "completed"]]
    avg_booking_value = round(
        sum(float(apt.get("paymentAmount", 0)) for apt in confirmed_apts) / len(confirmed_apts) if confirmed_apts else 0,
        2
    )
    
    # Conversion rate (confirmed / total)
    total_bookings = len(all_appointments)
    confirmed_count = len(confirmed_apts)
    conversion_rate = round((confirmed_count / total_bookings * 100) if total_bookings > 0 else 0, 1)
    
    return {
        "popularServices": popular_services,
        "peakHours": peak_hours,
        "busiestDays": busiest_days,
        "customerRetention": {
            "totalCustomers": total_customers,
            "repeatCustomers": repeat_customers,
            "newCustomers": new_customers,
            "retentionRate": retention_rate
        },
        "bookingStatusBreakdown": [
            {"status": k, "count": v} for k, v in sorted(status_counts.items(), key=lambda x: x[1], reverse=True)
        ],
        "monthlyTrend": monthly_trend,
        "averageMetrics": {
            "averageBookingValue": avg_booking_value,
            "conversionRate": conversion_rate,
            "totalBookings": total_bookings,
            "confirmedBookings": confirmed_count
        }
    }


# ==================== REVIEW ROUTES ====================

@api_router.post("/reviews")
async def create_review(review_data: ReviewCreate, user: dict = Depends(get_current_user)):
    """Create a review for a business (customers only)"""
    if user.get("role") != "customer":
        raise HTTPException(status_code=403, detail="Only customers can leave reviews")
    
    # Validate rating
    if review_data.rating < 1 or review_data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    # Get business
    business = await db.businesses.find_one({"id": review_data.businessId})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check if customer has had an appointment with this business
    has_appointment = await db.appointments.find_one({
        "userId": user["id"],
        "businessId": review_data.businessId,
        "status": {"$in": ["confirmed", "completed"]}
    })
    
    if not has_appointment:
        raise HTTPException(status_code=400, detail="You can only review businesses you have booked with")
    
    # Check if customer has already reviewed this business
    existing_review = await db.reviews.find_one({
        "customerId": user["id"],
        "businessId": review_data.businessId
    })
    
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this business")
    
    # Create review
    review = Review(
        businessId=review_data.businessId,
        businessName=business["businessName"],
        customerId=user["id"],
        customerName=user["fullName"],
        appointmentId=review_data.appointmentId,
        rating=review_data.rating,
        comment=review_data.comment
    )
    
    await db.reviews.insert_one(review.dict())
    
    return remove_mongo_id(review.dict())

@api_router.get("/businesses/{business_id}/reviews")
async def get_business_reviews(business_id: str):
    """Get all reviews for a business (public)"""
    reviews = await db.reviews.find({"businessId": business_id}).sort("createdAt", -1).to_list(100)
    
    # Calculate average rating
    total_rating = sum(r["rating"] for r in reviews) if reviews else 0
    avg_rating = total_rating / len(reviews) if reviews else 0
    
    return {
        "reviews": [remove_mongo_id(r) for r in reviews],
        "totalReviews": len(reviews),
        "averageRating": round(avg_rating, 1)
    }

@api_router.get("/my-reviews")
async def get_my_reviews(user: dict = Depends(get_current_user)):
    """Get reviews written by the current customer"""
    reviews = await db.reviews.find({"customerId": user["id"]}).sort("createdAt", -1).to_list(100)
    return [remove_mongo_id(r) for r in reviews]

@api_router.get("/business/reviews")
async def get_business_owner_reviews(user: dict = Depends(require_business_owner)):
    """Get all reviews for the business owner's business"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    reviews = await db.reviews.find({"businessId": business["id"]}).sort("createdAt", -1).to_list(100)
    
    total_rating = sum(r["rating"] for r in reviews) if reviews else 0
    avg_rating = total_rating / len(reviews) if reviews else 0
    
    return {
        "reviews": [remove_mongo_id(r) for r in reviews],
        "totalReviews": len(reviews),
        "averageRating": round(avg_rating, 1)
    }

@api_router.delete("/reviews/{review_id}")
async def delete_review(review_id: str, user: dict = Depends(get_current_user)):
    """Delete a review (admin only or own review)"""
    review = await db.reviews.find_one({"id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Allow deletion if admin or if it's the customer's own review
    is_admin = user.get("role") == "platform_admin"
    is_owner = review["customerId"] == user["id"]
    
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="You can only delete your own reviews")
    
    await db.reviews.delete_one({"id": review_id})
    
    return {"success": True, "message": "Review deleted"}

@api_router.get("/admin/reviews")
async def admin_get_all_reviews(admin: dict = Depends(require_admin)):
    """Get all reviews (admin only)"""
    reviews = await db.reviews.find({}).sort("createdAt", -1).to_list(500)
    return [remove_mongo_id(r) for r in reviews]


# ==================== ADMIN ROUTES ====================

@api_router.post("/admin/migrate-centurions")
async def admin_migrate_centurions(admin: dict = Depends(require_admin)):
    """Migrate all existing businesses to Centurion status"""
    # Find all businesses that are not yet Centurion
    businesses = await db.businesses.find({"isCenturion": {"$ne": True}}).to_list(1000)
    migrated_count = 0
    
    for business in businesses:
        # Update business to Centurion
        await db.businesses.update_one(
            {"id": business["id"]},
            {"$set": {
                "isCenturion": True,
                "centurionJoinedAt": business.get("createdAt", datetime.now(timezone.utc).isoformat())
            }}
        )
        
        # Update subscription pricing tier
        await db.subscriptions.update_one(
            {"businessId": business["id"]},
            {"$set": {"pricingTier": "centurion"}}
        )
        migrated_count += 1
    
    # Get new Centurion count
    centurion_count = await db.businesses.count_documents({"isCenturion": True})
    
    return {
        "success": True,
        "migratedCount": migrated_count,
        "totalCenturions": centurion_count,
        "spotsRemaining": max(0, MAX_CENTURIONS - centurion_count)
    }

@api_router.post("/admin/migrate-referral-codes")
async def admin_migrate_referral_codes(admin: dict = Depends(require_admin)):
    """Generate referral codes for all existing businesses that don't have one"""
    # Find all businesses without referral codes
    businesses = await db.businesses.find({"referralCode": {"$exists": False}}).to_list(1000)
    # Also find businesses with null referral codes
    businesses_null = await db.businesses.find({"referralCode": None}).to_list(1000)
    
    # Combine and dedupe
    all_businesses = {b["id"]: b for b in businesses + businesses_null}.values()
    
    migrated_count = 0
    for business in all_businesses:
        is_centurion = business.get("isCenturion", False)
        referral_code = await generate_referral_code(is_centurion)
        
        await db.businesses.update_one(
            {"id": business["id"]},
            {"$set": {
                "referralCode": referral_code,
                "referralCredits": business.get("referralCredits", 0),
                "referralBonusPaid": False
            }}
        )
        migrated_count += 1
    
    return {
        "success": True,
        "migratedCount": migrated_count,
        "message": f"Generated referral codes for {migrated_count} businesses"
    }

@api_router.get("/admin/stats")
async def admin_get_stats(admin: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_customers = await db.users.count_documents({"role": UserRole.CUSTOMER})
    total_business_owners = await db.users.count_documents({"role": UserRole.BUSINESS_OWNER})
    total_businesses = await db.businesses.count_documents({})
    pending_businesses = await db.businesses.count_documents({"approved": False, "rejected": {"$ne": True}})
    total_appointments = await db.appointments.count_documents({})
    pending_appointments = await db.appointments.count_documents({"status": "pending"})
    active_subscriptions = await db.subscriptions.count_documents({"status": "active"})
    failed_payments = await db.subscriptions.count_documents({"lastPaymentStatus": "failed"})
    
    return {
        "totalUsers": total_users,
        "totalCustomers": total_customers,
        "totalBusinessOwners": total_business_owners,
        "totalBusinesses": total_businesses,
        "pendingBusinesses": pending_businesses,
        "totalAppointments": total_appointments,
        "pendingAppointments": pending_appointments,
        "activeSubscriptions": active_subscriptions,
        "failedPayments": failed_payments
    }

@api_router.get("/admin/users")
async def admin_get_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({"role": {"$ne": UserRole.PLATFORM_ADMIN}}, {"password": 0}).to_list(1000)
    return remove_mongo_id(users)

@api_router.get("/admin/users/{user_id}")
async def admin_get_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id}, {"password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return remove_mongo_id(user)

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, updates: UserUpdate, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if updates.suspended:
        update_data["suspendedAt"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    return {"success": True}

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow deleting admins
    if user.get("role") == UserRole.PLATFORM_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot delete admin users")
    
    # Delete user's business if they're a business owner
    if user.get("role") == UserRole.BUSINESS_OWNER:
        # Get all businesses first before deleting
        businesses = await db.businesses.find({"ownerId": user_id}).to_list(100)
        business_ids = [b["id"] for b in businesses]
        
        # Delete related services
        if business_ids:
            await db.services.delete_many({"businessId": {"$in": business_ids}})
            await db.staff.delete_many({"businessId": {"$in": business_ids}})
            await db.bookings.delete_many({"businessId": {"$in": business_ids}})
            await db.availability.delete_many({"businessId": {"$in": business_ids}})
        
        # Delete subscriptions
        await db.subscriptions.delete_many({"ownerId": user_id})
        
        # Delete businesses
        await db.businesses.delete_many({"ownerId": user_id})
        
        # Clear referral references (don't delete referrer's record, just clear the reference)
        await db.businesses.update_many(
            {"referredBy": user_id},
            {"$set": {"referredBy": None}}
        )
    
    # If customer, delete their bookings
    if user.get("role") == UserRole.CUSTOMER:
        await db.bookings.delete_many({"customerId": user_id})
    
    # Finally delete the user
    await db.users.delete_one({"id": user_id})
    
    return {"success": True, "message": f"User {user.get('email')} and all related data deleted"}

@api_router.get("/admin/businesses")
async def admin_get_businesses(admin: dict = Depends(require_admin)):
    businesses = await db.businesses.find().to_list(1000)
    result = []
    for business in businesses:
        b = remove_mongo_id(business)
        owner = await db.users.find_one({"id": business["ownerId"]}, {"password": 0})
        b["owner"] = remove_mongo_id(owner)
        result.append(b)
    return result

@api_router.put("/admin/businesses/{business_id}")
async def admin_update_business(business_id: str, updates: BusinessUpdate, admin: dict = Depends(require_admin)):
    business = await db.businesses.find_one({"id": business_id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    # Handle approval
    if updates.approved:
        update_data["approvedAt"] = datetime.now(timezone.utc).isoformat()
        update_data["approvedBy"] = admin["id"]
        update_data["rejected"] = False
        # Activate subscription
        await db.subscriptions.update_one(
            {"businessId": business_id},
            {"$set": {"status": "active"}}
        )
        # Notify owner
        notification_doc = {
            "id": str(uuid.uuid4()),
            "userId": business["ownerId"],
            "type": "business_approved",
            "title": "Business Approved!",
            "message": f"Your business '{business['businessName']}' has been approved. You can now receive bookings!",
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
    
    # Handle rejection
    if updates.rejected:
        update_data["approved"] = False
        # Notify owner
        notification_doc = {
            "id": str(uuid.uuid4()),
            "userId": business["ownerId"],
            "type": "business_rejected",
            "title": "Business Application Rejected",
            "message": f"Your business '{business['businessName']}' application was rejected. Reason: {updates.rejectedReason or 'Not specified'}",
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
    
    await db.businesses.update_one({"id": business_id}, {"$set": update_data})
    return {"success": True}

@api_router.delete("/admin/businesses/{business_id}")
async def admin_delete_business(business_id: str, admin: dict = Depends(require_admin)):
    business = await db.businesses.find_one({"id": business_id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    await db.services.delete_many({"businessId": business_id})
    await db.subscriptions.delete_many({"businessId": business_id})
    await db.appointments.delete_many({"businessId": business_id})
    await db.availability.delete_many({"businessId": business_id})
    await db.businesses.delete_one({"id": business_id})
    
    return {"success": True}

@api_router.get("/admin/subscriptions")
async def admin_get_subscriptions(admin: dict = Depends(require_admin)):
    subscriptions = await db.subscriptions.find().to_list(1000)
    result = []
    for sub in subscriptions:
        s = remove_mongo_id(sub)
        business = await db.businesses.find_one({"id": sub["businessId"]})
        s["business"] = remove_mongo_id(business)
        result.append(s)
    return result

@api_router.put("/admin/subscriptions/{subscription_id}")
async def admin_update_subscription(subscription_id: str, updates: dict, admin: dict = Depends(require_admin)):
    await db.subscriptions.update_one({"id": subscription_id}, {"$set": updates})
    
    # If status changed, update business access accordingly
    if "status" in updates:
        sub = await db.subscriptions.find_one({"id": subscription_id})
        if sub:
            business = await db.businesses.find_one({"id": sub["businessId"]})
            if business and updates["status"] == "inactive":
                # Notify owner about restricted access
                notification_doc = {
                    "id": str(uuid.uuid4()),
                    "userId": business["ownerId"],
                    "type": "subscription_inactive",
                    "title": "Subscription Inactive",
                    "message": "Your subscription is inactive. Your business won't receive new bookings until payment is resolved.",
                    "read": False,
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                await db.notifications.insert_one(notification_doc)
    
    return {"success": True}

@api_router.put("/admin/subscriptions/{subscription_id}/free-access")
async def admin_grant_free_access(subscription_id: str, grant: bool, admin: dict = Depends(require_admin)):
    """Admin can grant or revoke free access for a business"""
    subscription = await db.subscriptions.find_one({"id": subscription_id})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    update_data = {
        "freeAccessOverride": grant,
        "freeAccessGrantedBy": admin["id"] if grant else None,
        "freeAccessGrantedAt": datetime.now(timezone.utc).isoformat() if grant else None
    }
    
    # If granting free access, also set status to active
    if grant:
        update_data["status"] = "active"
        update_data["lastPaymentStatus"] = "free_access"
    
    await db.subscriptions.update_one({"id": subscription_id}, {"$set": update_data})
    
    # Notify business owner
    business = await db.businesses.find_one({"id": subscription["businessId"]})
    if business:
        notification_doc = {
            "id": str(uuid.uuid4()),
            "userId": business["ownerId"],
            "type": "free_access_granted" if grant else "free_access_revoked",
            "title": "Free Access " + ("Granted" if grant else "Revoked"),
            "message": "Your business has been granted free access to Calendrax." if grant else "Your free access has been revoked. Please set up payment to continue using Calendrax.",
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
    
    return {"success": True, "freeAccess": grant}

@api_router.get("/admin/appointments")
async def admin_get_appointments(admin: dict = Depends(require_admin)):
    appointments = await db.appointments.find().sort("createdAt", -1).to_list(1000)
    return remove_mongo_id(appointments)

@api_router.put("/admin/appointments/{appointment_id}/refund")
async def admin_refund_appointment(appointment_id: str, amount: float, admin: dict = Depends(require_admin)):
    appointment = await db.appointments.find_one({"id": appointment_id})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {
            "paymentStatus": "refunded",
            "refundedAmount": amount,
            "refundedAt": datetime.now(timezone.utc).isoformat(),
            "refundedBy": admin["id"]
        }}
    )
    
    # Notify customer
    notification_doc = {
        "id": str(uuid.uuid4()),
        "userId": appointment["userId"],
        "type": "refund_issued",
        "title": "Refund Issued",
        "message": f"A refund of £{amount} has been issued for your booking at {appointment['businessName']}",
        "read": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    return {"success": True}

# ==================== TRIAL REMINDER SYSTEM ====================

async def check_and_send_trial_reminders():
    """
    Check for businesses with expiring trials and send reminders.
    Sends reminders at 7 days, 3 days, and 1 day before expiry.
    """
    from notifications import send_trial_reminder
    
    reminder_days = [7, 3, 1]  # Days before expiry to send reminders
    results = {"sent": 0, "errors": 0, "details": []}
    
    for days in reminder_days:
        # Calculate the target date
        target_date = datetime.now(timezone.utc) + timedelta(days=days)
        target_date_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        target_date_end = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Find subscriptions expiring on this date
        # Look for trials that haven't been reminded for this day count
        subscriptions = await db.subscriptions.find({
            "status": "trialing",
            "trialEndDate": {
                "$gte": target_date_start.isoformat(),
                "$lte": target_date_end.isoformat()
            }
        }).to_list(None)
        
        for subscription in subscriptions:
            # Check if we already sent a reminder for this day count
            reminders_sent = subscription.get("remindersSent", [])
            if days in reminders_sent:
                continue
            
            # Get business and owner
            business = await db.businesses.find_one({"id": subscription["businessId"]})
            if not business:
                continue
                
            owner = await db.users.find_one({"id": business["ownerId"]})
            if not owner:
                continue
            
            # Check owner's notification preferences
            email_enabled = owner.get("emailReminders", True)
            whatsapp_enabled = owner.get("whatsappReminders", True)
            
            if not email_enabled and not whatsapp_enabled:
                continue  # User has disabled all notifications
            
            try:
                # Send the reminder
                reminder_result = await send_trial_reminder(
                    owner_email=owner["email"] if email_enabled else None,
                    owner_phone=owner.get("mobile") if whatsapp_enabled else None,
                    owner_name=owner["fullName"],
                    business_name=business["businessName"],
                    days_remaining=days,
                    monthly_price=subscription.get("monthlyPrice", 10.00)
                )
                
                # Mark this reminder as sent
                await db.subscriptions.update_one(
                    {"id": subscription["id"]},
                    {"$push": {"remindersSent": days}}
                )
                
                results["sent"] += 1
                results["details"].append({
                    "business": business["businessName"],
                    "owner": owner["email"],
                    "days_remaining": days,
                    "result": reminder_result
                })
                
                logger.info(f"Trial reminder sent: {business['businessName']} ({days} days remaining)")
                
            except Exception as e:
                results["errors"] += 1
                logger.error(f"Failed to send trial reminder for {business['businessName']}: {str(e)}")
    
    return results

@api_router.post("/admin/send-trial-reminders")
async def trigger_trial_reminders(user: dict = Depends(require_admin)):
    """
    Manually trigger trial reminder check (admin only).
    This endpoint can also be called by a cron job.
    """
    results = await check_and_send_trial_reminders()
    return {
        "success": True,
        "reminders_sent": results["sent"],
        "errors": results["errors"],
        "details": results["details"]
    }

@api_router.get("/admin/trial-status")
async def get_trial_status(user: dict = Depends(require_admin)):
    """
    Get overview of all trials and their status (admin only).
    """
    now = datetime.now(timezone.utc)
    
    # Get all trialing subscriptions
    trialing = await db.subscriptions.find({"status": "trialing"}).to_list(None)
    
    trial_info = []
    for sub in trialing:
        business = await db.businesses.find_one({"id": sub["businessId"]})
        owner = await db.users.find_one({"id": business["ownerId"]}) if business else None
        
        # Calculate days remaining
        trial_end = sub.get("trialEndDate")
        if trial_end:
            if isinstance(trial_end, str):
                trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
            else:
                trial_end_dt = trial_end
            days_remaining = (trial_end_dt - now).days
        else:
            days_remaining = None
        
        trial_info.append({
            "businessId": sub["businessId"],
            "businessName": business["businessName"] if business else "Unknown",
            "ownerEmail": owner["email"] if owner else "Unknown",
            "trialEndDate": sub.get("trialEndDate"),
            "daysRemaining": days_remaining,
            "remindersSent": sub.get("remindersSent", []),
            "hasPaymentMethod": sub.get("hasPaymentMethod", False)
        })
    
    # Sort by days remaining
    trial_info.sort(key=lambda x: x["daysRemaining"] if x["daysRemaining"] is not None else 999)
    
    return {
        "totalTrials": len(trial_info),
        "trials": trial_info
    }

# ==================== APP SETUP ====================

app.include_router(api_router)

@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.businesses.create_index("id", unique=True)
    await db.businesses.create_index("ownerId")
    await db.services.create_index("id", unique=True)
    await db.services.create_index("businessId")
    await db.appointments.create_index("id", unique=True)
    await db.subscriptions.create_index("id", unique=True)
    await db.subscriptions.create_index("businessId")
    await db.notifications.create_index("userId")
    await db.availability.create_index([("businessId", 1), ("date", 1)])
    
    # Create default admin if not exists
    admin = await db.users.find_one({"role": UserRole.PLATFORM_ADMIN})
    if not admin:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "email": "admin@booka.com",
            "password": hash_password("admin123"),  # Change this in production!
            "fullName": "Platform Admin",
            "mobile": "+44000000000",
            "role": UserRole.PLATFORM_ADMIN,
            "suspended": False,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
        logger.info("Default admin created: admin@booka.com / admin123")
    
    # Start background task for daily trial reminders
    import asyncio
    asyncio.create_task(daily_trial_reminder_task())
    asyncio.create_task(daily_credit_billing_task())

async def daily_trial_reminder_task():
    """Background task that runs trial reminder check once per day"""
    import asyncio
    while True:
        try:
            # Wait until next check (run at 9 AM UTC daily)
            now = datetime.now(timezone.utc)
            next_run = now.replace(hour=9, minute=0, second=0, microsecond=0)
            if now >= next_run:
                next_run += timedelta(days=1)
            
            wait_seconds = (next_run - now).total_seconds()
            logger.info(f"Trial reminder task: next run in {wait_seconds/3600:.1f} hours at {next_run.isoformat()}")
            
            await asyncio.sleep(wait_seconds)
            
            # Run the reminder check
            logger.info("Running scheduled trial reminder check...")
            results = await check_and_send_trial_reminders()
            logger.info(f"Trial reminder check complete: {results['sent']} sent, {results['errors']} errors")
            
        except asyncio.CancelledError:
            logger.info("Trial reminder task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in trial reminder task: {str(e)}")
            # Wait an hour before retrying on error
            await asyncio.sleep(3600)

async def daily_credit_billing_task():
    """Background task that processes credit-based billing for subscriptions.
    Runs daily at 6 AM UTC to check for subscriptions that need billing and have credits available.
    This serves as a backup to the Stripe webhook approach.
    """
    import asyncio
    while True:
        try:
            # Wait until next check (run at 6 AM UTC daily)
            now = datetime.now(timezone.utc)
            next_run = now.replace(hour=6, minute=0, second=0, microsecond=0)
            if now >= next_run:
                next_run += timedelta(days=1)
            
            wait_seconds = (next_run - now).total_seconds()
            logger.info(f"Credit billing task: next run in {wait_seconds/3600:.1f} hours at {next_run.isoformat()}")
            
            await asyncio.sleep(wait_seconds)
            
            # Run the credit billing check
            logger.info("Running scheduled credit billing check...")
            results = await process_credit_billing()
            logger.info(f"Credit billing check complete: {results['processed']} processed, {results['credits_used']} credits used")
            
        except asyncio.CancelledError:
            logger.info("Credit billing task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in credit billing task: {str(e)}")
            # Wait an hour before retrying on error
            await asyncio.sleep(3600)

async def process_credit_billing():
    """Process credit-based billing for all active subscriptions.
    This checks for subscriptions where:
    1. The business has referral credits > 0
    2. The subscription billing date is today or past due
    3. The subscription hasn't been credited this billing period
    """
    results = {"processed": 0, "credits_used": 0, "errors": 0}
    
    try:
        # Find all active subscriptions with businesses that have credits
        businesses_with_credits = await db.businesses.find(
            {"referralCredits": {"$gt": 0}}
        ).to_list(1000)
        
        for business in businesses_with_credits:
            try:
                subscription = await db.subscriptions.find_one({"businessId": business["id"]})
                if not subscription:
                    continue
                
                # Skip if subscription has free access - credits shouldn't be used
                if subscription.get("freeAccessOverride", False):
                    logger.info(f"Skipping credit billing for {business.get('businessName')} - has free access override")
                    continue
                
                # Skip if subscription is not active or is in trial
                if subscription.get("status") not in ["active", "past_due"]:
                    continue
                
                # Check if we need to process billing (based on last payment date)
                last_payment = subscription.get("lastPaymentDate")
                if last_payment:
                    last_payment_date = datetime.fromisoformat(last_payment.replace('Z', '+00:00'))
                    days_since_payment = (datetime.now(timezone.utc) - last_payment_date).days
                    
                    # If less than 28 days since last payment, skip
                    if days_since_payment < 28:
                        continue
                
                # Check if already credited this month
                current_month = datetime.now(timezone.utc).strftime("%Y-%m")
                recent_credit = await db.billing_history.find_one({
                    "businessId": business["id"],
                    "type": "credit_used",
                    "date": {"$regex": f"^{current_month}"}
                })
                
                if recent_credit:
                    # Already processed this month
                    continue
                
                # Use a credit for this billing period
                credit_usage_doc = {
                    "id": str(uuid.uuid4()),
                    "businessId": business["id"],
                    "type": "credit_used",
                    "amount": subscription.get("priceMonthly", 0),
                    "creditsBefore": business.get("referralCredits", 0),
                    "creditsAfter": business.get("referralCredits", 0) - 1,
                    "date": datetime.now(timezone.utc).isoformat(),
                    "description": f"Monthly subscription paid via referral credit (automated)"
                }
                await db.billing_history.insert_one(credit_usage_doc)
                
                # Deduct the credit
                await db.businesses.update_one(
                    {"id": business["id"]},
                    {"$inc": {"referralCredits": -1}}
                )
                
                # Update subscription status
                await db.subscriptions.update_one(
                    {"id": subscription["id"]},
                    {"$set": {
                        "lastPaymentStatus": "credit_used",
                        "lastPaymentDate": datetime.now(timezone.utc).isoformat(),
                        "status": "active"
                    }}
                )
                
                # If the business has a Stripe subscription, pause it for this month
                if subscription.get("stripeSubscriptionId"):
                    try:
                        # Pause collection to prevent Stripe from charging
                        stripe.Subscription.modify(
                            subscription["stripeSubscriptionId"],
                            pause_collection={"behavior": "void"}
                        )
                        logger.info(f"Paused Stripe subscription for {business['businessName']} - using credit")
                    except Exception as stripe_err:
                        logger.warning(f"Could not pause Stripe subscription: {stripe_err}")
                
                logger.info(f"Auto-billed {business['businessName']} using referral credit. Credits remaining: {business.get('referralCredits', 0) - 1}")
                results["processed"] += 1
                results["credits_used"] += 1
                
            except Exception as business_err:
                logger.error(f"Error processing credit billing for business {business.get('id')}: {business_err}")
                results["errors"] += 1
                
    except Exception as e:
        logger.error(f"Error in process_credit_billing: {e}")
        results["errors"] += 1
    
    return results

# Admin endpoint to manually trigger credit billing
@api_router.post("/admin/process-credit-billing")
async def admin_process_credit_billing(admin: dict = Depends(require_admin)):
    """Manually trigger credit billing processing"""
    results = await process_credit_billing()
    return {
        "success": True,
        "results": results
    }

@api_router.post("/admin/resume-stripe-billing/{business_id}")
async def admin_resume_stripe_billing(business_id: str, admin: dict = Depends(require_admin)):
    """Resume Stripe billing for a business (when credits run out)"""
    business = await db.businesses.find_one({"id": business_id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    subscription = await db.subscriptions.find_one({"businessId": business_id})
    if not subscription or not subscription.get("stripeSubscriptionId"):
        raise HTTPException(status_code=404, detail="No Stripe subscription found")
    
    try:
        # Resume collection
        stripe.Subscription.modify(
            subscription["stripeSubscriptionId"],
            pause_collection=""  # Empty string resumes billing
        )
        return {"success": True, "message": f"Stripe billing resumed for {business['businessName']}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume billing: {str(e)}")

@app.on_event("shutdown")
async def shutdown():
    client.close()
