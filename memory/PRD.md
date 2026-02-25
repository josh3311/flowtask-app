# FlowTask Pro - Product Requirements Document

## Original Problem Statement
Build a FlowTask Pro web app - AI-powered task manager with:
1. Dashboard (Calendar + Daily Tasks + Live Clock)
2. Task Manager (Full CRUD with Time & Reminders)
3. AI Assistant (Smart Chat with Gemini 3 Flash)
4. Authentication (Email/Password + Google OAuth)
5. Light/Dark Mode Toggle
6. French/English Language Support
7. PWA with Service Worker
8. Drag-and-Drop Task Reordering
9. Browser Notifications for Reminders

---

## Architecture

### Tech Stack
- **Frontend**: React 19 + Tailwind CSS + Sonner + i18n
- **Backend**: FastAPI + Motor (async MongoDB) + bcrypt
- **Database**: MongoDB
- **AI**: Gemini 3 Flash via emergentintegrations library
- **Auth**: Email/Password + Emergent Google OAuth
- **PWA**: Service Worker + Web Manifest

### File Structure
```
/app
├── backend/
│   ├── server.py           # FastAPI app with auth, tasks, reminders, chat
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.js          # Main React app
│   │   ├── App.css
│   │   ├── index.css       # Theme variables
│   │   └── i18n/
│   │       └── translations.js  # EN/FR translations
│   ├── public/
│   │   ├── index.html      # PWA meta tags
│   │   ├── manifest.json   # PWA manifest
│   │   ├── service-worker.js  # Offline support
│   │   └── offline.html    # Offline page
│   └── package.json
└── design_guidelines.json
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google/session` - Google OAuth
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

#### Tasks
- `POST /api/tasks` - Create task (with time & reminder)
- `GET /api/tasks` - Get user's tasks
- `GET /api/tasks/{id}` - Get single task
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task
- `PUT /api/tasks/reorder` - Reorder tasks (drag-and-drop)
- `GET /api/tasks/stats/summary` - Get statistics

#### Reminders
- `GET /api/tasks/reminders/pending` - Get due reminders
- `POST /api/tasks/{id}/reminder-sent` - Mark reminder sent

#### AI Chat
- `POST /api/chat` - Chat with FlowAI
- `GET /api/chat/history/{session_id}` - Get chat history
- `DELETE /api/chat/history/{session_id}` - Clear chat

---

## Features Implemented

### Phase 1 - Core Features (Feb 25, 2026)
- Dashboard with calendar, daily flow, quick add
- Task Manager with CRUD, voice notes, priority
- AI Assistant with Gemini 3 Flash
- Modern dark theme

### Phase 2 - Authentication (Feb 25, 2026)
- Email/Password registration and login
- Google OAuth via Emergent
- User-specific tasks
- Light/Dark mode toggle

### Phase 3 - Advanced Features (Feb 25, 2026)
1. **PWA Service Worker**
   - Offline page support
   - Asset caching
   - Background sync ready

2. **Drag-and-Drop Reordering**
   - Grip handle on task cards
   - Visual feedback during drag
   - Order persisted in database

3. **Task Reminders**
   - Reminder options: 15min, 30min, 1hour, at time
   - Browser notifications
   - Automatic reminder checking (every minute)

4. **Multi-language (i18n)**
   - English (en) - default
   - French (fr)
   - Translations: auth, navigation, dashboard, tasks, AI

5. **Live Clock**
   - Real-time display on dashboard
   - Localized format based on language

---

## Prioritized Backlog

### P0 (Critical) - DONE
- All core features implemented

### P1 (High Priority)
- [ ] Full offline mode with task syncing
- [ ] Phone number authentication
- [ ] Push notifications (server-side)

### P2 (Medium Priority)
- [ ] More languages (Spanish, German)
- [ ] Data export/import
- [ ] Recurring tasks

### P3 (Low Priority)
- [ ] Calendar integrations
- [ ] Team collaboration
- [ ] Custom themes

---

## Deployment

Ready for custom domain deployment. Use Emergent deployment options or:
- Vercel (frontend)
- Railway/Render (backend)
- MongoDB Atlas (database)

---

## Next Steps
1. Add custom domain via Emergent deployment
2. Set up production MongoDB Atlas
3. Configure DNS records
4. Enable HTTPS
