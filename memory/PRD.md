# FlowTask Pro - Product Requirements Document

## Original Problem Statement
Build a FlowTask Pro web app - AI-powered task manager with:
1. Dashboard (Calendar + Daily Tasks + Live Clock)
2. Task Manager (Full CRUD with Time)
3. AI Assistant (Smart Chat)
4. Authentication (Email/Password + Google OAuth)
5. Light/Dark Mode Toggle

### User Requirements:
- Fix bugs (non-working buttons)
- Make mobile-friendly
- Make AI section interactive and smart
- Modern dark theme + light mode option
- PWA support
- Add clock on home screen
- Add time for each task
- User authentication with Google Auth and Email/Password
- User-specific tasks

---

## Architecture

### Tech Stack
- **Frontend**: React 19 + Tailwind CSS + Sonner (toasts)
- **Backend**: FastAPI + Motor (async MongoDB) + bcrypt (auth)
- **Database**: MongoDB
- **AI**: Gemini 3 Flash via emergentintegrations library
- **Auth**: Email/Password (JWT sessions) + Emergent Google OAuth

### File Structure
```
/app
├── backend/
│   ├── server.py         # FastAPI app with auth + tasks + chat
│   ├── requirements.txt
│   └── .env              # MONGO_URL, DB_NAME, EMERGENT_LLM_KEY
├── frontend/
│   ├── src/
│   │   ├── App.js        # Main React app with auth, themes, clock
│   │   ├── App.css       # Custom styles
│   │   └── index.css     # Tailwind + theme variables (light/dark)
│   ├── public/
│   │   └── index.html    # PWA meta tags
│   └── package.json
└── design_guidelines.json
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google/session` - Exchange Google OAuth session
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

#### Tasks (All require authentication)
- `POST /api/tasks` - Create task (with time field)
- `GET /api/tasks` - Get user's tasks
- `GET /api/tasks/{id}` - Get single task
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task
- `GET /api/tasks/stats/summary` - Get user's task statistics

#### AI Chat (Requires authentication)
- `POST /api/chat` - Chat with AI (user-specific context)
- `GET /api/chat/history/{session_id}` - Get chat history
- `DELETE /api/chat/history/{session_id}` - Clear chat

---

## User Personas

### Primary: Productivity-Focused Professional
- Needs to manage daily tasks with specific times
- Values visual progress tracking with live clock
- Wants AI-powered insights about their productivity
- Uses both desktop and mobile

### Secondary: Student
- Organizes assignments by date/priority/time
- Uses voice notes for quick task capture
- Appreciates dark mode for late-night studying
- Values mobile-first design

---

## Core Requirements (Static)

### Must Have
- [x] User authentication (Email/Password + Google OAuth)
- [x] User-specific tasks
- [x] Calendar view with task indicators
- [x] Task CRUD with time field
- [x] Priority levels (low, medium, high)
- [x] Voice note recording
- [x] AI chat with context awareness
- [x] Mobile responsive design
- [x] Light/Dark mode toggle
- [x] Live clock on dashboard

### Should Have
- [x] Daily Flow visualization with times
- [x] Quick add task with time
- [x] Task filtering by date/priority
- [x] Toast notifications
- [x] Chat history persistence
- [x] Theme persistence (localStorage)

### Nice to Have
- [ ] Drag and drop reordering
- [ ] Service worker for offline
- [ ] Task reminders/notifications
- [ ] Export/Import tasks
- [ ] Phone number authentication

---

## Implementation Status

### Completed (Feb 25, 2026)

#### Phase 1 - Core Features
1. **Backend API** - Full CRUD for tasks, AI chat with Gemini 3 Flash
2. **Dashboard Section** - Calendar, daily flow, quick add, task list
3. **Task Manager Section** - Full form, filters, voice recording
4. **AI Assistant Section** - Chat interface, quick actions, history
5. **Theme** - Modern dark "Deep Space Productivity" theme

#### Phase 2 - Authentication & Enhancements
1. **Email/Password Auth** - Registration, login, secure sessions
2. **Google OAuth** - Emergent-managed Google authentication
3. **User-specific Tasks** - Tasks filtered by user_id
4. **Light/Dark Mode** - Toggle with localStorage persistence
5. **Live Clock** - Real-time clock on dashboard
6. **Task Times** - Time field for tasks (HH:MM format)
7. **Mobile Optimizations** - Bottom nav, touch targets, safe areas

### Testing Results
- Backend: 100% passed
- Frontend: 100% passed
- Authentication: 100% passed
- Mobile: 100% passed

---

## Prioritized Backlog

### P0 (Critical)
- None remaining

### P1 (High Priority)
- [ ] Service worker for offline capability
- [ ] Drag and drop task reordering
- [ ] Task reminders/push notifications
- [ ] Phone number authentication (Firebase/Twilio)

### P2 (Medium Priority)
- [ ] Data export/import (JSON/CSV)
- [ ] Weekly/monthly view modes
- [ ] Recurring tasks
- [ ] Task categories/tags

### P3 (Low Priority)
- [ ] Custom theme colors
- [ ] Multiple task lists/projects
- [ ] Team collaboration features
- [ ] Calendar integrations (Google Calendar)

---

## Security Considerations
- Passwords hashed with bcrypt
- Session tokens stored in httpOnly cookies
- User sessions expire after 7 days
- All task endpoints require authentication
- CORS configured for production

---

## Next Tasks
1. Implement service worker for full PWA offline support
2. Add phone number authentication
3. Implement drag-and-drop task reordering
4. Add push notifications for task reminders
