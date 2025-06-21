
# 📝 Scribe - Collaborative Note Taking Platform

<div align="center">
  <img src="./Frontend/public/logo.png" alt="Scribe Logo" width="120" height="120">
  
  **Real-time collaborative note-taking with rich text editing and seamless sharing**
  
  [![Demo](https://img.shields.io/badge/🌐-Live_Demo-blue)](https://scribe-ruddy.vercel.app)
  [![Status](https://img.shields.io/badge/🚀-Production_Ready-brightgreen)](#)
  [![React](https://img.shields.io/badge/React-18.x-61dafb?logo=react)](https://reactjs.org/)
  [![Django](https://img.shields.io/badge/Django-4.x-092e20?logo=django)](https://djangoproject.com/)
</div>

---

## ✨ Features

### 🔥 **Core Functionality**
- 📝 **Rich Text Editor** - Powered by Quill.js with formatting tools
- ⚡ **Real-time Collaboration** - Multiple users editing simultaneously
- 👥 **Live Cursors** - See where collaborators are typing with colored cursors
- 🔄 **Auto-sync** - Changes saved and synced automatically
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile

### 🚀 **Advanced Features**
- 🎯 **Conflict-free Editing** - CRDT-based synchronization using Yjs
- 🔒 **Permission System** - Owner/Editor/Viewer access levels
- 📤 **Share Notes** - Secure sharing with customizable permissions
- 📄 **PDF Export** - Download notes as professionally formatted PDFs
- 🌐 **WebSocket Integration** - Lightning-fast real-time updates
- 🎨 **Beautiful UI** - Modern glassmorphism design with smooth animations

### 👤 **User Experience**
- 🔐 **Secure Authentication** - Login/Register with session management
- 📂 **Note Organization** - Clean sidebar with all your notes
- 🎯 **Quick Access** - Instant note creation and editing
- 💾 **Auto-save** - Never lose your work with continuous saving
- 🔍 **Search & Filter** - Find your notes quickly

---

## 🛠️ Tech Stack

### **Frontend**
- ⚛️ **React 18** - Modern React with hooks and context
- 🎨 **Tailwind CSS** - Utility-first styling framework
- 📝 **Quill.js** - Rich text editor with collaboration support
- 🔗 **Yjs** - CRDT framework for real-time collaboration
- 🌐 **WebSocket** - Real-time communication
- 📦 **Vite** - Fast build tool and development server

### **Backend**
- 🐍 **Django 4.x** - Robust Python web framework
- 🔌 **Django Channels** - WebSocket support for real-time features
- 🗄️ **SQLite** - Lightweight database for development
- 🔐 **Django Auth** - Built-in authentication system
- 🚀 **ASGI** - Asynchronous server gateway interface

### **Infrastructure**
- ☁️ **Vercel** - Frontend deployment and hosting
- 🖥️ **Render** - Backend deployment with auto-scaling
- 🔄 **Git** - Version control and collaboration

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 16+ and npm
- **Python** 3.8+ and pip
- **Git** for version control

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/yourusername/scribe.git
cd scribe
```

### 2️⃣ Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create initial users (optional)
python manage.py create_users

# Start development server
python manage.py runserver
```

### 3️⃣ Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Start development server
npm run dev
```

### 4️⃣ Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Admin Panel**: http://localhost:8000/admin

---

## 🌐 Environment Variables

### Frontend (.env.local)
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

### Backend (.env)
```env
DEBUG=True
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

---

## 📱 API Documentation

### Authentication Endpoints
```
POST /api/login/          - User login
POST /api/register/       - User registration
POST /api/logout/         - User logout
GET  /api/user/           - Get current user
```

### Notes Endpoints
```
GET    /api/sidebar/         - Get all user notes
GET    /api/get-note/{id}/   - Get specific note
POST   /api/save-note/       - Create/update note
DELETE /api/delete-note/{id}/ - Delete note
POST   /api/share-note/      - Share note with users
```

### WebSocket Endpoints
```
ws://localhost:8000/ws/note/{note_id}/     - Note collaboration
ws://localhost:8000/ws/yjs/{note_id}/      - Yjs real-time sync
```

---

## 🏗️ Project Structure

```
scribe/
├── 📁 frontend/                 # React frontend application
│   ├── 📁 src/
│   │   ├── 📁 components/       # Reusable UI components
│   │   ├── 📁 contexts/         # React context providers
│   │   ├── 📁 hooks/           # Custom React hooks
│   │   └── 📁 utils/           # Utility functions
│   ├── 📄 package.json
│   └── 📄 vite.config.js
├── 📁 backend/                  # Django backend application
│   ├── 📁 home/                # Main Django app
│   │   ├── 📁 management/      # Custom management commands
│   │   ├── 📄 models.py        # Database models
│   │   ├── 📄 views.py         # API views
│   │   ├── 📄 consumers.py     # WebSocket consumers
│   │   └── 📄 routing.py       # WebSocket routing
│   ├── 📄 requirements.txt
│   └── 📄 manage.py
└── 📄 README.md
```

---

## 🎯 Key Features in Detail

### **Real-time Collaboration**
- Multiple users can edit the same note simultaneously
- Changes appear instantly across all connected clients
- Conflict-free merging using operational transforms
- Live cursor tracking with user identification

### **Rich Text Editing**
- Bold, italic, underline, strikethrough formatting
- Headers, lists, and text alignment
- Color highlighting and background colors
- Links, blockquotes, and code blocks
- Mobile-optimized touch interface

### **Sharing & Permissions**
- Share notes via email with customizable access levels
- Owner, Editor, and Viewer permission system
- Secure token-based sharing links
- Real-time collaborator presence indicators

### **Export & Download**
- Professional PDF generation with formatting preservation
- Clean, printable document layout
- Automatic filename generation from note titles
- High-quality output suitable for sharing

---

## 🚀 Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on git push

### Backend (Render)
1. Connect repository to Render
2. Configure build and start commands
3. Set environment variables
4. Enable auto-deployment

### Production Environment Variables
```env
# Frontend
VITE_API_BASE_URL=https://your-backend.onrender.com
VITE_WS_BASE_URL=wss://your-backend.onrender.com

# Backend
DEBUG=False
SECRET_KEY=your-production-secret-key
ALLOWED_HOSTS=your-backend.onrender.com
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### Current Limitations
- SQLite database (not suitable for high-scale production)
- Limited file upload capabilities
- Basic search functionality


---

<div align="center">
  <p>Built with ❤️ by Hike-12</p>
  <p>⭐ Star us on GitHub if this project helped you!</p>
</div>
