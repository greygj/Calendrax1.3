from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import hashlib

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

class BusinessUpdate(BaseModel):
    businessName: Optional[str] = None
    description: Optional[str] = None
    postcode: Optional[str] = None
    address: Optional[str] = None
    approved: Optional[bool] = None
    rejected: Optional[bool] = None
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

class Subscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    businessId: str
    ownerId: str
    plan: str = "basic"  # basic, professional, enterprise
    status: str = "active"  # active, inactive, cancelled, past_due
    priceMonthly: float = 0
    startDate: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    endDate: Optional[datetime] = None
    lastPaymentDate: Optional[datetime] = None
    lastPaymentStatus: str = "pending"  # pending, success, failed
    failedPayments: int = 0
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
        
        # Create default subscription (inactive until approved)
        subscription_doc = {
            "id": str(uuid.uuid4()),
            "businessId": business_id,
            "ownerId": user_id,
            "plan": "basic",
            "status": "inactive",
            "priceMonthly": 0,
            "startDate": datetime.now(timezone.utc).isoformat(),
            "lastPaymentStatus": "pending",
            "failedPayments": 0,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.subscriptions.insert_one(subscription_doc)
        business = business_doc
    
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
        business = await db.businesses.find_one({"ownerId": user["id"]})
    
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "fullName": user["fullName"],
            "mobile": user["mobile"],
            "role": user["role"]
        },
        "business": business
    }

# ==================== BUSINESS ROUTES ====================

@api_router.get("/businesses")
async def get_businesses():
    # Only return approved businesses for public listing
    businesses = await db.businesses.find({"approved": True, "rejected": {"$ne": True}}).to_list(1000)
    return businesses

@api_router.get("/businesses/{business_id}")
async def get_business(business_id: str):
    business = await db.businesses.find_one({"id": business_id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business

@api_router.get("/businesses/{business_id}/services")
async def get_business_services(business_id: str):
    services = await db.services.find({"businessId": business_id, "active": True}).to_list(1000)
    return services

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
    return service_doc

@api_router.get("/my-services")
async def get_my_services(user: dict = Depends(require_business_owner)):
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        return []
    services = await db.services.find({"businessId": business["id"]}).to_list(1000)
    return services

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

# ==================== AVAILABILITY ROUTES ====================

@api_router.get("/availability/{business_id}/{date}")
async def get_availability(business_id: str, date: str):
    avail = await db.availability.find_one({"businessId": business_id, "date": date})
    return {"slots": avail["slots"] if avail else []}

@api_router.post("/availability")
async def set_availability(business_id: str, date: str, slots: List[str], user: dict = Depends(require_business_owner)):
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business or business["id"] != business_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.availability.update_one(
        {"businessId": business_id, "date": date},
        {"$set": {"slots": slots}},
        upsert=True
    )
    return {"success": True}

# ==================== APPOINTMENT ROUTES ====================

@api_router.post("/appointments")
async def create_appointment(appointment_data: dict, user: dict = Depends(get_current_user)):
    business = await db.businesses.find_one({"id": appointment_data["businessId"]})
    if not business or not business.get("approved"):
        raise HTTPException(status_code=400, detail="Business not available")
    
    service = await db.services.find_one({"id": appointment_data["serviceId"]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    appointment_doc = {
        "id": str(uuid.uuid4()),
        "userId": user["id"],
        "customerName": user["fullName"],
        "customerEmail": user["email"],
        "businessId": business["id"],
        "businessName": business["businessName"],
        "serviceId": service["id"],
        "serviceName": service["name"],
        "date": appointment_data["date"],
        "time": appointment_data["time"],
        "status": "pending",
        "paymentStatus": "pending",
        "paymentAmount": service["price"],
        "depositAmount": 0,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.appointments.insert_one(appointment_doc)
    
    # Create notification for business owner
    notification_doc = {
        "id": str(uuid.uuid4()),
        "userId": business["ownerId"],
        "type": "new_booking",
        "title": "New Booking Request",
        "message": f"{user['fullName']} requested {service['name']} on {appointment_data['date']} at {appointment_data['time']}",
        "read": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    # Remove slot from availability
    await db.availability.update_one(
        {"businessId": business["id"], "date": appointment_data["date"]},
        {"$pull": {"slots": appointment_data["time"]}}
    )
    
    return appointment_doc

@api_router.get("/my-appointments")
async def get_my_appointments(user: dict = Depends(get_current_user)):
    appointments = await db.appointments.find({"userId": user["id"]}).to_list(1000)
    return appointments

@api_router.get("/business-appointments")
async def get_business_appointments(user: dict = Depends(require_business_owner)):
    business = await db.businesses.find_one({"ownerId": user["id"]})
    if not business:
        return []
    appointments = await db.appointments.find({"businessId": business["id"]}).to_list(1000)
    return appointments

@api_router.put("/appointments/{appointment_id}/status")
async def update_appointment_status(appointment_id: str, status: str, user: dict = Depends(require_business_owner)):
    business = await db.businesses.find_one({"ownerId": user["id"]})
    appointment = await db.appointments.find_one({"id": appointment_id, "businessId": business["id"]})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    await db.appointments.update_one({"id": appointment_id}, {"$set": {"status": status}})
    
    # Notify customer
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
    
    return {"success": True}

@api_router.put("/appointments/{appointment_id}/cancel")
async def cancel_appointment(appointment_id: str, user: dict = Depends(get_current_user)):
    appointment = await db.appointments.find_one({"id": appointment_id, "userId": user["id"]})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    await db.appointments.update_one({"id": appointment_id}, {"$set": {"status": "cancelled"}})
    return {"success": True}

# ==================== NOTIFICATION ROUTES ====================

@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find({"userId": user["id"]}).sort("createdAt", -1).to_list(100)
    return notifications

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
    return users

@api_router.get("/admin/users/{user_id}")
async def admin_get_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id}, {"password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

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
    # Attach owner info
    for business in businesses:
        owner = await db.users.find_one({"id": business["ownerId"]}, {"password": 0})
        business["owner"] = owner
    return businesses

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
    # Attach business info
    for sub in subscriptions:
        business = await db.businesses.find_one({"id": sub["businessId"]})
        sub["business"] = business
    return subscriptions

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
    return appointments

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
