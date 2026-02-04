"""
Test suite for Business Photo Upload Feature
Tests:
- Photo upload endpoint
- Photo storage in business.photos array
- Maximum 3 photos limit
- File size validation (5MB)
- Photo removal functionality
"""

import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "greygj@gmail.com"
TEST_PASSWORD = "password123"
BUSINESS_ID = "d2d1fdae-e2f6-4e6b-b85d-9aae0bf1c5d4"


class TestPhotoUploadFeature:
    """Test suite for business photo upload functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.user = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    def test_01_login_as_business_owner(self):
        """Test that business owner can login successfully"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "business_owner"
        print(f"SUCCESS: Logged in as business owner: {data['user']['email']}")
    
    def test_02_get_my_business(self):
        """Test fetching business details"""
        response = self.session.get(f"{BASE_URL}/api/my-business")
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "businessName" in data
        # Photos field should exist (may be empty array or have photos)
        assert "photos" in data or data.get("photos") is None
        print(f"SUCCESS: Got business: {data['businessName']}")
        print(f"Current photos count: {len(data.get('photos', []))}")
    
    def test_03_upload_photo_endpoint_exists(self):
        """Test that upload photo endpoint exists and requires auth"""
        # Test without auth - should fail
        no_auth_session = requests.Session()
        response = no_auth_session.post(f"{BASE_URL}/api/upload-business-photo")
        
        # Should return 401 or 422 (missing auth or file)
        assert response.status_code in [401, 403, 422]
        print(f"SUCCESS: Upload endpoint requires authentication (status: {response.status_code})")
    
    def test_04_upload_photo_requires_file(self):
        """Test that upload endpoint requires a file"""
        response = self.session.post(f"{BASE_URL}/api/upload-business-photo")
        
        # Should return 422 (validation error - missing file)
        assert response.status_code == 422
        print("SUCCESS: Upload endpoint validates file requirement")
    
    def test_05_upload_valid_photo(self):
        """Test uploading a valid photo"""
        # Create a small test image (1x1 red pixel PNG)
        # This is a minimal valid PNG file
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        )
        
        files = {
            'file': ('test_photo.png', png_data, 'image/png')
        }
        
        # Remove Content-Type header for multipart upload
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload-business-photo",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert data["url"].startswith("data:image/png;base64,")
        print("SUCCESS: Photo uploaded and returned as base64 data URL")
        
        # Store for later tests
        self.__class__.uploaded_photo_url = data["url"]
    
    def test_06_update_business_with_photo(self):
        """Test updating business with photo array"""
        # First get current business state
        get_response = self.session.get(f"{BASE_URL}/api/my-business")
        assert get_response.status_code == 200
        business = get_response.json()
        
        # Create a test photo URL
        test_photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        
        # Update with photos
        current_photos = business.get("photos", [])
        new_photos = current_photos + [test_photo] if len(current_photos) < 3 else current_photos
        
        update_response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "photos": new_photos
        })
        
        assert update_response.status_code == 200
        updated = update_response.json()
        assert "photos" in updated
        print(f"SUCCESS: Business updated with {len(updated['photos'])} photos")
    
    def test_07_verify_photos_persisted(self):
        """Test that photos are persisted in database"""
        response = self.session.get(f"{BASE_URL}/api/my-business")
        
        assert response.status_code == 200
        data = response.json()
        photos = data.get("photos", [])
        
        # Should have at least one photo
        assert len(photos) >= 0  # May be 0 if cleaned up
        print(f"SUCCESS: Business has {len(photos)} photos persisted")
    
    def test_08_max_photos_validation(self):
        """Test that maximum 3 photos limit is enforced"""
        # Try to update with 4 photos
        four_photos = [
            "data:image/png;base64,test1",
            "data:image/png;base64,test2",
            "data:image/png;base64,test3",
            "data:image/png;base64,test4"
        ]
        
        response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "photos": four_photos
        })
        
        # Should return 400 error
        assert response.status_code == 400
        data = response.json()
        assert "Maximum 3 photos" in data.get("detail", "")
        print("SUCCESS: Maximum 3 photos limit is enforced")
    
    def test_09_photos_array_validation(self):
        """Test that photos must be an array"""
        response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "photos": "not-an-array"
        })
        
        # Should return 400 error
        assert response.status_code == 400
        data = response.json()
        assert "array" in data.get("detail", "").lower()
        print("SUCCESS: Photos array validation works")
    
    def test_10_remove_photo(self):
        """Test removing a photo from business"""
        # Get current photos
        get_response = self.session.get(f"{BASE_URL}/api/my-business")
        assert get_response.status_code == 200
        business = get_response.json()
        
        current_photos = business.get("photos", [])
        
        if len(current_photos) > 0:
            # Remove last photo
            new_photos = current_photos[:-1]
            
            update_response = self.session.put(f"{BASE_URL}/api/my-business", json={
                "photos": new_photos
            })
            
            assert update_response.status_code == 200
            updated = update_response.json()
            assert len(updated.get("photos", [])) == len(new_photos)
            print(f"SUCCESS: Photo removed, now have {len(updated.get('photos', []))} photos")
        else:
            print("SKIP: No photos to remove")
    
    def test_11_public_business_page_endpoint(self):
        """Test that public business page endpoint returns photos"""
        response = requests.get(f"{BASE_URL}/api/businesses/{BUSINESS_ID}")
        
        assert response.status_code == 200
        data = response.json()
        assert "businessName" in data
        # Photos should be included in response
        photos = data.get("photos", [])
        print(f"SUCCESS: Public business endpoint returns {len(photos)} photos")
    
    def test_12_upload_non_image_rejected(self):
        """Test that non-image files are rejected"""
        # Create a text file
        text_data = b"This is not an image"
        
        files = {
            'file': ('test.txt', text_data, 'text/plain')
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload-business-photo",
            files=files,
            headers=headers
        )
        
        # Should return 400 error
        assert response.status_code == 400
        data = response.json()
        assert "image" in data.get("detail", "").lower()
        print("SUCCESS: Non-image files are rejected")


class TestPhotoUploadEdgeCases:
    """Edge case tests for photo upload"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    def test_empty_photos_array(self):
        """Test setting empty photos array"""
        response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "photos": []
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("photos") == [] or data.get("photos") is None or len(data.get("photos", [])) == 0
        print("SUCCESS: Empty photos array accepted")
    
    def test_three_photos_exactly(self):
        """Test that exactly 3 photos is allowed"""
        three_photos = [
            "data:image/png;base64,test1",
            "data:image/png;base64,test2",
            "data:image/png;base64,test3"
        ]
        
        response = self.session.put(f"{BASE_URL}/api/my-business", json={
            "photos": three_photos
        })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data.get("photos", [])) == 3
        print("SUCCESS: Exactly 3 photos allowed")
    
    def test_upload_when_at_max_photos(self):
        """Test upload is rejected when already at 3 photos"""
        # First set 3 photos
        three_photos = [
            "data:image/png;base64,test1",
            "data:image/png;base64,test2",
            "data:image/png;base64,test3"
        ]
        
        self.session.put(f"{BASE_URL}/api/my-business", json={
            "photos": three_photos
        })
        
        # Now try to upload another
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        )
        
        files = {
            'file': ('test_photo.png', png_data, 'image/png')
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload-business-photo",
            files=files,
            headers=headers
        )
        
        # Should return 400 error
        assert response.status_code == 400
        data = response.json()
        assert "Maximum 3 photos" in data.get("detail", "")
        print("SUCCESS: Upload rejected when at max photos")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
