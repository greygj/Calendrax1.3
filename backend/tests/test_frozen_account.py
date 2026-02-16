"""
Test Frozen Account Feature
Tests the backend login endpoint for frozen account detection when trial expires without payment method.
"""
import pytest
import requests
import os
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://frozen-account-test.preview.emergentagent.com').rstrip('/')


class TestFrozenAccountLogin:
    """Test frozen account detection in login endpoint"""
    
    def test_frozen_account_login_returns_frozen_status(self):
        """Test that login with expired trial user returns accountFrozen: true"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "frozen_test@test.com",
            "password": "Test123!"
        })
        
        # Should succeed with login but return frozen status
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Response data: {data}")
        
        # Verify the frozen account fields
        assert "accountFrozen" in data, "Missing accountFrozen field in response"
        assert data["accountFrozen"] == True, f"Expected accountFrozen=True, got {data.get('accountFrozen')}"
        
        # Verify frozen message is present
        assert "frozenMessage" in data, "Missing frozenMessage field"
        assert data["frozenMessage"] is not None, "frozenMessage should not be None"
        assert len(data["frozenMessage"]) > 0, "frozenMessage should not be empty"
        print(f"Frozen message: {data['frozenMessage']}")
        
        # Verify frozen details are present
        assert "frozenDetails" in data, "Missing frozenDetails field"
        assert data["frozenDetails"] is not None, "frozenDetails should not be None"
        
        # Verify reason is trial_expired_no_payment
        if data.get("frozenDetails"):
            assert data["frozenDetails"].get("reason") == "trial_expired_no_payment", \
                f"Expected reason='trial_expired_no_payment', got {data['frozenDetails'].get('reason')}"
            assert data["frozenDetails"].get("canReactivate") == True, "canReactivate should be True"
        
        # Verify token is still provided (user can login but with restricted view)
        assert "token" in data, "Token should still be provided for frozen accounts"
        assert data["token"] is not None, "Token should not be None"
        
        # Verify user data is returned
        assert "user" in data, "User data should be returned"
        assert data["user"]["email"] == "frozen_test@test.com"
        
        print("✓ Frozen account login test passed")

    def test_active_user_login_not_frozen(self):
        """Test that active user login does not return frozen status"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "greygj@gmail.com",
            "password": "Test123!"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Active user response: {data}")
        
        # Active user should not be frozen
        if "accountFrozen" in data:
            assert data["accountFrozen"] == False, f"Active user should not be frozen, got {data.get('accountFrozen')}"
        
        # Token should be provided
        assert "token" in data, "Token should be provided"
        assert data["token"] is not None
        
        # User data should be returned
        assert "user" in data, "User data should be returned"
        assert data["user"]["email"] == "greygj@gmail.com"
        
        print("✓ Active user login test passed")

    def test_invalid_credentials_rejected(self):
        """Test that invalid credentials are rejected"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "frozen_test@test.com",
            "password": "WrongPassword123"
        })
        
        assert response.status_code == 401, f"Expected 401 for wrong password, got {response.status_code}"
        print("✓ Invalid credentials rejected correctly")


class TestFrozenAccountAPIStructure:
    """Test the API response structure for frozen accounts"""
    
    def test_response_contains_all_required_fields(self):
        """Verify the login response contains all required fields for frozen account handling"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "frozen_test@test.com",
            "password": "Test123!"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check all required fields
        required_fields = ["success", "token", "user", "accountFrozen", "frozenMessage", "frozenDetails"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            print(f"✓ Field '{field}' present with value: {data[field] if field != 'token' else '***'}")
        
        # Verify user structure
        user_fields = ["id", "email", "fullName", "role"]
        for field in user_fields:
            assert field in data["user"], f"Missing user field: {field}"
        
        print("✓ All required fields present in response")


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test that the API is responding"""
        # Use centurions count endpoint as health check since /health doesn't exist
        response = requests.get(f"{BASE_URL}/api/centurions/count")
        assert response.status_code == 200
        print("✓ API health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
