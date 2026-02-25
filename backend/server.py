from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
import httpx
import bcrypt
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

# User Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str = "email"  # "email" or "google"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleSessionRequest(BaseModel):
    session_id: str

# Task Models
class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    text: str
    completed: bool = False
    priority: str = "medium"
    date: str
    time: Optional[str] = None  # Time field (HH:MM format)
    reminder: Optional[str] = None  # Reminder: "none", "15min", "30min", "1hour", "attime"
    reminder_sent: bool = False
    audio_base64: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    order: int = 0

class TaskCreate(BaseModel):
    text: str
    priority: str = "medium"
    date: str
    time: Optional[str] = None
    reminder: Optional[str] = None
    audio_base64: Optional[str] = None

class TaskUpdate(BaseModel):
    text: Optional[str] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    reminder: Optional[str] = None
    reminder_sent: Optional[bool] = None
    audio_base64: Optional[str] = None
    order: Optional[int] = None

# Chat Models
class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    role: str
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    session_id: str
    message: str

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def generate_session_token() -> str:
    return secrets.token_urlsafe(32)

async def get_current_user(request: Request) -> User:
    """Get current user from session token (cookie or header)"""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Convert datetime if needed
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(request: RegisterRequest, response: Response):
    """Register a new user with email/password"""
    # Check if user exists
    existing = await db.users.find_one({"email": request.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(request.password)
    
    user_doc = {
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "picture": None,
        "auth_provider": "email",
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = generate_session_token()
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    return {
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "picture": None,
        "auth_provider": "email"
    }

@api_router.post("/auth/login")
async def login(request: LoginRequest, response: Response):
    """Login with email/password"""
    # Find user
    user_doc = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if email auth
    if user_doc.get("auth_provider") != "email":
        raise HTTPException(status_code=400, detail="Please login with Google")
    
    # Verify password
    if not verify_password(request.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = generate_session_token()
    session_doc = {
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    return {
        "user_id": user_doc["user_id"],
        "email": user_doc["email"],
        "name": user_doc["name"],
        "picture": user_doc.get("picture"),
        "auth_provider": "email"
    }

@api_router.post("/auth/google/session")
async def google_session(request: GoogleSessionRequest, response: Response):
    """Exchange Google OAuth session_id for user session"""
    try:
        # Call Emergent Auth to get user data
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            auth_data = auth_response.json()
    except Exception as e:
        logging.error(f"Google auth error: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")
    
    email = auth_data.get("email")
    name = auth_data.get("name")
    picture = auth_data.get("picture")
    
    # Check if user exists
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing:
        user_id = existing["user_id"]
        # Update user info
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    # Create session
    session_token = generate_session_token()
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "auth_provider": "google"
    }

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "auth_provider": user.auth_provider
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout current user"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Logged out successfully"}

# ==================== TASK ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "FlowTask Pro API"}

@api_router.post("/tasks", response_model=Task, status_code=201)
async def create_task(task_data: TaskCreate, user: User = Depends(get_current_user)):
    task = Task(user_id=user.user_id, **task_data.model_dump())
    doc = task.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.tasks.insert_one(doc)
    return task

@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(
    date: Optional[str] = None, 
    priority: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    query = {"user_id": user.user_id}
    if date:
        query["date"] = date
    if priority:
        query["priority"] = priority
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort([("date", 1), ("time", 1), ("order", 1)]).to_list(1000)
    
    for task in tasks:
        if isinstance(task.get('created_at'), str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
    
    return tasks

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str, user: User = Depends(get_current_user)):
    task = await db.tasks.find_one(
        {"id": task_id, "user_id": user.user_id}, 
        {"_id": 0}
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if isinstance(task.get('created_at'), str):
        task['created_at'] = datetime.fromisoformat(task['created_at'])
    
    return task

@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(
    task_id: str, 
    task_update: TaskUpdate,
    user: User = Depends(get_current_user)
):
    update_data = {k: v for k, v in task_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.tasks.update_one(
        {"id": task_id, "user_id": user.user_id}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if isinstance(task.get('created_at'), str):
        task['created_at'] = datetime.fromisoformat(task['created_at'])
    
    return task

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: User = Depends(get_current_user)):
    result = await db.tasks.delete_one({"id": task_id, "user_id": user.user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"message": "Task deleted successfully"}

@api_router.delete("/tasks/date/{date}")
async def clear_tasks_by_date(date: str, user: User = Depends(get_current_user)):
    result = await db.tasks.delete_many({"date": date, "user_id": user.user_id})
    return {"message": f"Deleted {result.deleted_count} tasks", "count": result.deleted_count}

@api_router.get("/tasks/stats/summary")
async def get_task_stats(user: User = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user.user_id}},
        {
            "$group": {
                "_id": "$date",
                "total": {"$sum": 1},
                "completed": {
                    "$sum": {"$cond": [{"$eq": ["$completed", True]}, 1, 0]}
                },
                "high_priority": {
                    "$sum": {"$cond": [{"$eq": ["$priority", "high"]}, 1, 0]}
                }
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    stats = await db.tasks.aggregate(pipeline).to_list(1000)
    
    total_tasks = sum(s["total"] for s in stats)
    completed_tasks = sum(s["completed"] for s in stats)
    
    return {
        "by_date": stats,
        "total": total_tasks,
        "completed": completed_tasks,
        "pending": total_tasks - completed_tasks,
        "completion_rate": round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1)
    }

# ==================== AI CHAT ENDPOINTS ====================

@api_router.post("/chat")
async def chat_with_ai(request: ChatRequest, user: User = Depends(get_current_user)):
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI API key not configured")
        
        # Get task context for AI
        all_tasks = await db.tasks.find(
            {"user_id": user.user_id}, 
            {"_id": 0, "text": 1, "completed": 1, "priority": 1, "date": 1, "time": 1}
        ).to_list(1000)
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_tasks = [t for t in all_tasks if t.get("date") == today]
        
        # Build context
        total_tasks = len(all_tasks)
        completed_tasks = len([t for t in all_tasks if t.get("completed")])
        pending_tasks = total_tasks - completed_tasks
        today_completed = len([t for t in today_tasks if t.get("completed")])
        today_pending = len(today_tasks) - today_completed
        high_priority_pending = [t for t in all_tasks if not t.get("completed") and t.get("priority") == "high"]
        
        task_context = f"""
Current task data for user {user.name}:
- Today's date: {today}
- Today's tasks: {len(today_tasks)} total ({today_completed} completed, {today_pending} pending)
- All tasks: {total_tasks} total ({completed_tasks} completed, {pending_tasks} pending)
- Completion rate: {round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1)}%
- High priority pending: {len(high_priority_pending)}

Today's pending tasks:
{chr(10).join(['- ' + t.get('text', '') + ' at ' + (t.get('time') or 'anytime') + ' (' + t.get('priority', 'medium') + ')' for t in today_tasks if not t.get('completed')][:5]) or '- None'}

High priority pending tasks:
{chr(10).join(['- ' + t.get('text', '') + ' (due: ' + t.get('date', '') + ' at ' + (t.get('time') or 'anytime') + ')' for t in high_priority_pending][:5]) or '- None'}
"""
        
        system_message = f"""You are FlowAI, an intelligent and helpful task management assistant for FlowTask Pro. 
You help users understand their productivity, prioritize tasks, and plan their work effectively.

{task_context}

Guidelines:
- Be concise but helpful
- Provide specific insights based on the user's actual task data
- Suggest actionable improvements
- Use a friendly, encouraging tone
- If asked about specific tasks, reference the actual data
- Format responses with clear sections when appropriate
- Keep responses under 200 words unless more detail is requested"""

        # Get recent chat history
        recent_messages = await db.chat_messages.find(
            {"session_id": request.session_id, "user_id": user.user_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(10).to_list(10)
        recent_messages.reverse()
        
        # Initialize chat
        chat = LlmChat(
            api_key=api_key,
            session_id=request.session_id,
            system_message=system_message
        ).with_model("gemini", "gemini-3-flash-preview")
        
        # Add history context
        history_context = ""
        if recent_messages:
            history_context = "\n\nRecent conversation:\n"
            for msg in recent_messages[-4:]:
                role = "User" if msg.get("role") == "user" else "Assistant"
                history_context += f"{role}: {msg.get('content', '')[:200]}\n"
        
        user_message = UserMessage(
            text=f"{history_context}\n\nUser's new message: {request.message}" if history_context else request.message
        )
        
        response = await chat.send_message(user_message)
        
        # Store messages
        user_msg = ChatMessage(
            user_id=user.user_id,
            session_id=request.session_id,
            role="user",
            content=request.message
        )
        user_doc = user_msg.model_dump()
        user_doc['timestamp'] = user_doc['timestamp'].isoformat()
        await db.chat_messages.insert_one(user_doc)
        
        ai_msg = ChatMessage(
            user_id=user.user_id,
            session_id=request.session_id,
            role="assistant",
            content=response
        )
        ai_doc = ai_msg.model_dump()
        ai_doc['timestamp'] = ai_doc['timestamp'].isoformat()
        await db.chat_messages.insert_one(ai_doc)
        
        return {"response": response}
        
    except Exception as e:
        logging.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI chat error: {str(e)}")

@api_router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str, limit: int = 50, user: User = Depends(get_current_user)):
    messages = await db.chat_messages.find(
        {"session_id": session_id, "user_id": user.user_id},
        {"_id": 0}
    ).sort("timestamp", 1).limit(limit).to_list(limit)
    
    return messages

@api_router.delete("/chat/history/{session_id}")
async def clear_chat_history(session_id: str, user: User = Depends(get_current_user)):
    result = await db.chat_messages.delete_many({"session_id": session_id, "user_id": user.user_id})
    return {"message": f"Cleared {result.deleted_count} messages"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
