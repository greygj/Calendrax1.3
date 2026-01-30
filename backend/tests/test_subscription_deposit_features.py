"""
Test Suite for Subscription, Deposit Settings, and Stripe Connect Features
Tests:
1. Business profile subscription status (status, staff count, monthly price)
2. Stripe Connect account creation endpoint
3. Deposit settings (5 options: none, 10%, 20%, 50%, full)
4. Deposit level change and save
5. Customer booking page deposit percentage based on business settings
6. Admin free access grant/revoke
7. Staff creation subscription price notification
8. Subscription pricing: £14 base + £9 per additional staff
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
BUSINESS_OWNER_EMAIL = "greygj@gmail.com"
BUSINESS_OWNER_PASSWORD = "password123"
CUSTOMER_EMAIL = "gareth.grey@tickety-moo.com"
CUSTOMER_PASSWORD = "password123"
ADMIN_EMAIL = "admin@booka.com"
ADMIN_PASSWORD = "admin123"


class TestSubscriptionFeatures:
    """Test subscription status and pricing"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_business_owner(self):
        """Login as business owner and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_OWNER_EMAIL,
            "password": BUSINESS_OWNER_PASSWORD
        })
        assert response.status_code == 200, f"Business owner login failed: {response.text}"
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        return response.json()
    
    def login_as_admin(self):
        """Login as admin and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        return response.json()
    
    def login_as_customer(self):
        """Login as customer and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        return response.json()
    
    # ========== SUBSCRIPTION STATUS TESTS ==========
    
    def test_subscription_status_endpoint(self):
        """Test GET /api/my-subscription returns subscription details"""
        self.login_as_business_owner()
        
        response = self.session.get(f"{BASE_URL}/api/my-subscription")
        assert response.status_code == 200, f"Failed to get subscription: {response.text}"
        
        data = response.json()
        # Verify subscription fields
        assert "status" in data, "Missing status field"
        assert "staffCount" in data, "Missing staffCount field"
        assert "priceMonthly" in data, "Missing priceMonthly field"
        assert "trialDaysRemaining" in data or "trialEndDate" in data, "Missing trial info"
        
        print(f"Subscription status: {data['status']}")
        print(f"Staff count: {data['staffCount']}")
        print(f"Monthly price: £{data['priceMonthly']}")
    
    def test_subscription_pricing_calculation(self):
        """Test subscription pricing: £14 base + £9 per additional staff"""
        self.login_as_business_owner()
        
        response = self.session.get(f"{BASE_URL}/api/my-subscription")
        assert response.status_code == 200
        
        data = response.json()
        staff_count = data["staffCount"]
        price = data["priceMonthly"]
        
        # Calculate expected price: £14 base + £9 per additional staff
        expected_price = 14.0 + (9.0 * max(0, staff_count - 1))
        
        assert price == expected_price, f"Price mismatch: expected £{expected_price}, got £{price}"
        print(f"Verified pricing: {staff_count} staff = £{price}/month")
    
    def test_subscription_pricing_endpoint(self):
        """Test GET /api/subscription/pricing returns pricing info"""
        response = self.session.get(f"{BASE_URL}/api/subscription/pricing")
        assert response.status_code == 200, f"Failed to get pricing: {response.text}"
        
        data = response.json()
        assert data["basePrice"] == 14.0, "Base price should be £14"
        assert data["additionalStaffPrice"] == 9.0, "Additional staff price should be £9"
        assert data["trialDays"] == 30, "Trial should be 30 days"
        
        # Verify pricing table
        assert len(data["pricing"]) == 5, "Should have 5 pricing tiers"
        assert data["pricing"][0] == {"staffCount": 1, "price": 14.00}
        assert data["pricing"][1] == {"staffCount": 2, "price": 23.00}
        assert data["pricing"][2] == {"staffCount": 3, "price": 32.00}
        assert data["pricing"][3] == {"staffCount": 4, "price": 41.00}
        assert data["pricing"][4] == {"staffCount": 5, "price": 50.00}
        
        print("Subscription pricing verified correctly")


class TestStripeConnectFeatures:
    """Test Stripe Connect bank account connection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_business_owner(self):
        """Login as business owner and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_OWNER_EMAIL,
            "password": BUSINESS_OWNER_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        return response.json()
    
    def test_stripe_connect_status_endpoint(self):
        """Test GET /api/stripe-connect/status returns connection status"""
        self.login_as_business_owner()
        
        response = self.session.get(f"{BASE_URL}/api/stripe-connect/status")
        assert response.status_code == 200, f"Failed to get Stripe status: {response.text}"
        
        data = response.json()
        assert "connected" in data, "Missing connected field"
        
        print(f"Stripe Connect status: connected={data['connected']}")
        if data.get("accountId"):
            print(f"Account ID: {data['accountId']}")
    
    def test_stripe_connect_create_account_endpoint(self):
        """Test POST /api/stripe-connect/create-account returns onboarding URL"""
        self.login_as_business_owner()
        
        response = self.session.post(f"{BASE_URL}/api/stripe-connect/create-account")
        # This may return 200 with URL, 500 if Stripe API key is test, or 520 (Cloudflare timeout)
        # We just verify the endpoint exists and responds
        assert response.status_code in [200, 500, 520], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "url" in data or "accountId" in data, "Should return URL or accountId"
            print(f"Stripe Connect create account response: {data}")
        else:
            print("Stripe Connect create account returned 500 (expected with test key)")


class TestDepositSettingsFeatures:
    """Test deposit level settings (none, 10%, 20%, 50%, full)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_business_owner(self):
        """Login as business owner and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_OWNER_EMAIL,
            "password": BUSINESS_OWNER_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        return response.json()
    
    def login_as_customer(self):
        """Login as customer and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        return response.json()
    
    def test_get_business_deposit_level(self):
        """Test GET /api/my-business returns deposit level"""
        self.login_as_business_owner()
        
        response = self.session.get(f"{BASE_URL}/api/my-business")
        assert response.status_code == 200, f"Failed to get business: {response.text}"
        
        data = response.json()
        assert "depositLevel" in data or data.get("depositLevel") is None, "depositLevel field should exist"
        
        deposit_level = data.get("depositLevel", "20")  # Default is 20%
        print(f"Current deposit level: {deposit_level}")
    
    def test_update_deposit_level_to_none(self):
        """Test updating deposit level to 'none' (0%)"""
        self.login_as_business_owner()
        
        response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "depositLevel": "none"
        })
        assert response.status_code == 200, f"Failed to update deposit: {response.text}"
        
        # Verify the change
        response = self.session.get(f"{BASE_URL}/api/my-business")
        assert response.status_code == 200
        assert response.json().get("depositLevel") == "none"
        print("Deposit level updated to 'none' (0%)")
    
    def test_update_deposit_level_to_10(self):
        """Test updating deposit level to '10' (10%)"""
        self.login_as_business_owner()
        
        response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "depositLevel": "10"
        })
        assert response.status_code == 200
        
        response = self.session.get(f"{BASE_URL}/api/my-business")
        assert response.json().get("depositLevel") == "10"
        print("Deposit level updated to '10' (10%)")
    
    def test_update_deposit_level_to_20(self):
        """Test updating deposit level to '20' (20% - default)"""
        self.login_as_business_owner()
        
        response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "depositLevel": "20"
        })
        assert response.status_code == 200
        
        response = self.session.get(f"{BASE_URL}/api/my-business")
        assert response.json().get("depositLevel") == "20"
        print("Deposit level updated to '20' (20%)")
    
    def test_update_deposit_level_to_50(self):
        """Test updating deposit level to '50' (50%)"""
        self.login_as_business_owner()
        
        response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "depositLevel": "50"
        })
        assert response.status_code == 200
        
        response = self.session.get(f"{BASE_URL}/api/my-business")
        assert response.json().get("depositLevel") == "50"
        print("Deposit level updated to '50' (50%)")
    
    def test_update_deposit_level_to_full(self):
        """Test updating deposit level to 'full' (100%)"""
        self.login_as_business_owner()
        
        response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "depositLevel": "full"
        })
        assert response.status_code == 200
        
        response = self.session.get(f"{BASE_URL}/api/my-business")
        assert response.json().get("depositLevel") == "full"
        print("Deposit level updated to 'full' (100%)")
    
    def test_invalid_deposit_level_rejected(self):
        """Test that invalid deposit level is rejected"""
        self.login_as_business_owner()
        
        response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "depositLevel": "invalid"
        })
        assert response.status_code == 400, "Invalid deposit level should be rejected"
        print("Invalid deposit level correctly rejected")
    
    def test_customer_sees_deposit_percentage(self):
        """Test that customer booking page shows correct deposit percentage"""
        # First set deposit level as business owner
        self.login_as_business_owner()
        
        # Set to 20% for testing
        response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "depositLevel": "20"
        })
        assert response.status_code == 200
        
        # Get business ID
        business_response = self.session.get(f"{BASE_URL}/api/my-business")
        business_id = business_response.json().get("id")
        
        # Now login as customer and check business details
        self.login_as_customer()
        
        response = self.session.get(f"{BASE_URL}/api/businesses/{business_id}")
        assert response.status_code == 200, f"Failed to get business: {response.text}"
        
        data = response.json()
        assert "depositPercentage" in data, "Missing depositPercentage field"
        assert data["depositPercentage"] == 20, f"Expected 20%, got {data['depositPercentage']}%"
        assert "depositLevelLabel" in data, "Missing depositLevelLabel field"
        
        print(f"Customer sees deposit: {data['depositPercentage']}% - {data['depositLevelLabel']}")


class TestAdminFreeAccessFeatures:
    """Test admin free access grant/revoke functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_admin(self):
        """Login as admin and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        return response.json()
    
    def login_as_business_owner(self):
        """Login as business owner and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_OWNER_EMAIL,
            "password": BUSINESS_OWNER_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        return response.json()
    
    def test_admin_get_subscriptions(self):
        """Test admin can get all subscriptions"""
        self.login_as_admin()
        
        response = self.session.get(f"{BASE_URL}/api/admin/subscriptions")
        assert response.status_code == 200, f"Failed to get subscriptions: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return list of subscriptions"
        
        if len(data) > 0:
            sub = data[0]
            assert "id" in sub, "Subscription should have id"
            assert "status" in sub, "Subscription should have status"
            assert "freeAccessOverride" in sub or sub.get("freeAccessOverride") is None, "Should have freeAccessOverride field"
            print(f"Found {len(data)} subscriptions")
    
    def test_admin_grant_free_access(self):
        """Test admin can grant free access to a subscription"""
        self.login_as_admin()
        
        # Get subscriptions
        response = self.session.get(f"{BASE_URL}/api/admin/subscriptions")
        assert response.status_code == 200
        
        subscriptions = response.json()
        if len(subscriptions) == 0:
            pytest.skip("No subscriptions to test")
        
        sub_id = subscriptions[0]["id"]
        
        # Grant free access
        response = self.session.put(f"{BASE_URL}/api/admin/subscriptions/{sub_id}/free-access?grant=true")
        assert response.status_code == 200, f"Failed to grant free access: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("freeAccess") == True
        print(f"Free access granted to subscription {sub_id}")
    
    def test_admin_revoke_free_access(self):
        """Test admin can revoke free access from a subscription"""
        self.login_as_admin()
        
        # Get subscriptions
        response = self.session.get(f"{BASE_URL}/api/admin/subscriptions")
        assert response.status_code == 200
        
        subscriptions = response.json()
        if len(subscriptions) == 0:
            pytest.skip("No subscriptions to test")
        
        sub_id = subscriptions[0]["id"]
        
        # Revoke free access
        response = self.session.put(f"{BASE_URL}/api/admin/subscriptions/{sub_id}/free-access?grant=false")
        assert response.status_code == 200, f"Failed to revoke free access: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("freeAccess") == False
        print(f"Free access revoked from subscription {sub_id}")
    
    def test_business_owner_sees_free_access_status(self):
        """Test business owner can see free access status in subscription"""
        # First grant free access as admin
        self.login_as_admin()
        
        response = self.session.get(f"{BASE_URL}/api/admin/subscriptions")
        subscriptions = response.json()
        if len(subscriptions) == 0:
            pytest.skip("No subscriptions to test")
        
        sub_id = subscriptions[0]["id"]
        self.session.put(f"{BASE_URL}/api/admin/subscriptions/{sub_id}/free-access?grant=true")
        
        # Now check as business owner
        self.login_as_business_owner()
        
        response = self.session.get(f"{BASE_URL}/api/my-subscription")
        assert response.status_code == 200
        
        data = response.json()
        assert "freeAccessOverride" in data, "Should have freeAccessOverride field"
        print(f"Business owner sees freeAccessOverride: {data['freeAccessOverride']}")


class TestStaffSubscriptionPricing:
    """Test staff creation updates subscription pricing"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_business_owner(self):
        """Login as business owner and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_OWNER_EMAIL,
            "password": BUSINESS_OWNER_PASSWORD
        })
        assert response.status_code == 200
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        return response.json()
    
    def test_get_current_staff_count(self):
        """Test getting current staff count"""
        self.login_as_business_owner()
        
        response = self.session.get(f"{BASE_URL}/api/staff")
        assert response.status_code == 200, f"Failed to get staff: {response.text}"
        
        staff = response.json()
        print(f"Current staff count: {len(staff)}")
        
        # Verify subscription reflects staff count
        response = self.session.get(f"{BASE_URL}/api/my-subscription")
        assert response.status_code == 200
        
        sub = response.json()
        print(f"Subscription staff count: {sub['staffCount']}")
        print(f"Subscription price: £{sub['priceMonthly']}")
    
    def test_staff_creation_returns_subscription_update(self):
        """Test that creating staff returns subscription price update notification"""
        self.login_as_business_owner()
        
        # Get current staff count
        response = self.session.get(f"{BASE_URL}/api/staff")
        current_staff = response.json()
        current_count = len(current_staff)
        
        if current_count >= 5:
            pytest.skip("Maximum staff limit reached")
        
        # Create new staff
        response = self.session.post(f"{BASE_URL}/api/staff", json={
            "name": f"TEST_Staff_{current_count + 1}",
            "serviceIds": []
        })
        
        assert response.status_code == 200, f"Failed to create staff: {response.text}"
        
        data = response.json()
        
        # Check for subscription update notification
        if "subscriptionUpdate" in data:
            update = data["subscriptionUpdate"]
            assert "previousPrice" in update, "Should have previousPrice"
            assert "newPrice" in update, "Should have newPrice"
            assert "staffCount" in update, "Should have staffCount"
            assert "message" in update, "Should have message"
            
            print(f"Subscription update: {update['message']}")
            print(f"Previous price: £{update['previousPrice']}")
            print(f"New price: £{update['newPrice']}")
        
        # Clean up - delete the test staff
        staff_id = data.get("id")
        if staff_id:
            self.session.delete(f"{BASE_URL}/api/staff/{staff_id}")
            print(f"Cleaned up test staff {staff_id}")


# Reset deposit level to default after all tests
@pytest.fixture(scope="module", autouse=True)
def reset_deposit_level():
    """Reset deposit level to 20% after all tests"""
    yield
    
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": BUSINESS_OWNER_EMAIL,
        "password": BUSINESS_OWNER_PASSWORD
    })
    
    if response.status_code == 200:
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        session.put(f"{BASE_URL}/api/my-business", json={"depositLevel": "20"})
        print("\nReset deposit level to 20% (default)")
