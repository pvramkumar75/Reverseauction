import requests
import sys
import json
from datetime import datetime

class ReverseAuctionAPITester:
    def __init__(self, base_url="https://price-battle-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.auction_id = None
        self.supplier_token = None
        self.bid_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.text else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        test_email = f"test_buyer_{datetime.now().strftime('%H%M%S')}@test.com"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "api/auth/register",
            200,
            data={
                "name": "Test Buyer",
                "email": test_email,
                "password": "TestPass123!"
            }
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   ✓ Token received: {self.token[:20]}...")
            return True
        return False

    def test_user_login(self):
        """Test user login with created user"""
        # First register a user for login test
        test_email = f"login_test_{datetime.now().strftime('%H%M%S')}@test.com"
        reg_success, _ = self.run_test(
            "Register User for Login Test",
            "POST", 
            "api/auth/register",
            200,
            data={
                "name": "Login Test User",
                "email": test_email,
                "password": "TestPass123!"
            }
        )
        
        if reg_success:
            success, response = self.run_test(
                "User Login",
                "POST",
                "api/auth/login", 
                200,
                data={
                    "email": test_email,
                    "password": "TestPass123!"
                }
            )
            return success and 'access_token' in response
        return False

    def test_get_user_profile(self):
        """Test getting current user profile"""
        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "api/auth/me",
            200
        )
        if success and 'id' in response:
            self.user_id = response['id']
            print(f"   ✓ User ID: {self.user_id}")
            return True
        return False

    def test_create_auction(self):
        """Test auction creation with full data"""
        auction_data = {
            "title": "Test Steel Procurement",
            "reference_number": f"TEST-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            "description": "Test auction for steel procurement",
            "payment_terms": "Net 30",
            "delivery_terms": "FOB",
            "freight_condition": "Prepaid",
            "items": [
                {
                    "item_code": "STEEL-001",
                    "description": "High grade steel bars",
                    "quantity": 100,
                    "unit": "PCS",
                    "estimated_price": 50.0
                }
            ],
            "suppliers": [
                {
                    "name": "Test Supplier 1",
                    "contact_person": "John Doe",
                    "email": "supplier1@test.com",
                    "phone": "+1234567890"
                }
            ],
            "config": {
                "start_price": 5000.0,
                "min_decrement": 100.0,
                "duration_minutes": 30
            }
        }
        
        success, response = self.run_test(
            "Create Auction",
            "POST",
            "api/auctions",
            200,
            data=auction_data
        )
        if success and 'id' in response:
            self.auction_id = response['id']
            # Get supplier token for later tests
            if response.get('suppliers') and len(response['suppliers']) > 0:
                self.supplier_token = response['suppliers'][0]['token']
            print(f"   ✓ Auction ID: {self.auction_id}")
            print(f"   ✓ Supplier Token: {self.supplier_token[:20] if self.supplier_token else 'None'}...")
            return True
        return False

    def test_get_auctions(self):
        """Test getting user's auctions"""
        success, response = self.run_test(
            "Get User Auctions",
            "GET",
            "api/auctions",
            200
        )
        return success and isinstance(response, list)

    def test_get_specific_auction(self):
        """Test getting specific auction by ID"""
        if not self.auction_id:
            print("❌ Skipped - No auction ID available")
            return False
            
        success, response = self.run_test(
            "Get Specific Auction",
            "GET",
            f"api/auctions/{self.auction_id}",
            200
        )
        return success and response.get('id') == self.auction_id

    def test_supplier_access(self):
        """Test supplier portal access with token"""
        if not self.supplier_token:
            print("❌ Skipped - No supplier token available")
            return False
            
        success, response = self.run_test(
            "Supplier Portal Access",
            "GET",
            f"api/supplier/{self.supplier_token}",
            200
        )
        return success and 'id' in response and 'supplier_info' in response

    def test_start_auction(self):
        """Test starting an auction"""
        if not self.auction_id:
            print("❌ Skipped - No auction ID available")
            return False
            
        success, response = self.run_test(
            "Start Auction",
            "POST",
            f"api/auctions/{self.auction_id}/start",
            200
        )
        return success and 'message' in response

    def test_submit_bid(self):
        """Test bid submission by supplier"""
        if not self.supplier_token or not self.auction_id:
            print("❌ Skipped - Missing auction ID or supplier token")
            return False
            
        bid_data = {
            "auction_id": self.auction_id,
            "supplier_token": self.supplier_token,
            "item_bids": [
                {
                    "item_code": "STEEL-001",
                    "unit_price": 45.0
                }
            ],
            "total_amount": 4500.0,
            "delivery_days": 15,
            "warranty_months": 12,
            "remarks": "High quality steel with fast delivery"
        }
        
        success, response = self.run_test(
            "Submit Bid",
            "POST",
            "api/bids",
            200,
            data=bid_data
        )
        if success and 'id' in response:
            self.bid_id = response['id']
            print(f"   ✓ Bid ID: {self.bid_id}")
            return True
        return False

    def test_get_auction_bids(self):
        """Test getting all bids for an auction (buyer view)"""
        if not self.auction_id:
            print("❌ Skipped - No auction ID available")
            return False
            
        success, response = self.run_test(
            "Get Auction Bids",
            "GET",
            f"api/auctions/{self.auction_id}/bids",
            200
        )
        return success and isinstance(response, list)

    def test_get_supplier_bid(self):
        """Test getting supplier's own bid"""
        if not self.supplier_token or not self.auction_id:
            print("❌ Skipped - Missing supplier token or auction ID")
            return False
            
        success, response = self.run_test(
            "Get Supplier Bid",
            "GET",
            f"api/supplier/{self.supplier_token}/bid?auction_id={self.auction_id}",
            200
        )
        return success

    def test_update_bid(self):
        """Test updating an existing bid"""
        if not self.supplier_token or not self.auction_id:
            print("❌ Skipped - Missing auction ID or supplier token")
            return False
            
        updated_bid_data = {
            "auction_id": self.auction_id,
            "supplier_token": self.supplier_token,
            "item_bids": [
                {
                    "item_code": "STEEL-001", 
                    "unit_price": 42.0
                }
            ],
            "total_amount": 4200.0,
            "delivery_days": 12,
            "warranty_months": 12,
            "remarks": "Updated bid with better price and delivery"
        }
        
        success, response = self.run_test(
            "Update Bid",
            "POST", 
            "api/bids",
            200,
            data=updated_bid_data
        )
        return success and 'id' in response

def main():
    print("🚀 Starting Reverse Auction Platform API Tests...")
    print("=" * 60)
    
    tester = ReverseAuctionAPITester()
    
    # Test sequence
    tests = [
        ("Authentication", [
            tester.test_user_registration,
            tester.test_get_user_profile,
            tester.test_user_login,
        ]),
        ("Auction Management", [
            tester.test_create_auction,
            tester.test_get_auctions,
            tester.test_get_specific_auction,
            tester.test_start_auction,
        ]),
        ("Supplier & Bidding", [
            tester.test_supplier_access,
            tester.test_submit_bid,
            tester.test_get_auction_bids,
            tester.test_get_supplier_bid,
            tester.test_update_bid,
        ])
    ]

    for category, test_functions in tests:
        print(f"\n📋 {category} Tests")
        print("-" * 40)
        
        for test_func in test_functions:
            try:
                success = test_func()
                if not success:
                    print(f"   ⚠️  Test failed but continuing...")
            except Exception as e:
                print(f"   💥 Test crashed: {str(e)}")

    # Print summary
    print(f"\n📊 Test Summary")
    print("=" * 60)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "0%")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())