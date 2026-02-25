import requests
import sys
import json
from datetime import datetime
import time

class FlowTaskAPITester:
    def __init__(self):
        self.base_url = "https://productivity-hub-268.preview.emergentagent.com/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_task_ids = []
        self.session_id = f"test_session_{int(time.time())}"
        self.session = requests.Session()  # Use session to maintain cookies
        self.auth_token = None
        self.test_user_id = None

    def log_test(self, name, passed, details=""):
        """Log test results"""
        self.tests_run += 1
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")
        if passed:
            self.tests_passed += 1

    def make_request(self, method, endpoint, data=None, expected_status=None, use_auth=True):
        """Make HTTP request and return response"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Add authorization header if we have a token and auth is requested
        if use_auth and self.auth_token:
            headers['Authorization'] = f'Bearer {self.auth_token}'
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            # Check expected status if provided
            if expected_status and response.status_code != expected_status:
                return False, f"Expected status {expected_status}, got {response.status_code}", response

            # Try to parse JSON response
            try:
                json_data = response.json()
                return True, json_data, response
            except:
                return True, response.text, response

        except requests.exceptions.Timeout:
            return False, "Request timed out", None
        except requests.exceptions.ConnectionError:
            return False, "Connection error", None
        except Exception as e:
            return False, f"Request failed: {str(e)}", None

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, data, response = self.make_request('GET', '/', expected_status=200, use_auth=False)
        
        if success and response.status_code == 200:
            self.log_test("Root endpoint", True, f"Response: {data}")
        else:
            self.log_test("Root endpoint", False, data)
        
        return success

    def test_register_user(self):
        """Test user registration"""
        timestamp = int(time.time())
        register_data = {
            "email": f"testuser{timestamp}@example.com",
            "password": "password123",
            "name": f"Test User {timestamp}"
        }
        
        success, data, response = self.make_request('POST', '/auth/register', data=register_data, expected_status=200, use_auth=False)
        
        if success and response.status_code == 200 and isinstance(data, dict) and 'user_id' in data:
            self.test_user_id = data['user_id']
            # Store cookies for session-based auth
            self.log_test("Register user", True, f"User ID: {data['user_id']}, Name: {data['name']}")
            return True, register_data
        else:
            self.log_test("Register user", False, data)
            return False, None

    def test_login_user(self, credentials):
        """Test user login"""
        login_data = {
            "email": credentials["email"],
            "password": credentials["password"]
        }
        
        success, data, response = self.make_request('POST', '/auth/login', data=login_data, expected_status=200, use_auth=False)
        
        if success and response.status_code == 200 and isinstance(data, dict) and 'user_id' in data:
            self.test_user_id = data['user_id']
            self.log_test("Login user", True, f"Logged in as: {data['name']}")
            return True
        else:
            self.log_test("Login user", False, data)
            return False

    def test_get_me(self):
        """Test getting current user info"""
        success, data, response = self.make_request('GET', '/auth/me', expected_status=200, use_auth=True)
        
        if success and response.status_code == 200 and isinstance(data, dict) and 'user_id' in data:
            self.log_test("Get current user (/auth/me)", True, f"User: {data['name']} ({data['email']})")
            return True
        else:
            self.log_test("Get current user (/auth/me)", False, data)
            return False

    def test_logout_user(self):
        """Test user logout"""
        success, data, response = self.make_request('POST', '/auth/logout', expected_status=200, use_auth=False)
        
        if success and response.status_code == 200:
            self.log_test("Logout user", True, "Successfully logged out")
            return True
        else:
            self.log_test("Logout user", False, data)
            return False

    def test_protected_route_without_auth(self):
        """Test that protected routes require authentication"""
        # Clear session cookies
        self.session.cookies.clear()
        success, data, response = self.make_request('GET', '/tasks', expected_status=401, use_auth=False)
        
        if success and response.status_code == 401:
            self.log_test("Protected route without auth (401)", True, "Correctly returned 401")
            return True
        else:
            self.log_test("Protected route without auth (401)", False, f"Expected 401, got {response.status_code if response else 'No response'}")
            return False

    def test_create_task(self):
        """Test task creation with time field"""
        task_data = {
            "text": f"Test task {datetime.now().strftime('%H:%M:%S')}",
            "priority": "high",
            "date": "2024-12-20",
            "time": "14:30"  # Test time field
        }
        
        success, data, response = self.make_request('POST', '/tasks', data=task_data, expected_status=201)
        
        if success and response.status_code == 201 and isinstance(data, dict) and 'id' in data:
            task_id = data['id']
            # Verify time field is preserved
            has_time = data.get('time') == '14:30'
            has_user_id = data.get('user_id') == self.test_user_id
            self.created_task_ids.append(task_id)
            
            details = f"Task ID: {task_id}, Time: {data.get('time')}, User-specific: {has_user_id}"
            self.log_test("Create task with time", True, details)
            return task_id
        else:
            self.log_test("Create task with time", False, data)
            return None

    def test_user_specific_tasks(self):
        """Test that tasks are user-specific"""
        success, data, response = self.make_request('GET', '/tasks', expected_status=200)
        
        if success and response.status_code == 200 and isinstance(data, list):
            # Verify all tasks belong to current user
            user_tasks = [task for task in data if task.get('user_id') == self.test_user_id]
            all_user_specific = len(user_tasks) == len(data)
            
            details = f"Found {len(data)} tasks, {len(user_tasks)} belong to current user, All user-specific: {all_user_specific}"
            self.log_test("User-specific tasks", True, details)
            return True
        else:
            self.log_test("User-specific tasks", False, data)
            return False

    def test_get_task_by_id(self, task_id):
        """Test getting a specific task"""
        success, data, response = self.make_request('GET', f'/tasks/{task_id}', expected_status=200)
        
        if success and response.status_code == 200 and isinstance(data, dict) and data.get('id') == task_id:
            self.log_test("Get task by ID", True, f"Task found: {data.get('text', 'No text')}")
            return True
        else:
            self.log_test("Get task by ID", False, data)
            return False

    def test_update_task(self, task_id):
        """Test updating a task"""
        update_data = {
            "text": f"Updated task {datetime.now().strftime('%H:%M:%S')}",
            "completed": True,
            "priority": "low"
        }
        
        success, data, response = self.make_request('PUT', f'/tasks/{task_id}', data=update_data, expected_status=200)
        
        if success and response.status_code == 200 and isinstance(data, dict) and data.get('completed') == True:
            self.log_test("Update task", True, f"Task updated successfully")
            return True
        else:
            self.log_test("Update task", False, data)
            return False

    def test_toggle_task_completion(self, task_id):
        """Test toggling task completion"""
        toggle_data = {"completed": False}
        
        success, data, response = self.make_request('PUT', f'/tasks/{task_id}', data=toggle_data, expected_status=200)
        
        if success and response.status_code == 200 and isinstance(data, dict):
            self.log_test("Toggle task completion", True, f"Completed: {data.get('completed')}")
            return True
        else:
            self.log_test("Toggle task completion", False, data)
            return False

    def test_filter_tasks_by_date(self):
        """Test filtering tasks by date"""
        success, data, response = self.make_request('GET', '/tasks?date=2024-12-20', expected_status=200)
        
        if success and response.status_code == 200 and isinstance(data, list):
            self.log_test("Filter tasks by date", True, f"Found {len(data)} tasks for 2024-12-20")
            return True
        else:
            self.log_test("Filter tasks by date", False, data)
            return False

    def test_filter_tasks_by_priority(self):
        """Test filtering tasks by priority"""
        success, data, response = self.make_request('GET', '/tasks?priority=high', expected_status=200)
        
        if success and response.status_code == 200 and isinstance(data, list):
            self.log_test("Filter tasks by priority", True, f"Found {len(data)} high priority tasks")
            return True
        else:
            self.log_test("Filter tasks by priority", False, data)
            return False

    def test_get_task_stats(self):
        """Test task statistics endpoint"""
        success, data, response = self.make_request('GET', '/tasks/stats/summary', expected_status=200)
        
        if success and response.status_code == 200 and isinstance(data, dict):
            required_keys = ['total', 'completed', 'pending', 'completion_rate']
            has_all_keys = all(key in data for key in required_keys)
            
            if has_all_keys:
                stats = f"Total: {data['total']}, Completed: {data['completed']}, Pending: {data['pending']}, Rate: {data['completion_rate']}%"
                self.log_test("Get task stats", True, stats)
                return True
            else:
                self.log_test("Get task stats", False, f"Missing keys in response: {data}")
                return False
        else:
            self.log_test("Get task stats", False, data)
            return False

    def test_ai_chat(self):
        """Test AI chat functionality"""
        chat_data = {
            "session_id": self.session_id,
            "message": "What tasks should I prioritize today?"
        }
        
        success, data, response = self.make_request('POST', '/chat', data=chat_data, expected_status=200)
        
        if success and response.status_code == 200 and isinstance(data, dict) and 'response' in data:
            response_text = data['response']
            self.log_test("AI Chat", True, f"Response length: {len(response_text)} chars")
            return True
        else:
            self.log_test("AI Chat", False, data)
            return False

    def test_delete_task(self, task_id):
        """Test task deletion"""
        success, data, response = self.make_request('DELETE', f'/tasks/{task_id}', expected_status=200)
        
        if success and response.status_code == 200:
            self.log_test("Delete task", True, f"Task {task_id} deleted")
            return True
        else:
            self.log_test("Delete task", False, data)
            return False

    def test_get_nonexistent_task(self):
        """Test getting a non-existent task"""
        fake_id = "nonexistent-task-id"
        success, data, response = self.make_request('GET', f'/tasks/{fake_id}', expected_status=404)
        
        if success and response.status_code == 404:
            self.log_test("Get non-existent task (404)", True, "Correctly returned 404")
            return True
        else:
            self.log_test("Get non-existent task (404)", False, f"Expected 404, got {response.status_code if response else 'No response'}")
            return False

    def cleanup_created_tasks(self):
        """Clean up tasks created during testing"""
        print(f"\n🧹 Cleaning up {len(self.created_task_ids)} created tasks...")
        cleaned = 0
        for task_id in self.created_task_ids:
            success, _, response = self.make_request('DELETE', f'/tasks/{task_id}', expected_status=200)
            if success and response.status_code == 200:
                cleaned += 1
        print(f"✅ Cleaned up {cleaned} tasks")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting FlowTask Pro API Tests (with Authentication)")
        print("=" * 60)
        
        # Test basic connectivity
        if not self.test_root_endpoint():
            print("❌ Root endpoint failed. Stopping tests.")
            return self.generate_summary()
        
        # Test authentication flow
        print("\n🔐 Testing Authentication:")
        auth_success, credentials = self.test_register_user()
        
        if auth_success:
            # Test /auth/me endpoint
            self.test_get_me()
            
            # Test logout
            self.test_logout_user()
            
            # Test protected route without auth
            self.test_protected_route_without_auth()
            
            # Log back in for remaining tests
            if self.test_login_user(credentials):
                # Verify authentication works
                self.test_get_me()
                
                # Test task CRUD operations with authentication
                print("\n📋 Testing Task CRUD Operations:")
                task_id = self.test_create_task()
                
                if task_id:
                    self.test_user_specific_tasks()
                    self.test_get_task_by_id(task_id)
                    self.test_update_task(task_id)
                    self.test_toggle_task_completion(task_id)
                    
                    # Test filtering
                    print("\n🔍 Testing Task Filtering:")
                    self.test_filter_tasks_by_date()
                    self.test_filter_tasks_by_priority()
                    
                    # Test stats
                    print("\n📊 Testing Statistics:")
                    self.test_get_task_stats()
                
                # Test AI functionality
                print("\n🤖 Testing AI Assistant:")
                self.test_ai_chat()
                
                # Test error handling
                print("\n❌ Testing Error Handling:")
                self.test_get_nonexistent_task()
        
        # Clean up
        self.cleanup_created_tasks()
        
        return self.generate_summary()

    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("🎉 Excellent! All major functionality is working.")
        elif success_rate >= 70:
            print("⚠️  Good, but some issues need attention.")
        else:
            print("❌ Multiple issues detected. Backend needs fixes.")
        
        return success_rate >= 70  # Return True if success rate is acceptable

def main():
    tester = FlowTaskAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)