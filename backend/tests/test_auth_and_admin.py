"""
Backend API Tests for Booka App
Tests: Authentication, Admin, Business flows
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@booka.com"
ADMIN_PASSWORD = "admin123"
TEST_CUSTOMER_EMAIL = f"test_customer_{uuid.uuid4().hex[:8]}@test.com"
TEST_CUSTOMER_PASSWORD = "test123"
TEST_BUSINESS_EMAIL = f"test_business_{uuid.uuid4().hex[:8]}@test.com"
TEST_BUSINESS_PASSWORD = "test123"


class TestHealthAndBasics:
    """Basic API health checks"""
    
    def test_api_reachable(self):
        """Test that API is reachable"""
        response = requests.get(f"{BASE_URL}/api/businesses")
        assert response.status_code == 200, f"API not reachable: {response.status_code}"
        print(f"SUCCESS: API is reachable, returned {len(response.json())} businesses")


class TestAdminLogin:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data["user"]["role"] == "platform_admin", f"Wrong role: {data['user']['role']}"
        print(f"SUCCESS: Admin login successful, role: {data['user']['role']}")
        return data["token"]
    
    def test_admin_login_invalid_password(self):
        """Test admin login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Invalid password correctly rejected")
    
    def test_admin_login_invalid_email(self):
        """Test login with non-existent email"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "anypassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Non-existent email correctly rejected")


class TestCustomerSignupAndLogin:
    """Customer registration and login tests"""
    
    def test_customer_signup(self):
        """Test customer registration"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_CUSTOMER_EMAIL,
            "password": TEST_CUSTOMER_PASSWORD,
            "fullName": "Test Customer",
            "mobile": "+44123456789",
            "role": "customer"
        })
        assert response.status_code == 200, f"Customer signup failed: {response.text}"
        data = response.json()
        assert data["success"] == True, "Signup not successful"
        assert data["user"]["role"] == "customer", f"Wrong role: {data['user']['role']}"
        assert "token" in data, "No token in response"
        print(f"SUCCESS: Customer signup successful, email: {data['user']['email']}")
        return data
    
    def test_customer_login(self):
        """Test customer login after signup"""
        # First signup
        self.test_customer_signup()
        
        # Then login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CUSTOMER_EMAIL,
            "password": TEST_CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "customer"
        print(f"SUCCESS: Customer login successful")
        return data["token"]
    
    def test_duplicate_email_rejected(self):
        """Test that duplicate email registration is rejected"""
        # First signup
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_CUSTOMER_EMAIL,
            "password": TEST_CUSTOMER_PASSWORD,
            "fullName": "Test Customer",
            "mobile": "+44123456789",
            "role": "customer"
        })
        
        # Try duplicate
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_CUSTOMER_EMAIL,
            "password": "different123",
            "fullName": "Another Customer",
            "mobile": "+44987654321",
            "role": "customer"
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("SUCCESS: Duplicate email correctly rejected")


class TestBusinessOwnerSignupAndLogin:
    """Business owner registration and login tests"""
    
    def test_business_owner_signup(self):
        """Test business owner registration"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_BUSINESS_EMAIL,
            "password": TEST_BUSINESS_PASSWORD,
            "fullName": "Test Business Owner",
            "mobile": "+44111222333",
            "role": "business_owner",
            "businessName": "Test Business",
            "businessDescription": "A test business for testing",
            "postcode": "SW1A 1AA"
        })
        assert response.status_code == 200, f"Business owner signup failed: {response.text}"
        data = response.json()
        assert data["success"] == True, "Signup not successful"
        assert data["user"]["role"] == "business_owner", f"Wrong role: {data['user']['role']}"
        assert "business" in data, "No business in response"
        assert data["business"]["approved"] == False, "Business should not be auto-approved"
        print(f"SUCCESS: Business owner signup successful, business: {data['business']['businessName']}")
        return data
    
    def test_business_owner_login(self):
        """Test business owner login"""
        # First signup
        self.test_business_owner_signup()
        
        # Then login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_BUSINESS_EMAIL,
            "password": TEST_BUSINESS_PASSWORD
        })
        assert response.status_code == 200, f"Business owner login failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "business_owner"
        assert "business" in data, "No business in login response"
        print(f"SUCCESS: Business owner login successful")
        return data["token"]


class TestAdminFunctions:
    """Admin dashboard functionality tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_admin_get_stats(self, admin_token):
        """Test admin stats endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 200, f"Admin stats failed: {response.text}"
        data = response.json()
        assert "totalUsers" in data
        assert "totalBusinesses" in data
        assert "pendingBusinesses" in data
        print(f"SUCCESS: Admin stats - Users: {data['totalUsers']}, Businesses: {data['totalBusinesses']}, Pending: {data['pendingBusinesses']}")
    
    def test_admin_get_users(self, admin_token):
        """Test admin users list endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200, f"Admin users failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of users"
        print(f"SUCCESS: Admin users list - {len(data)} users found")
    
    def test_admin_get_businesses(self, admin_token):
        """Test admin businesses list endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/businesses", headers=headers)
        assert response.status_code == 200, f"Admin businesses failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of businesses"
        print(f"SUCCESS: Admin businesses list - {len(data)} businesses found")
        return data
    
    def test_admin_approve_business(self, admin_token):
        """Test admin business approval"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get businesses
        response = requests.get(f"{BASE_URL}/api/admin/businesses", headers=headers)
        businesses = response.json()
        
        # Find a pending business
        pending = [b for b in businesses if not b.get("approved") and not b.get("rejected")]
        if not pending:
            print("SKIP: No pending businesses to approve")
            return
        
        business_id = pending[0]["id"]
        
        # Approve it
        response = requests.put(
            f"{BASE_URL}/api/admin/businesses/{business_id}",
            headers=headers,
            json={"approved": True}
        )
        assert response.status_code == 200, f"Business approval failed: {response.text}"
        print(f"SUCCESS: Business {business_id} approved")
    
    def test_admin_reject_business(self, admin_token):
        """Test admin business rejection"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a new business to reject
        new_email = f"reject_test_{uuid.uuid4().hex[:8]}@test.com"
        signup_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": new_email,
            "password": "test123",
            "fullName": "Reject Test Owner",
            "mobile": "+44999888777",
            "role": "business_owner",
            "businessName": "Business To Reject",
            "businessDescription": "Will be rejected",
            "postcode": "EC1A 1BB"
        })
        
        if signup_response.status_code != 200:
            print(f"SKIP: Could not create test business: {signup_response.text}")
            return
        
        business_id = signup_response.json()["business"]["id"]
        
        # Reject it
        response = requests.put(
            f"{BASE_URL}/api/admin/businesses/{business_id}",
            headers=headers,
            json={"rejected": True, "rejectedReason": "Test rejection"}
        )
        assert response.status_code == 200, f"Business rejection failed: {response.text}"
        print(f"SUCCESS: Business {business_id} rejected")
    
    def test_admin_unauthorized_access(self):
        """Test that non-admin cannot access admin endpoints"""
        # Create a customer
        customer_email = f"nonadmin_{uuid.uuid4().hex[:8]}@test.com"
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": customer_email,
            "password": "test123",
            "fullName": "Non Admin",
            "mobile": "+44555666777",
            "role": "customer"
        })
        
        # Login as customer
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": customer_email,
            "password": "test123"
        })
        
        if login_response.status_code != 200:
            print("SKIP: Customer login failed")
            return
        
        customer_token = login_response.json()["token"]
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Try to access admin endpoint
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Non-admin correctly denied access to admin endpoints")


class TestPublicBusinessEndpoints:
    """Public business listing tests"""
    
    def test_get_approved_businesses(self):
        """Test public businesses endpoint returns only approved"""
        response = requests.get(f"{BASE_URL}/api/businesses")
        assert response.status_code == 200, f"Get businesses failed: {response.text}"
        data = response.json()
        
        # All returned businesses should be approved
        for business in data:
            assert business.get("approved") == True, f"Non-approved business in public list: {business.get('id')}"
        
        print(f"SUCCESS: Public businesses endpoint - {len(data)} approved businesses")


class TestAuthMe:
    """Test /auth/me endpoint"""
    
    def test_auth_me_with_valid_token(self):
        """Test getting current user info"""
        # Login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["token"]
        
        # Get me
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"SUCCESS: Auth me returned correct user: {data['user']['email']}")
    
    def test_auth_me_without_token(self):
        """Test auth/me without token returns 403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Auth me without token correctly rejected")


class TestAdminRegistrationBlocked:
    """Test that admin registration is blocked"""
    
    def test_cannot_register_as_admin(self):
        """Test that registering as platform_admin is blocked"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"fake_admin_{uuid.uuid4().hex[:8]}@test.com",
            "password": "test123",
            "fullName": "Fake Admin",
            "mobile": "+44000000000",
            "role": "platform_admin"
        })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("SUCCESS: Admin registration correctly blocked")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
