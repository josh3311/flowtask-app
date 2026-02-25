import requests
import sys
from datetime import datetime, timedelta
import json

class FlowTaskAPITester:
    def __init__(self, base_url="https://productivity-hub-268.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()
        self.task_ids = []

    def log_test(self, name, passed, details=""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        return passed

    def run_request(self, method, endpoint, expected_status=200, data=None, cookies=None):
        """Make HTTP request and validate response"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            headers['Authorization'] = f'Bearer {self.session_token}'
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers, cookies=cookies)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers, cookies=cookies)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers, cookies=cookies)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers, cookies=cookies)
            else:
                return False, {}, f"Unsupported method: {method}"

            success = response.status_code == expected_status
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {}
            
            if not success:
                return False, response_data, f"Expected {expected_status}, got {response.status_code}: {response.text[:200]}"
            
            return True, response_data, ""
            
        except Exception as e:
            return False, {}, f"Request failed: {str(e)}"

    def test_auth_registration(self):
        """Test user registration"""
        test_email = f"testuser{datetime.now().strftime('%H%M%S')}@example.com"
        data = {
            "email": test_email,
            "password": "password123",
            "name": "Test User"
        }
        
        success, response, error = self.run_request('POST', 'auth/register', 200, data)
        
        if success and 'user_id' in response:
            self.user_id = response['user_id']
            # Extract session token from cookies
            self.session_token = self.session.cookies.get('session_token')
            return self.log_test("Auth Registration", True)
        
        return self.log_test("Auth Registration", False, error)

    def test_auth_login(self):
        """Test user login with existing credentials"""
        data = {
            "email": "testuser@example.com", 
            "password": "password123"
        }
        
        success, response, error = self.run_request('POST', 'auth/login', 200, data)
        
        if success and 'user_id' in response:
            self.user_id = response['user_id']
            self.session_token = self.session.cookies.get('session_token')
            return self.log_test("Auth Login", True)
        
        return self.log_test("Auth Login", False, error)

    def test_get_current_user(self):
        """Test getting current user"""
        success, response, error = self.run_request('GET', 'auth/me', 200)
        
        if success and 'user_id' in response:
            return self.log_test("Get Current User", True)
        
        return self.log_test("Get Current User", False, error)

    def test_create_task(self):
        """Test creating a task"""
        today = datetime.now().strftime("%Y-%m-%d")
        data = {
            "text": "Test Task with Reminder",
            "priority": "high",
            "date": today,
            "time": "14:30",
            "reminder": "15min"
        }
        
        success, response, error = self.run_request('POST', 'tasks', 201, data)
        
        if success and 'id' in response:
            self.task_ids.append(response['id'])
            return self.log_test("Create Task", True)
        
        return self.log_test("Create Task", False, error)

    def test_get_tasks(self):
        """Test getting tasks"""
        success, response, error = self.run_request('GET', 'tasks', 200)
        
        if success and isinstance(response, list):
            return self.log_test("Get Tasks", True)
        
        return self.log_test("Get Tasks", False, error)

    def test_update_task(self):
        """Test updating a task"""
        if not self.task_ids:
            return self.log_test("Update Task", False, "No task to update")
        
        task_id = self.task_ids[0]
        data = {
            "text": "Updated Test Task",
            "completed": True
        }
        
        success, response, error = self.run_request('PUT', f'tasks/{task_id}', 200, data)
        
        if success and response.get('text') == "Updated Test Task":
            return self.log_test("Update Task", True)
        
        return self.log_test("Update Task", False, error)

    def test_task_stats(self):
        """Test getting task statistics"""
        success, response, error = self.run_request('GET', 'tasks/stats/summary', 200)
        
        if success and 'total' in response and 'completed' in response:
            return self.log_test("Task Stats", True)
        
        return self.log_test("Task Stats", False, error)

    def test_pending_reminders(self):
        """Test getting pending reminders endpoint"""
        success, response, error = self.run_request('GET', 'tasks/reminders/pending', 200)
        
        if success and 'reminders' in response:
            return self.log_test("Pending Reminders API", True)
        
        return self.log_test("Pending Reminders API", False, error)

    def test_reorder_tasks(self):
        """Test task reordering endpoint"""
        if len(self.task_ids) < 1:
            return self.log_test("Reorder Tasks", False, "Need at least 1 task")
        
        # Create another task first
        today = datetime.now().strftime("%Y-%m-%d")
        data = {
            "text": "Second Task for Reordering",
            "priority": "medium",
            "date": today
        }
        
        success, response, error = self.run_request('POST', 'tasks', 201, data)
        if success and 'id' in response:
            self.task_ids.append(response['id'])
        
        # Now test reordering
        reorder_data = [
            {"id": self.task_ids[0], "order": 1},
            {"id": self.task_ids[1] if len(self.task_ids) > 1 else self.task_ids[0], "order": 0}
        ]
        
        success, response, error = self.run_request('PUT', 'tasks/reorder', 200, reorder_data)
        
        if success and 'message' in response:
            return self.log_test("Reorder Tasks API", True)
        
        return self.log_test("Reorder Tasks API", False, error)

    def test_ai_chat(self):
        """Test AI chat functionality"""
        data = {
            "session_id": f"test_session_{datetime.now().strftime('%H%M%S')}",
            "message": "What tasks should I prioritize today?"
        }
        
        success, response, error = self.run_request('POST', 'chat', 200, data)
        
        if success and 'response' in response and response['response']:
            return self.log_test("AI Chat", True)
        
        return self.log_test("AI Chat", False, error)

    def test_auth_logout(self):
        """Test logout"""
        success, response, error = self.run_request('POST', 'auth/logout', 200)
        
        if success and 'message' in response:
            return self.log_test("Auth Logout", True)
        
        return self.log_test("Auth Logout", False, error)

    def cleanup_tasks(self):
        """Clean up test tasks"""
        for task_id in self.task_ids:
            try:
                self.run_request('DELETE', f'tasks/{task_id}', 200)
            except:
                pass

def main():
    print("🚀 Starting FlowTask Pro Backend API Tests")
    print("=" * 50)
    
    tester = FlowTaskAPITester()
    
    # Test authentication flow
    print("\n📋 Testing Authentication...")
    if not tester.test_auth_login():
        print("Login failed, trying registration...")
        if not tester.test_auth_registration():
            print("❌ Authentication completely failed!")
            return 1
    
    tester.test_get_current_user()
    
    # Test core task operations
    print("\n📋 Testing Task Operations...")
    tester.test_create_task()
    tester.test_get_tasks()
    tester.test_update_task()
    tester.test_task_stats()
    
    # Test new PWA features
    print("\n📋 Testing PWA Features...")
    tester.test_pending_reminders()
    tester.test_reorder_tasks()
    
    # Test AI features  
    print("\n📋 Testing AI Features...")
    tester.test_ai_chat()
    
    # Cleanup
    print("\n📋 Testing Cleanup...")
    tester.test_auth_logout()
    tester.cleanup_tasks()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Backend Tests Complete: {tester.tests_passed}/{tester.tests_run} passed")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("✅ Backend tests mostly successful!")
        return 0
    else:
        print("❌ Backend tests show significant issues!")
        return 1

if __name__ == "__main__":
    sys.exit(main())