"""
Test Payouts and Analytics API endpoints
Tests the new Payout History and Advanced Analytics features for business owners
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
BUSINESS_OWNER_EMAIL = "greygj@gmail.com"
BUSINESS_OWNER_PASSWORD = "password123"


class TestPayoutsAndAnalytics:
    """Test Payouts and Analytics endpoints for business owners"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as business owner"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as business owner
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": BUSINESS_OWNER_EMAIL,
            "password": BUSINESS_OWNER_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Business owner login failed: {login_response.status_code}")
        
        login_data = login_response.json()
        self.token = login_data.get("token")
        self.user = login_data.get("user")
        self.business = login_data.get("business")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    # ==================== PAYOUTS ENDPOINT TESTS ====================
    
    def test_payouts_endpoint_returns_200(self):
        """Test that /api/payouts endpoint returns 200 for authenticated business owner"""
        response = self.session.get(f"{BASE_URL}/api/payouts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_payouts_response_structure(self):
        """Test that payouts response has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/payouts")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check top-level keys
        assert "payouts" in data, "Response should contain 'payouts' key"
        assert "summary" in data, "Response should contain 'summary' key"
        assert "stripeConnected" in data, "Response should contain 'stripeConnected' key"
        assert "payoutDestination" in data, "Response should contain 'payoutDestination' key"
    
    def test_payouts_summary_structure(self):
        """Test that payouts summary has all required fields"""
        response = self.session.get(f"{BASE_URL}/api/payouts")
        assert response.status_code == 200
        
        data = response.json()
        summary = data.get("summary", {})
        
        # Check summary fields
        required_fields = [
            "totalReceived",
            "totalRefunded",
            "netReceived",
            "currentMonth",
            "previousMonth",
            "yearToDate",
            "transactionCount"
        ]
        
        for field in required_fields:
            assert field in summary, f"Summary should contain '{field}' field"
            # All values should be numeric
            assert isinstance(summary[field], (int, float)), f"'{field}' should be numeric"
    
    def test_payouts_list_structure(self):
        """Test that payouts list items have correct structure"""
        response = self.session.get(f"{BASE_URL}/api/payouts")
        assert response.status_code == 200
        
        data = response.json()
        payouts = data.get("payouts", [])
        
        # If there are payouts, check their structure
        if len(payouts) > 0:
            payout = payouts[0]
            expected_fields = ["id", "date", "amount", "currency", "status"]
            for field in expected_fields:
                assert field in payout, f"Payout should contain '{field}' field"
    
    def test_payouts_requires_authentication(self):
        """Test that payouts endpoint requires authentication"""
        # Create a new session without auth
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.get(f"{BASE_URL}/api/payouts")
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated request, got {response.status_code}"
    
    # ==================== ANALYTICS ENDPOINT TESTS ====================
    
    def test_analytics_endpoint_returns_200(self):
        """Test that /api/analytics endpoint returns 200 for authenticated business owner"""
        response = self.session.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_analytics_response_structure(self):
        """Test that analytics response has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check top-level keys
        required_keys = [
            "popularServices",
            "peakHours",
            "busiestDays",
            "customerRetention",
            "bookingStatusBreakdown",
            "monthlyTrend",
            "averageMetrics"
        ]
        
        for key in required_keys:
            assert key in data, f"Response should contain '{key}' key"
    
    def test_analytics_popular_services_structure(self):
        """Test that popular services has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        popular_services = data.get("popularServices", [])
        
        # Should be a list
        assert isinstance(popular_services, list), "popularServices should be a list"
        
        # If there are services, check structure
        if len(popular_services) > 0:
            service = popular_services[0]
            assert "serviceId" in service, "Service should have 'serviceId'"
            assert "name" in service, "Service should have 'name'"
            assert "count" in service, "Service should have 'count'"
            assert "revenue" in service, "Service should have 'revenue'"
    
    def test_analytics_peak_hours_structure(self):
        """Test that peak hours has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        peak_hours = data.get("peakHours", [])
        
        # Should be a list
        assert isinstance(peak_hours, list), "peakHours should be a list"
        
        # If there are peak hours, check structure
        if len(peak_hours) > 0:
            hour = peak_hours[0]
            assert "hour" in hour, "Hour should have 'hour'"
            assert "count" in hour, "Hour should have 'count'"
            assert "label" in hour, "Hour should have 'label'"
    
    def test_analytics_busiest_days_structure(self):
        """Test that busiest days has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        busiest_days = data.get("busiestDays", [])
        
        # Should be a list
        assert isinstance(busiest_days, list), "busiestDays should be a list"
        
        # If there are days, check structure
        if len(busiest_days) > 0:
            day = busiest_days[0]
            assert "day" in day, "Day should have 'day'"
            assert "dayNum" in day, "Day should have 'dayNum'"
            assert "count" in day, "Day should have 'count'"
    
    def test_analytics_customer_retention_structure(self):
        """Test that customer retention has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        retention = data.get("customerRetention", {})
        
        # Check required fields
        required_fields = [
            "totalCustomers",
            "repeatCustomers",
            "newCustomers",
            "retentionRate"
        ]
        
        for field in required_fields:
            assert field in retention, f"customerRetention should contain '{field}'"
    
    def test_analytics_booking_status_breakdown_structure(self):
        """Test that booking status breakdown has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        breakdown = data.get("bookingStatusBreakdown", [])
        
        # Should be a list
        assert isinstance(breakdown, list), "bookingStatusBreakdown should be a list"
        
        # If there are statuses, check structure
        if len(breakdown) > 0:
            status = breakdown[0]
            assert "status" in status, "Status should have 'status'"
            assert "count" in status, "Status should have 'count'"
    
    def test_analytics_monthly_trend_structure(self):
        """Test that monthly trend has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        trend = data.get("monthlyTrend", [])
        
        # Should be a list with 6 months
        assert isinstance(trend, list), "monthlyTrend should be a list"
        assert len(trend) == 6, f"monthlyTrend should have 6 months, got {len(trend)}"
        
        # Check structure of each month
        for month in trend:
            assert "month" in month, "Month should have 'month'"
            assert "bookings" in month, "Month should have 'bookings'"
            assert "revenue" in month, "Month should have 'revenue'"
    
    def test_analytics_average_metrics_structure(self):
        """Test that average metrics has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        metrics = data.get("averageMetrics", {})
        
        # Check required fields
        required_fields = [
            "averageBookingValue",
            "conversionRate",
            "totalBookings",
            "confirmedBookings"
        ]
        
        for field in required_fields:
            assert field in metrics, f"averageMetrics should contain '{field}'"
    
    def test_analytics_requires_authentication(self):
        """Test that analytics endpoint requires authentication"""
        # Create a new session without auth
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.get(f"{BASE_URL}/api/analytics")
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated request, got {response.status_code}"
    
    # ==================== DATA VALIDATION TESTS ====================
    
    def test_analytics_data_consistency(self):
        """Test that analytics data is consistent"""
        response = self.session.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        retention = data.get("customerRetention", {})
        
        # Total customers should equal repeat + new
        total = retention.get("totalCustomers", 0)
        repeat = retention.get("repeatCustomers", 0)
        new = retention.get("newCustomers", 0)
        
        assert total == repeat + new, f"Total customers ({total}) should equal repeat ({repeat}) + new ({new})"
    
    def test_payouts_summary_consistency(self):
        """Test that payouts summary is consistent"""
        response = self.session.get(f"{BASE_URL}/api/payouts")
        assert response.status_code == 200
        
        data = response.json()
        summary = data.get("summary", {})
        
        # Net received should equal total received - total refunded
        total_received = summary.get("totalReceived", 0)
        total_refunded = summary.get("totalRefunded", 0)
        net_received = summary.get("netReceived", 0)
        
        expected_net = round(total_received - total_refunded, 2)
        assert abs(net_received - expected_net) < 0.01, f"Net received ({net_received}) should equal total ({total_received}) - refunded ({total_refunded})"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
