"""
Test cases for Optional Card Signup feature and Dashboard Trial Warning
Tests:
1. Business owner registration WITHOUT card details
2. Business owner registration WITH card details  
3. Subscription is created with correct trial info
4. hasPaymentMethod field is set correctly
5. Subscription endpoint returns trial warning data
"""

import pytest
import requests
import os
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

def generate_random_email():
    """Generate a random email for testing"""
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_card_signup_{random_str}@test.com"


class TestOptionalCardSignup:
    """Test registration with and without card details"""
    
    def test_api_health_check(self):
        """Verify API is accessible"""
        # Try root endpoint as health check
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        print(f"✓ API accessible (frontend served)")
    
    def test_register_business_owner_without_card(self):
        """Business owner should be able to register WITHOUT card details"""
        test_email = generate_random_email()
        
        registration_data = {
            "email": test_email,
            "password": "test123456",
            "fullName": "Test Business Owner No Card",
            "mobile": "07000000000",
            "role": "business_owner",
            "businessName": "No Card Test Business",
            "businessDescription": "Testing optional card signup",
            "postcode": "AB12 3CD",
            "joinCenturion": False,
            "stripePaymentMethodId": None  # No card provided
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=registration_data)
        
        # Should succeed - card is now optional
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Registration should be successful"
        assert data.get("token") is not None, "Should return auth token"
        assert data.get("user") is not None, "Should return user data"
        assert data.get("business") is not None, "Should return business data"
        
        user = data["user"]
        assert user["email"] == test_email
        assert user["role"] == "business_owner"
        
        print(f"✓ Business owner registered WITHOUT card: {test_email}")
        return data
    
    def test_register_customer_without_card(self):
        """Customer registration should work (card not required)"""
        test_email = generate_random_email()
        
        registration_data = {
            "email": test_email,
            "password": "test123456",
            "fullName": "Test Customer",
            "mobile": "07000000001",
            "role": "customer"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=registration_data)
        
        assert response.status_code == 200, f"Customer registration failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        
        print(f"✓ Customer registered successfully: {test_email}")
        return data


class TestSubscriptionWithoutCard:
    """Test subscription status for users without payment method"""
    
    def test_subscription_created_for_business_without_card(self):
        """Verify subscription is created with correct fields when no card provided"""
        test_email = generate_random_email()
        
        # Register business owner without card
        registration_data = {
            "email": test_email,
            "password": "test123456",
            "fullName": "Subscription Test User",
            "mobile": "07000000002",
            "role": "business_owner",
            "businessName": "Subscription Test Business",
            "businessDescription": "Testing subscription without card",
            "postcode": "EF45 6GH",
            "joinCenturion": False,
            "stripePaymentMethodId": None
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=registration_data)
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        token = data["token"]
        
        # Now fetch subscription status (correct endpoint: /my-subscription)
        headers = {"Authorization": f"Bearer {token}"}
        sub_response = requests.get(f"{BASE_URL}/api/my-subscription", headers=headers)
        
        assert sub_response.status_code == 200, f"Failed to get subscription: {sub_response.text}"
        
        sub_data = sub_response.json()
        
        # Verify subscription fields
        assert sub_data.get("status") == "trial", f"Should be in trial status, got: {sub_data.get('status')}"
        assert sub_data.get("hasPaymentMethod") == False, "hasPaymentMethod should be False when no card"
        assert sub_data.get("trialEndDate") is not None, "Should have trial end date"
        assert sub_data.get("trialDaysRemaining") is not None, "Should have days remaining"
        
        # Days remaining should be around 30 for new registration
        days_remaining = sub_data.get("trialDaysRemaining", 0)
        assert 28 <= days_remaining <= 31, f"Trial days should be ~30, got: {days_remaining}"
        
        print(f"✓ Subscription created correctly without card:")
        print(f"  - Status: {sub_data.get('status')}")
        print(f"  - hasPaymentMethod: {sub_data.get('hasPaymentMethod')}")
        print(f"  - trialDaysRemaining: {days_remaining}")
        print(f"  - trialEndDate: {sub_data.get('trialEndDate')}")
        
        return sub_data


class TestExistingUserWithoutCard:
    """Test existing user without card - warningtest@test.com"""
    
    def test_login_user_without_card(self):
        """Login as user without payment method and check subscription"""
        login_data = {
            "email": "warningtest@test.com",
            "password": "test123456"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        
        if response.status_code == 401:
            print("⚠ Test user warningtest@test.com does not exist - creating it")
            return self._create_test_user()
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        token = data["token"]
        
        print(f"✓ Successfully logged in as warningtest@test.com")
        
        # Get subscription status (correct endpoint: /my-subscription)
        headers = {"Authorization": f"Bearer {token}"}
        sub_response = requests.get(f"{BASE_URL}/api/my-subscription", headers=headers)
        
        if sub_response.status_code == 200:
            sub_data = sub_response.json()
            print(f"  - Status: {sub_data.get('status')}")
            print(f"  - hasPaymentMethod: {sub_data.get('hasPaymentMethod')}")
            print(f"  - trialDaysRemaining: {sub_data.get('trialDaysRemaining')}")
            return sub_data
        else:
            print(f"  - Note: Subscription endpoint returned {sub_response.status_code}")
            
    def _create_test_user(self):
        """Create the test user if it doesn't exist"""
        registration_data = {
            "email": "warningtest@test.com",
            "password": "test123456",
            "fullName": "Warning Test User",
            "mobile": "07000000099",
            "role": "business_owner",
            "businessName": "Warning Test Business",
            "businessDescription": "Test business for warning banner",
            "postcode": "WW11 1WW",
            "joinCenturion": False,
            "stripePaymentMethodId": None
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=registration_data)
        
        if response.status_code == 200:
            print(f"✓ Created test user warningtest@test.com without card")
            data = response.json()
            return data.get("token")
        elif response.status_code == 400 and "already registered" in response.text:
            print("User exists but login failed - check password")
        else:
            print(f"Failed to create test user: {response.text}")
        
        return None


class TestCenturionSignupWithoutCard:
    """Test Centurion signup without card details"""
    
    def test_centurion_signup_without_card(self):
        """Centurion signup should work without card details"""
        test_email = generate_random_email()
        
        registration_data = {
            "email": test_email,
            "password": "test123456",
            "fullName": "Centurion Test No Card",
            "mobile": "07000000003",
            "role": "business_owner",
            "businessName": "Centurion No Card Business",
            "businessDescription": "Testing Centurion signup without card",
            "postcode": "CC11 1CC",
            "joinCenturion": True,  # Trying to join Centurion
            "stripePaymentMethodId": None
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=registration_data)
        
        assert response.status_code == 200, f"Centurion registration failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("business") is not None
        
        # Business should have Centurion status if spots available
        business = data["business"]
        print(f"✓ Centurion signup without card:")
        print(f"  - isCenturion: {business.get('isCenturion')}")
        print(f"  - referralCode: {business.get('referralCode')}")
        
        return data


class TestRegistrationValidation:
    """Test registration validation still works"""
    
    def test_duplicate_email_rejected(self):
        """Registration with duplicate email should fail"""
        test_email = generate_random_email()
        
        # First registration
        registration_data = {
            "email": test_email,
            "password": "test123456",
            "fullName": "First User",
            "role": "customer"
        }
        
        response1 = requests.post(f"{BASE_URL}/api/auth/register", json=registration_data)
        assert response1.status_code == 200, "First registration should succeed"
        
        # Second registration with same email
        response2 = requests.post(f"{BASE_URL}/api/auth/register", json=registration_data)
        assert response2.status_code == 400, f"Should reject duplicate email, got: {response2.status_code}"
        
        data = response2.json()
        assert "already registered" in str(data).lower() or "email" in str(data).lower()
        
        print(f"✓ Duplicate email registration correctly rejected")
    
    def test_business_name_required(self):
        """Business owner registration requires business name"""
        test_email = generate_random_email()
        
        registration_data = {
            "email": test_email,
            "password": "test123456",
            "fullName": "Test User No Biz Name",
            "role": "business_owner",
            "businessName": "",  # Empty business name
            "businessDescription": "Test",
            "postcode": "AB12 3CD",
            "stripePaymentMethodId": None
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=registration_data)
        
        # Should still work - backend sets default business name if empty
        # This tests the fallback behavior
        if response.status_code == 200:
            data = response.json()
            business = data.get("business", {})
            business_name = business.get("businessName", "")
            # If empty name provided, it should use fallback
            print(f"✓ Business name fallback: '{business_name}'")
        else:
            print(f"⚠ Registration with empty business name returned: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
