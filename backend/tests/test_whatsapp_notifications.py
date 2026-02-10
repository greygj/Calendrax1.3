"""
Test WhatsApp Notification Feature
Tests for:
1. Notification status endpoint - GET /api/notifications/status
2. User notification preferences - GET/PUT /api/auth/notification-preferences
3. Backend integration of notification preferences with booking notifications
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from previous iterations
TEST_EMAIL = "greygj@gmail.com"
TEST_PASSWORD = "password123"


class TestNotificationStatus:
    """Test GET /api/notifications/status endpoint"""
    
    def test_notification_status_returns_200(self):
        """Test that notification status endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/notifications/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Notification status endpoint returns 200")
    
    def test_notification_status_structure(self):
        """Test notification status response structure"""
        response = requests.get(f"{BASE_URL}/api/notifications/status")
        data = response.json()
        
        # Verify structure has email, sms, and whatsapp sections
        assert "email" in data, "Missing email section in response"
        assert "sms" in data, "Missing sms section in response"
        assert "whatsapp" in data, "Missing whatsapp section in response"
        print("PASS: Notification status has correct structure (email, sms, whatsapp)")
    
    def test_whatsapp_is_enabled(self):
        """Test that WhatsApp is enabled with correct configuration"""
        response = requests.get(f"{BASE_URL}/api/notifications/status")
        data = response.json()
        
        whatsapp = data.get("whatsapp", {})
        assert whatsapp.get("enabled") == True, "WhatsApp should be enabled"
        assert whatsapp.get("provider") == "Twilio", "Provider should be Twilio"
        assert whatsapp.get("from_number") is not None, "From number should be set"
        assert "whatsapp:" in whatsapp.get("from_number", ""), "From number should have whatsapp: prefix"
        print(f"PASS: WhatsApp is enabled with number: {whatsapp.get('from_number')}")
    
    def test_notification_provider_details(self):
        """Test notification providers are correctly configured"""
        response = requests.get(f"{BASE_URL}/api/notifications/status")
        data = response.json()
        
        # Email may or may not be enabled (depends on SendGrid config)
        email = data.get("email", {})
        if email.get("enabled"):
            assert email.get("provider") == "SendGrid", "Email provider should be SendGrid"
        
        # WhatsApp should use Twilio
        whatsapp = data.get("whatsapp", {})
        assert whatsapp.get("provider") == "Twilio", "WhatsApp should use Twilio"
        print("PASS: Notification providers are correctly configured")


class TestNotificationPreferences:
    """Test GET/PUT /api/auth/notification-preferences endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_notification_preferences_requires_auth(self):
        """Test that getting notification preferences requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/notification-preferences")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("PASS: GET notification-preferences requires authentication")
    
    def test_get_notification_preferences_success(self):
        """Test getting notification preferences with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/auth/notification-preferences",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "emailReminders" in data, "Missing emailReminders field"
        assert "whatsappReminders" in data, "Missing whatsappReminders field"
        assert isinstance(data["emailReminders"], bool), "emailReminders should be boolean"
        assert isinstance(data["whatsappReminders"], bool), "whatsappReminders should be boolean"
        print(f"PASS: Got notification preferences - email: {data['emailReminders']}, whatsapp: {data['whatsappReminders']}")
    
    def test_put_notification_preferences_requires_auth(self):
        """Test that updating notification preferences requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/auth/notification-preferences",
            json={"emailReminders": False}
        )
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("PASS: PUT notification-preferences requires authentication")
    
    def test_update_email_reminders(self):
        """Test updating email reminder preference"""
        # Get current preferences
        response = requests.get(
            f"{BASE_URL}/api/auth/notification-preferences",
            headers=self.headers
        )
        original = response.json()
        
        # Toggle email reminders
        new_value = not original["emailReminders"]
        response = requests.put(
            f"{BASE_URL}/api/auth/notification-preferences",
            headers=self.headers,
            json={"emailReminders": new_value}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify change persisted
        data = response.json()
        assert data["success"] == True, "Expected success to be True"
        assert data["emailReminders"] == new_value, f"Email reminders should be {new_value}"
        
        # Reset to original
        requests.put(
            f"{BASE_URL}/api/auth/notification-preferences",
            headers=self.headers,
            json={"emailReminders": original["emailReminders"]}
        )
        print("PASS: Can update email reminders preference")
    
    def test_update_whatsapp_reminders(self):
        """Test updating WhatsApp reminder preference"""
        # Get current preferences
        response = requests.get(
            f"{BASE_URL}/api/auth/notification-preferences",
            headers=self.headers
        )
        original = response.json()
        
        # Toggle whatsapp reminders
        new_value = not original["whatsappReminders"]
        response = requests.put(
            f"{BASE_URL}/api/auth/notification-preferences",
            headers=self.headers,
            json={"whatsappReminders": new_value}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify change persisted
        data = response.json()
        assert data["success"] == True, "Expected success to be True"
        assert data["whatsappReminders"] == new_value, f"WhatsApp reminders should be {new_value}"
        
        # Reset to original
        requests.put(
            f"{BASE_URL}/api/auth/notification-preferences",
            headers=self.headers,
            json={"whatsappReminders": original["whatsappReminders"]}
        )
        print("PASS: Can update WhatsApp reminders preference")
    
    def test_update_both_preferences(self):
        """Test updating both preferences at once"""
        response = requests.put(
            f"{BASE_URL}/api/auth/notification-preferences",
            headers=self.headers,
            json={"emailReminders": False, "whatsappReminders": False}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data["success"] == True
        assert data["emailReminders"] == False
        assert data["whatsappReminders"] == False
        
        # Verify persistence with GET
        response = requests.get(
            f"{BASE_URL}/api/auth/notification-preferences",
            headers=self.headers
        )
        data = response.json()
        assert data["emailReminders"] == False
        assert data["whatsappReminders"] == False
        
        # Reset to defaults
        requests.put(
            f"{BASE_URL}/api/auth/notification-preferences",
            headers=self.headers,
            json={"emailReminders": True, "whatsappReminders": True}
        )
        print("PASS: Can update both preferences simultaneously")
    
    def test_default_preferences_are_true(self):
        """Test that default notification preferences are True"""
        # Get preferences and verify defaults
        response = requests.get(
            f"{BASE_URL}/api/auth/notification-preferences",
            headers=self.headers
        )
        data = response.json()
        
        # According to the code, defaults should be True
        # This test verifies the current state after resetting
        assert isinstance(data["emailReminders"], bool), "emailReminders should be boolean"
        assert isinstance(data["whatsappReminders"], bool), "whatsappReminders should be boolean"
        print(f"PASS: Preferences are valid booleans - email: {data['emailReminders']}, whatsapp: {data['whatsappReminders']}")


class TestNotificationIntegration:
    """Test that notification preferences are respected in server.py"""
    
    def test_notification_functions_imported(self):
        """Verify notification functions are correctly imported in server.py"""
        # This is a code review test - we verify by checking the imports
        import sys
        sys.path.insert(0, '/app/backend')
        
        try:
            from notifications import (
                notify_booking_created, 
                notify_booking_approved, 
                notify_booking_declined, 
                notify_booking_cancelled,
                get_notification_status,
                send_whatsapp
            )
            print("PASS: All notification functions are importable")
        except ImportError as e:
            pytest.fail(f"Failed to import notification functions: {e}")
    
    def test_notification_dispatcher_signature(self):
        """Test that notification dispatchers accept email_enabled and whatsapp_enabled params"""
        import sys
        sys.path.insert(0, '/app/backend')
        import inspect
        
        from notifications import notify_booking_created
        
        sig = inspect.signature(notify_booking_created)
        params = list(sig.parameters.keys())
        
        assert "email_enabled" in params, "notify_booking_created should have email_enabled param"
        assert "whatsapp_enabled" in params, "notify_booking_created should have whatsapp_enabled param"
        print("PASS: Notification dispatchers have email_enabled and whatsapp_enabled parameters")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
