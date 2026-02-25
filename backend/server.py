from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio

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

# Task Models
class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    completed: bool = False
    priority: str = "medium"
    date: str
    audio_base64: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    order: int = 0

class TaskCreate(BaseModel):
    text: str
    priority: str = "medium"
    date: str
    audio_base64: Optional[str] = None

class TaskUpdate(BaseModel):
    text: Optional[str] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None
    date: Optional[str] = None
    audio_base64: Optional[str] = None
    order: Optional[int] = None

# Chat Models
class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    session_id: str
    message: str
    task_context: Optional[str] = None

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "FlowTask Pro API"}

# Task CRUD endpoints
@api_router.post("/tasks", response_model=Task, status_code=201)
async def create_task(task_data: TaskCreate):
    task = Task(**task_data.model_dump())
    doc = task.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.tasks.insert_one(doc)
    return task

@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(date: Optional[str] = None, priority: Optional[str] = None):
    query = {}
    if date:
        query["date"] = date
    if priority:
        query["priority"] = priority
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("order", 1).to_list(1000)
    
    for task in tasks:
        if isinstance(task.get('created_at'), str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
    
    return tasks

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if isinstance(task.get('created_at'), str):
        task['created_at'] = datetime.fromisoformat(task['created_at'])
    
    return task

@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_update: TaskUpdate):
    update_data = {k: v for k, v in task_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if isinstance(task.get('created_at'), str):
        task['created_at'] = datetime.fromisoformat(task['created_at'])
    
    return task

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    result = await db.tasks.delete_one({"id": task_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"message": "Task deleted successfully"}

@api_router.delete("/tasks/date/{date}")
async def clear_tasks_by_date(date: str):
    result = await db.tasks.delete_many({"date": date})
    return {"message": f"Deleted {result.deleted_count} tasks", "count": result.deleted_count}

# Task stats endpoint
@api_router.get("/tasks/stats/summary")
async def get_task_stats():
    pipeline = [
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

# AI Chat endpoint
@api_router.post("/chat")
async def chat_with_ai(request: ChatRequest):
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI API key not configured")
        
        # Get task context for AI
        all_tasks = await db.tasks.find({}, {"_id": 0, "text": 1, "completed": 1, "priority": 1, "date": 1}).to_list(1000)
        
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
Current task data:
- Today's date: {today}
- Today's tasks: {len(today_tasks)} total ({today_completed} completed, {today_pending} pending)
- All tasks: {total_tasks} total ({completed_tasks} completed, {pending_tasks} pending)
- Completion rate: {round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1)}%
- High priority pending: {len(high_priority_pending)}

Today's pending tasks:
{chr(10).join(['- ' + t.get('text', '') + ' (' + t.get('priority', 'medium') + ')' for t in today_tasks if not t.get('completed')][:5]) or '- None'}

High priority pending tasks:
{chr(10).join(['- ' + t.get('text', '') + ' (due: ' + t.get('date', '') + ')' for t in high_priority_pending][:5]) or '- None'}
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

        # Get recent chat history for context
        recent_messages = await db.chat_messages.find(
            {"session_id": request.session_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(10).to_list(10)
        recent_messages.reverse()
        
        # Initialize chat
        chat = LlmChat(
            api_key=api_key,
            session_id=request.session_id,
            system_message=system_message
        ).with_model("gemini", "gemini-3-flash-preview")
        
        # Add history context to the message if available
        history_context = ""
        if recent_messages:
            history_context = "\n\nRecent conversation:\n"
            for msg in recent_messages[-4:]:  # Last 4 messages
                role = "User" if msg.get("role") == "user" else "Assistant"
                history_context += f"{role}: {msg.get('content', '')[:200]}\n"
        
        user_message = UserMessage(
            text=f"{history_context}\n\nUser's new message: {request.message}" if history_context else request.message
        )
        
        # Send message and get response
        response = await chat.send_message(user_message)
        
        # Store messages in database
        user_msg = ChatMessage(
            session_id=request.session_id,
            role="user",
            content=request.message
        )
        user_doc = user_msg.model_dump()
        user_doc['timestamp'] = user_doc['timestamp'].isoformat()
        await db.chat_messages.insert_one(user_doc)
        
        ai_msg = ChatMessage(
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
async def get_chat_history(session_id: str, limit: int = 50):
    messages = await db.chat_messages.find(
        {"session_id": session_id},
        {"_id": 0}
    ).sort("timestamp", 1).limit(limit).to_list(limit)
    
    return messages

@api_router.delete("/chat/history/{session_id}")
async def clear_chat_history(session_id: str):
    result = await db.chat_messages.delete_many({"session_id": session_id})
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
