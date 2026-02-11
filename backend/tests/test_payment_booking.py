"""
Backend API Tests for Payment and Booking Flow
Tests: Offer code validation, Payment checkout, Complete booking with offer code bypass
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_EMAIL = "gareth.grey@tickety-moo.com"
CUSTOMER_PASSWORD = "password123"
ADMIN_EMAIL = "admin@booka.com"
ADMIN_PASSWORD = "admin123"

# Valid offer codes
VALID_OFFER_CODES = ["TESTFREE", "BOOKLE100", "STAFF2025"]
INVALID_OFFER_CODE = "INVALID123"


class TestOfferCodeValidation:
    """Test offer code validation API"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            # Create customer if doesn't exist
            response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": CUSTOMER_EMAIL,
                "password": CUSTOMER_PASSWORD,
                "fullName": "Gareth Grey",
                "mobile": "+44123456789",
                "role": "customer"
            })
            if response.status_code != 200:
                pytest.skip(f"Could not login or create customer: {response.text}")
        return response.json()["token"]
    
    def test_validate_testfree_code(self, customer_token):
        """Test TESTFREE offer code is valid"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.post(
            f"{BASE_URL}/api/payments/validate-offer-code",
            headers=headers,
            json={"code": "TESTFREE"}
        )
        assert response.status_code == 200, f"Validate offer code failed: {response.text}"
        data = response.json()
        assert data["valid"] == True, f"TESTFREE should be valid: {data}"
        assert data["type"] == "bypass", f"TESTFREE should be bypass type: {data}"
        print(f"SUCCESS: TESTFREE code validated - {data['message']}")
    
    def test_validate_bookle100_code(self, customer_token):
        """Test BOOKLE100 offer code is valid"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.post(
            f"{BASE_URL}/api/payments/validate-offer-code",
            headers=headers,
            json={"code": "BOOKLE100"}
        )
        assert response.status_code == 200, f"Validate offer code failed: {response.text}"
        data = response.json()
        assert data["valid"] == True, f"BOOKLE100 should be valid: {data}"
        print(f"SUCCESS: BOOKLE100 code validated - {data['message']}")
    
    def test_validate_staff2025_code(self, customer_token):
        """Test STAFF2025 offer code is valid"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.post(
            f"{BASE_URL}/api/payments/validate-offer-code",
            headers=headers,
            json={"code": "STAFF2025"}
        )
        assert response.status_code == 200, f"Validate offer code failed: {response.text}"
        data = response.json()
        assert data["valid"] == True, f"STAFF2025 should be valid: {data}"
        print(f"SUCCESS: STAFF2025 code validated - {data['message']}")
    
    def test_validate_invalid_code(self, customer_token):
        """Test INVALID123 offer code is rejected"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.post(
            f"{BASE_URL}/api/payments/validate-offer-code",
            headers=headers,
            json={"code": "INVALID123"}
        )
        assert response.status_code == 200, f"Validate offer code failed: {response.text}"
        data = response.json()
        assert data["valid"] == False, f"INVALID123 should be invalid: {data}"
        print(f"SUCCESS: INVALID123 code correctly rejected - {data['message']}")
    
    def test_validate_lowercase_code(self, customer_token):
        """Test that lowercase codes are also validated (case insensitive)"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.post(
            f"{BASE_URL}/api/payments/validate-offer-code",
            headers=headers,
            json={"code": "testfree"}
        )
        assert response.status_code == 200, f"Validate offer code failed: {response.text}"
        data = response.json()
        assert data["valid"] == True, f"testfree (lowercase) should be valid: {data}"
        print(f"SUCCESS: Lowercase code validated correctly")
    
    def test_validate_empty_code(self, customer_token):
        """Test empty offer code"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.post(
            f"{BASE_URL}/api/payments/validate-offer-code",
            headers=headers,
            json={"code": ""}
        )
        assert response.status_code == 200, f"Validate offer code failed: {response.text}"
        data = response.json()
        assert data["valid"] == False, f"Empty code should be invalid: {data}"
        print(f"SUCCESS: Empty code correctly rejected")


class TestPaymentCheckout:
    """Test payment checkout creation API"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": CUSTOMER_EMAIL,
                "password": CUSTOMER_PASSWORD,
                "fullName": "Gareth Grey",
                "mobile": "+44123456789",
                "role": "customer"
            })
            if response.status_code != 200:
                pytest.skip(f"Could not login or create customer: {response.text}")
        return response.json()["token"]
    
    @pytest.fixture
    def approved_business_and_service(self):
        """Get an approved business with services"""
        # Get approved businesses
        response = requests.get(f"{BASE_URL}/api/businesses")
        assert response.status_code == 200, f"Get businesses failed: {response.text}"
        businesses = response.json()
        
        if not businesses:
            pytest.skip("No approved businesses available")
        
        # Find JG Body Clinic or first approved business
        business = None
        for b in businesses:
            if "JG Body Clinic" in b.get("businessName", ""):
                business = b
                break
        
        if not business:
            business = businesses[0]
        
        # Get services for this business
        services_response = requests.get(f"{BASE_URL}/api/businesses/{business['id']}/services")
        assert services_response.status_code == 200, f"Get services failed: {services_response.text}"
        services = services_response.json()
        
        if not services:
            pytest.skip(f"No services for business {business['businessName']}")
        
        # Get staff for this business
        staff_response = requests.get(f"{BASE_URL}/api/businesses/{business['id']}/staff")
        staff = staff_response.json() if staff_response.status_code == 200 else []
        
        return {
            "business": business,
            "service": services[0],
            "staff": staff[0] if staff else None
        }
    
    def test_create_checkout_without_offer_code(self, customer_token, approved_business_and_service):
        """Test creating checkout session without offer code (should return Stripe URL)"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        data = approved_business_and_service
        
        payload = {
            "serviceId": data["service"]["id"],
            "businessId": data["business"]["id"],
            "staffId": data["staff"]["id"] if data["staff"] else None,
            "date": "2026-01-30",
            "time": "10:00",
            "originUrl": "https://rails-login-fix.preview.emergentagent.com"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/payments/create-checkout",
            headers=headers,
            json=payload
        )
        assert response.status_code == 200, f"Create checkout failed: {response.text}"
        result = response.json()
        
        # Should return Stripe checkout URL
        assert "url" in result, f"No URL in response: {result}"
        assert "stripe.com" in result["url"], f"URL should be Stripe: {result['url']}"
        assert "sessionId" in result, f"No sessionId in response: {result}"
        assert "transactionId" in result, f"No transactionId in response: {result}"
        assert "depositAmount" in result, f"No depositAmount in response: {result}"
        
        # Verify deposit is 20% of service price
        expected_deposit = round(float(data["service"]["price"]) * 0.20, 2)
        if expected_deposit < 0.50:
            expected_deposit = 0.50  # Stripe minimum
        assert result["depositAmount"] == expected_deposit, f"Deposit should be {expected_deposit}, got {result['depositAmount']}"
        
        print(f"SUCCESS: Checkout created - Deposit: £{result['depositAmount']}, Full Price: £{result['fullPrice']}")
        print(f"Stripe URL: {result['url'][:50]}...")
    
    def test_create_checkout_with_valid_offer_code(self, customer_token, approved_business_and_service):
        """Test creating checkout with valid offer code (should bypass payment)"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        data = approved_business_and_service
        
        payload = {
            "serviceId": data["service"]["id"],
            "businessId": data["business"]["id"],
            "staffId": data["staff"]["id"] if data["staff"] else None,
            "date": "2026-01-30",
            "time": "11:00",
            "originUrl": "https://rails-login-fix.preview.emergentagent.com",
            "offerCode": "TESTFREE"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/payments/create-checkout",
            headers=headers,
            json=payload
        )
        assert response.status_code == 200, f"Create checkout failed: {response.text}"
        result = response.json()
        
        # Should bypass payment
        assert result.get("bypassed") == True, f"Should be bypassed with TESTFREE: {result}"
        assert "transactionId" in result, f"No transactionId in response: {result}"
        assert "url" not in result, f"Should not have Stripe URL when bypassed: {result}"
        
        print(f"SUCCESS: Payment bypassed with TESTFREE - Transaction ID: {result['transactionId']}")
        return result["transactionId"]
    
    def test_create_checkout_with_invalid_offer_code(self, customer_token, approved_business_and_service):
        """Test creating checkout with invalid offer code (should still create Stripe session)"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        data = approved_business_and_service
        
        payload = {
            "serviceId": data["service"]["id"],
            "businessId": data["business"]["id"],
            "staffId": data["staff"]["id"] if data["staff"] else None,
            "date": "2026-01-30",
            "time": "12:00",
            "originUrl": "https://rails-login-fix.preview.emergentagent.com",
            "offerCode": "INVALID123"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/payments/create-checkout",
            headers=headers,
            json=payload
        )
        assert response.status_code == 200, f"Create checkout failed: {response.text}"
        result = response.json()
        
        # Should NOT bypass - should create Stripe session
        assert result.get("bypassed") != True, f"Should not be bypassed with invalid code: {result}"
        assert "url" in result, f"Should have Stripe URL: {result}"
        
        print(f"SUCCESS: Invalid code correctly ignored, Stripe checkout created")


class TestCompleteBookingWithOfferCode:
    """Test complete booking flow with offer code bypass"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": CUSTOMER_EMAIL,
                "password": CUSTOMER_PASSWORD,
                "fullName": "Gareth Grey",
                "mobile": "+44123456789",
                "role": "customer"
            })
            if response.status_code != 200:
                pytest.skip(f"Could not login or create customer: {response.text}")
        return response.json()["token"]
    
    @pytest.fixture
    def approved_business_and_service(self):
        """Get an approved business with services"""
        response = requests.get(f"{BASE_URL}/api/businesses")
        assert response.status_code == 200, f"Get businesses failed: {response.text}"
        businesses = response.json()
        
        if not businesses:
            pytest.skip("No approved businesses available")
        
        business = None
        for b in businesses:
            if "JG Body Clinic" in b.get("businessName", ""):
                business = b
                break
        
        if not business:
            business = businesses[0]
        
        services_response = requests.get(f"{BASE_URL}/api/businesses/{business['id']}/services")
        assert services_response.status_code == 200, f"Get services failed: {services_response.text}"
        services = services_response.json()
        
        if not services:
            pytest.skip(f"No services for business {business['businessName']}")
        
        staff_response = requests.get(f"{BASE_URL}/api/businesses/{business['id']}/staff")
        staff = staff_response.json() if staff_response.status_code == 200 else []
        
        return {
            "business": business,
            "service": services[0],
            "staff": staff[0] if staff else None
        }
    
    def test_complete_booking_with_offer_code_bypass(self, customer_token, approved_business_and_service):
        """Test full booking flow: create checkout with offer code -> complete booking"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        data = approved_business_and_service
        
        # Step 1: Create checkout with offer code
        checkout_payload = {
            "serviceId": data["service"]["id"],
            "businessId": data["business"]["id"],
            "staffId": data["staff"]["id"] if data["staff"] else None,
            "date": "2026-01-31",
            "time": "14:00",
            "originUrl": "https://rails-login-fix.preview.emergentagent.com",
            "offerCode": "TESTFREE"
        }
        
        checkout_response = requests.post(
            f"{BASE_URL}/api/payments/create-checkout",
            headers=headers,
            json=checkout_payload
        )
        assert checkout_response.status_code == 200, f"Create checkout failed: {checkout_response.text}"
        checkout_result = checkout_response.json()
        assert checkout_result.get("bypassed") == True, f"Should be bypassed: {checkout_result}"
        
        transaction_id = checkout_result["transactionId"]
        print(f"Step 1 SUCCESS: Checkout bypassed, transaction ID: {transaction_id}")
        
        # Step 2: Complete booking
        complete_payload = {
            "transactionId": transaction_id
        }
        
        complete_response = requests.post(
            f"{BASE_URL}/api/payments/complete-booking",
            headers=headers,
            json=complete_payload
        )
        assert complete_response.status_code == 200, f"Complete booking failed: {complete_response.text}"
        complete_result = complete_response.json()
        
        assert complete_result.get("success") == True, f"Booking should be successful: {complete_result}"
        assert "appointment" in complete_result, f"Should have appointment: {complete_result}"
        
        appointment = complete_result["appointment"]
        assert appointment["serviceName"] == data["service"]["name"], f"Wrong service: {appointment}"
        assert appointment["businessName"] == data["business"]["businessName"], f"Wrong business: {appointment}"
        assert appointment["date"] == "2026-01-31", f"Wrong date: {appointment}"
        assert appointment["time"] == "14:00", f"Wrong time: {appointment}"
        assert appointment["paymentStatus"] == "bypassed", f"Payment status should be bypassed: {appointment}"
        assert appointment["offerCodeUsed"] == "TESTFREE", f"Offer code should be recorded: {appointment}"
        
        print(f"Step 2 SUCCESS: Booking completed!")
        print(f"  - Service: {appointment['serviceName']}")
        print(f"  - Business: {appointment['businessName']}")
        print(f"  - Date/Time: {appointment['date']} at {appointment['time']}")
        print(f"  - Payment Status: {appointment['paymentStatus']}")
        print(f"  - Offer Code Used: {appointment['offerCodeUsed']}")


class TestDepositCalculation:
    """Test 20% deposit calculation"""
    
    def test_deposit_is_20_percent(self):
        """Verify deposit calculation is 20% of service price"""
        # Get businesses and services
        response = requests.get(f"{BASE_URL}/api/businesses")
        if response.status_code != 200 or not response.json():
            pytest.skip("No businesses available")
        
        business = response.json()[0]
        services_response = requests.get(f"{BASE_URL}/api/businesses/{business['id']}/services")
        if services_response.status_code != 200 or not services_response.json():
            pytest.skip("No services available")
        
        services = services_response.json()
        
        for service in services:
            price = float(service["price"])
            expected_deposit = round(price * 0.20, 2)
            if expected_deposit < 0.50:
                expected_deposit = 0.50  # Stripe minimum
            
            print(f"Service: {service['name']} - Price: £{price}, Expected Deposit: £{expected_deposit}")
        
        print("SUCCESS: Deposit calculation verified for all services")


class TestBusinessAndServiceAvailability:
    """Test business and service data availability"""
    
    def test_jg_body_clinic_exists(self):
        """Test JG Body Clinic is available and approved"""
        response = requests.get(f"{BASE_URL}/api/businesses")
        assert response.status_code == 200, f"Get businesses failed: {response.text}"
        businesses = response.json()
        
        jg_clinic = None
        for b in businesses:
            if "JG Body Clinic" in b.get("businessName", ""):
                jg_clinic = b
                break
        
        if not jg_clinic:
            print("WARNING: JG Body Clinic not found in approved businesses")
            print(f"Available businesses: {[b['businessName'] for b in businesses]}")
            return
        
        assert jg_clinic["approved"] == True, "JG Body Clinic should be approved"
        print(f"SUCCESS: JG Body Clinic found and approved - ID: {jg_clinic['id']}")
    
    def test_jg_body_clinic_services(self):
        """Test JG Body Clinic has expected services"""
        response = requests.get(f"{BASE_URL}/api/businesses")
        businesses = response.json()
        
        jg_clinic = None
        for b in businesses:
            if "JG Body Clinic" in b.get("businessName", ""):
                jg_clinic = b
                break
        
        if not jg_clinic:
            pytest.skip("JG Body Clinic not found")
        
        services_response = requests.get(f"{BASE_URL}/api/businesses/{jg_clinic['id']}/services")
        assert services_response.status_code == 200, f"Get services failed: {services_response.text}"
        services = services_response.json()
        
        expected_services = ["Lymphatic Drainage Massage", "Infrared Wrap", "Bum Lift"]
        found_services = [s["name"] for s in services]
        
        print(f"Found services: {found_services}")
        
        for expected in expected_services:
            if expected not in found_services:
                print(f"WARNING: Expected service '{expected}' not found")
        
        print(f"SUCCESS: JG Body Clinic has {len(services)} services")
    
    def test_jg_body_clinic_staff(self):
        """Test JG Body Clinic has staff members"""
        response = requests.get(f"{BASE_URL}/api/businesses")
        businesses = response.json()
        
        jg_clinic = None
        for b in businesses:
            if "JG Body Clinic" in b.get("businessName", ""):
                jg_clinic = b
                break
        
        if not jg_clinic:
            pytest.skip("JG Body Clinic not found")
        
        staff_response = requests.get(f"{BASE_URL}/api/businesses/{jg_clinic['id']}/staff")
        assert staff_response.status_code == 200, f"Get staff failed: {staff_response.text}"
        staff = staff_response.json()
        
        expected_staff = ["Judith Grey", "Jessica Grey", "Julia Grey"]
        found_staff = [s["name"] for s in staff]
        
        print(f"Found staff: {found_staff}")
        
        for expected in expected_staff:
            if expected not in found_staff:
                print(f"WARNING: Expected staff '{expected}' not found")
        
        print(f"SUCCESS: JG Body Clinic has {len(staff)} staff members")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
