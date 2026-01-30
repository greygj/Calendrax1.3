from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks, Request
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

# Import notification service
from notifications import (
    notify_booking_created, 
    notify_booking_approved, 
    notify_booking_declined, 
    notify_booking_cancelled,
    get_notification_status
)

# Import Stripe integration
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse, 
    CheckoutSessionRequest
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'booka-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')
import stripe
stripe.api_key = STRIPE_API_KEY

# Offer codes for testing (bypass payment)
VALID_OFFER_CODES = {
    "TESTFREE": {"type": "bypass", "description": "Testing - bypass payment"},
    "BOOKLE100": {"type": "bypass", "description": "100% discount for testing"},
    "STAFF2025": {"type": "bypass", "description": "Staff testing code"}
}

# Deposit level options (percentage of service price)
DEPOSIT_LEVELS = {
    "none": 0,
    "10": 10,
    "20": 20,  # Default
    "50": 50,
    "full": 100
}

# Subscription pricing (GBP)
SUBSCRIPTION_BASE_PRICE = 14.00  # 1 staff member
SUBSCRIPTION_ADDITIONAL_STAFF = 9.00  # Per additional staff
TRIAL_PERIOD_DAYS = 30

# Create the main app
app = FastAPI(title="Booka API")
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
    mobile: str
    role: str = UserRole.CUSTOMER

class UserCreate(UserBase):
    password: str
    businessName: Optional[str] = None
    businessDescription: Optional[str] = None
    postcode: Optional[str] = None
    logo: Optional[str] = None

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
    depositLevel: str = "20"  # Options: "none", "10", "20", "50", "full"

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
    trialStartDate: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    trialEndDate: Optional[datetime] = None
    subscriptionStartDate: Optional[datetime] = None
    lastPaymentDate: Optional[datetime] = None
    lastPaymentStatus: str = "pending"  # pending, success, failed
    nextPaymentDate: Optional[datetime] = None
    failedPayments: int = 0
    stripeCustomerId: Optional[str] = None
    stripeSubscriptionId: Optional[str] = None
    freeAccessOverride: bool = False  # Admin can grant free access
    freeAccessGrantedBy: Optional[str] = None
    freeAccessGrantedAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
        business_doc = {
            "id": business_id,
            "ownerId": user_id,
            "businessName": user_data.businessName or f"{user_data.fullName}'s Business",
            "description": user_data.businessDescription or "",
            "logo": user_data.logo,
            "postcode": user_data.postcode or "",
            "address": "",
            "approved": False,  # Requires admin approval
            "rejected": False,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.businesses.insert_one(business_doc)
        
        # Create subscription with 30-day trial
        trial_end = datetime.now(timezone.utc) + timedelta(days=TRIAL_PERIOD_DAYS)
        subscription_doc = {
            "id": str(uuid.uuid4()),
            "businessId": business_id,
            "ownerId": user_id,
            "staffCount": 1,
            "status": "trial",
            "priceMonthly": SUBSCRIPTION_BASE_PRICE,
            "trialStartDate": datetime.now(timezone.utc).isoformat(),
            "trialEndDate": trial_end.isoformat(),
            "lastPaymentStatus": "pending",
            "failedPayments": 0,
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
    if user["role"] == UserRole.BUSINESS_OWNER:
        business = await db.businesses.find_one({"ownerId": user["id"]})
        if business:
            subscription = await db.subscriptions.find_one({"businessId": business["id"]})
            if subscription:
                # Check if subscription is blocked (failed payment and not free access)
                if not subscription.get("freeAccessOverride", False):
                    if subscription.get("status") == "inactive" or subscription.get("lastPaymentStatus") == "failed":
                        # Check if trial has ended
                        trial_end = subscription.get("trialEndDate")
                        if trial_end:
                            trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00')) if isinstance(trial_end, str) else trial_end
                            if datetime.now(timezone.utc) > trial_end_dt:
                                subscription_blocked = True
                                subscription_message = "Your subscription payment has failed. Please update your payment method to continue using Bookle."
    
    if subscription_blocked:
        raise HTTPException(status_code=403, detail=subscription_message)
    
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
        "business": business
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
    return remove_mongo_id(business)

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
    
    service_doc = {
        "id": str(uuid.uuid4()),
        "businessId": business["id"],
        **service.model_dump(),
        "active": True,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.services.insert_one(service_doc)
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
    
    staff_doc = {
        "id": str(uuid.uuid4()),
        "businessId": business["id"],
        "name": staff_data.name,
        "serviceIds": staff_data.serviceIds,
        "active": True,
        "isOwner": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.staff.insert_one(staff_doc)
    return remove_mongo_id(staff_doc)

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
    """Delete a staff member (cannot delete owner)"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    staff = await db.staff.find_one({"id": staff_id, "businessId": business["id"]})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    if staff.get("isOwner"):
        raise HTTPException(status_code=400, detail="Cannot delete the business owner from staff")
    
    await db.staff.delete_one({"id": staff_id})
    return {"success": True}

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
    
    # Only allow updating certain fields (including depositLevel)
    allowed_fields = ["businessName", "description", "postcode", "address", "logo", "phone", "email", "website", "depositLevel"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
    
    # Validate depositLevel if provided
    if "depositLevel" in update_data:
        if update_data["depositLevel"] not in DEPOSIT_LEVELS:
            raise HTTPException(status_code=400, detail="Invalid deposit level. Must be: none, 10, 20, 50, or full")
    
    if update_data:
        await db.businesses.update_one({"id": business["id"]}, {"$set": update_data})
    
    updated_business = await db.businesses.find_one({"id": business["id"]})
    return remove_mongo_id(updated_business)

# ==================== STRIPE CONNECT ROUTES ====================

@api_router.post("/stripe-connect/create-account")
async def create_stripe_connect_account(request: Request, user: dict = Depends(require_business_owner)):
    """Create a Stripe Connect account for the business owner"""
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check if already has a connect account
    if business.get("stripeConnectAccountId"):
        # Return the existing account link for onboarding completion
        try:
            account_link = stripe.AccountLink.create(
                account=business["stripeConnectAccountId"],
                refresh_url=f"{request.headers.get('origin', '')}/dashboard?stripe_refresh=true",
                return_url=f"{request.headers.get('origin', '')}/dashboard?stripe_connected=true",
                type="account_onboarding",
            )
            return {"url": account_link.url, "accountId": business["stripeConnectAccountId"]}
        except Exception as e:
            logger.error(f"Error creating account link: {e}")
    
    try:
        # Create a new Express Connect account
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
        
        # Save the account ID to the business
        await db.businesses.update_one(
            {"id": business["id"]},
            {"$set": {"stripeConnectAccountId": account.id}}
        )
        
        # Create an account link for onboarding
        account_link = stripe.AccountLink.create(
            account=account.id,
            refresh_url=f"{request.headers.get('origin', '')}/dashboard?stripe_refresh=true",
            return_url=f"{request.headers.get('origin', '')}/dashboard?stripe_connected=true",
            type="account_onboarding",
        )
        
        return {"url": account_link.url, "accountId": account.id}
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

def calculate_subscription_price(staff_count: int) -> float:
    """Calculate monthly subscription price based on staff count"""
    if staff_count <= 1:
        return SUBSCRIPTION_BASE_PRICE
    return SUBSCRIPTION_BASE_PRICE + (SUBSCRIPTION_ADDITIONAL_STAFF * (staff_count - 1))

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
        "priceMonthly": calculate_subscription_price(staff_count),
        "trialEndDate": subscription.get("trialEndDate"),
        "trialDaysRemaining": trial_days_remaining,
        "lastPaymentStatus": subscription.get("lastPaymentStatus"),
        "nextPaymentDate": subscription.get("nextPaymentDate"),
        "freeAccessOverride": subscription.get("freeAccessOverride", False)
    }

@api_router.get("/subscription/pricing")
async def get_subscription_pricing():
    """Get subscription pricing information"""
    return {
        "basePrice": SUBSCRIPTION_BASE_PRICE,
        "additionalStaffPrice": SUBSCRIPTION_ADDITIONAL_STAFF,
        "trialDays": TRIAL_PERIOD_DAYS,
        "pricing": [
            {"staffCount": 1, "price": 14.00},
            {"staffCount": 2, "price": 23.00},
            {"staffCount": 3, "price": 32.00},
            {"staffCount": 4, "price": 41.00},
            {"staffCount": 5, "price": 50.00}
        ]
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
    origin_url = request.headers.get('origin', '')
    
    try:
        # Create or get Stripe customer
        if not subscription.get("stripeCustomerId"):
            customer = stripe.Customer.create(
                email=user["email"],
                name=user["fullName"],
                metadata={"business_id": business["id"]}
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
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "gbp",
                    "product_data": {
                        "name": f"Bookle Subscription ({staff_count} staff)",
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
            }
        )
        
        return {"url": checkout_session.url, "sessionId": checkout_session.id}
    except Exception as e:
        logger.error(f"Subscription setup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to setup subscription: {str(e)}")

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

# ==================== PAYMENT ROUTES ====================

class PaymentRequest(BaseModel):
    serviceId: str
    businessId: str
    staffId: Optional[str] = None
    date: str
    time: str
    originUrl: str
    offerCode: Optional[str] = None

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
    """Create a Stripe checkout session for booking deposit (20%)"""
    
    # Check for valid offer code (bypass payment)
    if data.offerCode:
        code = data.offerCode.upper().strip()
        if code in VALID_OFFER_CODES:
            # Create a pending booking transaction with bypass
            transaction_id = str(uuid.uuid4())
            transaction_doc = {
                "id": transaction_id,
                "userId": user["id"],
                "serviceId": data.serviceId,
                "businessId": data.businessId,
                "staffId": data.staffId,
                "date": data.date,
                "time": data.time,
                "amount": 0,
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
                "message": "Payment bypassed with offer code"
            }
    
    # Validate business and service
    business = await db.businesses.find_one({"id": data.businessId})
    if not business or not business.get("approved"):
        raise HTTPException(status_code=400, detail="Business not available")
    
    service = await db.services.find_one({"id": data.serviceId})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Calculate 20% deposit
    service_price = float(service["price"])
    deposit_amount = round(service_price * 0.20, 2)
    
    if deposit_amount < 0.50:
        deposit_amount = 0.50  # Stripe minimum is 50 cents/pence
    
    # Create transaction record first
    transaction_id = str(uuid.uuid4())
    
    # Build success and cancel URLs
    success_url = f"{data.originUrl}/booking-success?session_id={{CHECKOUT_SESSION_ID}}&transaction_id={transaction_id}"
    cancel_url = f"{data.originUrl}/business/{data.businessId}?cancelled=true"
    
    # Initialize Stripe checkout
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=deposit_amount,
        currency="gbp",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "transaction_id": transaction_id,
            "user_id": user["id"],
            "service_id": data.serviceId,
            "business_id": data.businessId,
            "staff_id": data.staffId or "",
            "date": data.date,
            "time": data.time,
            "service_name": service["name"],
            "business_name": business["businessName"],
            "full_price": str(service_price),
            "deposit_amount": str(deposit_amount)
        }
    )
    
    try:
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Save transaction record
        transaction_doc = {
            "id": transaction_id,
            "userId": user["id"],
            "userEmail": user["email"],
            "serviceId": data.serviceId,
            "businessId": data.businessId,
            "staffId": data.staffId,
            "date": data.date,
            "time": data.time,
            "amount": deposit_amount,
            "fullPrice": service_price,
            "currency": "gbp",
            "status": "pending",
            "paymentStatus": "initiated",
            "sessionId": session.session_id,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction_doc)
        
        return {
            "url": session.url,
            "sessionId": session.session_id,
            "transactionId": transaction_id,
            "depositAmount": deposit_amount,
            "fullPrice": service_price
        }
    except Exception as e:
        logger.error(f"Stripe checkout error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create payment session")

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
    
    # Initialize Stripe and check status
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        checkout_status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction status
        new_status = "completed" if checkout_status.payment_status == "paid" else checkout_status.status
        new_payment_status = checkout_status.payment_status
        
        await db.payment_transactions.update_one(
            {"sessionId": session_id},
            {"$set": {
                "status": new_status,
                "paymentStatus": new_payment_status,
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "status": new_status,
            "paymentStatus": new_payment_status,
            "transactionId": transaction["id"],
            "amount": checkout_status.amount_total / 100,  # Convert from pence
            "currency": checkout_status.currency
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
    
    # Get service and business details
    service = await db.services.find_one({"id": transaction["serviceId"]})
    business = await db.businesses.find_one({"id": transaction["businessId"]})
    
    if not service or not business:
        raise HTTPException(status_code=404, detail="Service or business not found")
    
    # Get staff member if specified
    staff_name = None
    if transaction.get("staffId"):
        staff = await db.staff.find_one({"id": transaction["staffId"], "businessId": business["id"]})
        if staff:
            staff_name = staff.get("name")
    
    # Get business owner details for notification
    business_owner = await db.users.find_one({"id": business["ownerId"]})
    
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
        "serviceId": service["id"],
        "serviceName": service["name"],
        "staffId": transaction.get("staffId"),
        "staffName": staff_name,
        "date": transaction["date"],
        "time": transaction["time"],
        "status": "pending",
        "paymentStatus": "deposit_paid" if not is_bypassed else "bypassed",
        "paymentAmount": float(service["price"]),
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
        "message": f"{user['fullName']} requested {service['name']} on {transaction['date']} at {transaction['time']}" + (f" with {staff_name}" if staff_name else "") + payment_note,
        "read": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    # Send email/SMS notification to business owner (in background)
    if business_owner:
        background_tasks.add_task(
            notify_booking_created,
            business_owner_email=business_owner["email"],
            business_owner_phone=business_owner.get("mobile"),
            business_name=business["businessName"],
            customer_name=user["fullName"],
            service_name=service["name"],
            date=transaction["date"],
            time=transaction["time"]
        )
    
    # Remove slot from availability
    avail_query = {"businessId": business["id"], "date": transaction["date"]}
    if transaction.get("staffId"):
        avail_query["staffId"] = transaction["staffId"]
    await db.availability.update_one(
        avail_query,
        {"$pull": {"slots": transaction["time"]}}
    )
    
    return {"success": True, "appointment": remove_mongo_id(appointment_doc)}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update transaction based on webhook event
        if webhook_response.session_id:
            await db.payment_transactions.update_one(
                {"sessionId": webhook_response.session_id},
                {"$set": {
                    "status": webhook_response.payment_status,
                    "paymentStatus": webhook_response.payment_status,
                    "webhookEventId": webhook_response.event_id,
                    "webhookEventType": webhook_response.event_type,
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
        background_tasks.add_task(
            notify_booking_created,
            business_owner_email=business_owner["email"],
            business_owner_phone=business_owner.get("mobile"),
            business_name=business["businessName"],
            customer_name=user["fullName"],
            service_name=service["name"],
            date=appointment_data["date"],
            time=appointment_data["time"]
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
    elif customer_email:
        # Check if customer exists by email
        existing = await db.users.find_one({"email": customer_email})
        if existing:
            customer_id = existing["id"]
            customer_name = existing["fullName"]
        else:
            # Create a new customer account (with a random password they can reset)
            import secrets
            customer_id = str(uuid.uuid4())
            new_customer = {
                "id": customer_id,
                "email": customer_email,
                "fullName": customer_name or "Guest Customer",
                "mobile": customer_phone or "",
                "password": hashlib.sha256(secrets.token_hex(16).encode()).hexdigest(),
                "role": "customer",
                "suspended": False,
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(new_customer)
    
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
        
        # Send email notification
        background_tasks.add_task(
            notify_booking_approved,
            customer_email=customer_email,
            customer_phone=customer_phone,
            customer_name=customer_name,
            business_name=business["businessName"],
            service_name=service["name"],
            date=appointment_data["date"],
            time=appointment_data["time"]
        )
    
    # Remove slot from availability
    avail_query = {"businessId": business["id"], "date": appointment_data["date"]}
    if staff_id:
        avail_query["staffId"] = staff_id
    await db.availability.update_one(
        avail_query,
        {"$pull": {"slots": appointment_data["time"]}}
    )
    
    return remove_mongo_id(appointment_doc)

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
    
    await db.appointments.update_one({"id": appointment_id}, {"$set": {"status": status}})
    
    # Get customer details for notification
    customer = await db.users.find_one({"id": appointment["userId"]})
    
    # Create in-app notification for customer
    notification_doc = {
        "id": str(uuid.uuid4()),
        "userId": appointment["userId"],
        "type": f"booking_{status}",
        "title": f"Booking {status.title()}",
        "message": f"Your booking for {appointment['serviceName']} has been {status}",
        "read": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    # Send email/SMS notification to customer (in background)
    if customer:
        if status == "confirmed":
            background_tasks.add_task(
                notify_booking_approved,
                customer_email=customer["email"],
                customer_phone=customer.get("mobile"),
                customer_name=customer["fullName"],
                business_name=appointment["businessName"],
                service_name=appointment["serviceName"],
                date=appointment["date"],
                time=appointment["time"]
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
                time=appointment["time"]
            )
    
    return {"success": True}

@api_router.put("/appointments/{appointment_id}/cancel")
async def cancel_appointment(appointment_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    appointment = await db.appointments.find_one({"id": appointment_id, "userId": user["id"]})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    await db.appointments.update_one({"id": appointment_id}, {"$set": {"status": "cancelled"}})
    
    # Get business and business owner for notification
    business = await db.businesses.find_one({"id": appointment["businessId"]})
    if business:
        business_owner = await db.users.find_one({"id": business["ownerId"]})
        
        # Create in-app notification for business owner
        notification_doc = {
            "id": str(uuid.uuid4()),
            "userId": business["ownerId"],
            "type": "booking_cancelled",
            "title": "Booking Cancelled",
            "message": f"{user['fullName']} cancelled their booking for {appointment['serviceName']} on {appointment['date']} at {appointment['time']}",
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
        
        # Send email/SMS notification to business owner (in background)
        if business_owner:
            background_tasks.add_task(
                notify_booking_cancelled,
                business_owner_email=business_owner["email"],
                business_owner_phone=business_owner.get("mobile"),
                business_name=business["businessName"],
                customer_name=user["fullName"],
                service_name=appointment["serviceName"],
                date=appointment["date"],
                time=appointment["time"]
            )
    
    return {"success": True}

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

# ==================== ADMIN ROUTES ====================

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
        await db.businesses.delete_many({"ownerId": user_id})
        await db.services.delete_many({"businessId": {"$in": [b["id"] for b in await db.businesses.find({"ownerId": user_id}).to_list(100)]}})
        await db.subscriptions.delete_many({"ownerId": user_id})
    
    await db.users.delete_one({"id": user_id})
    return {"success": True}

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

# ==================== APP SETUP ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.on_event("shutdown")
async def shutdown():
    client.close()
