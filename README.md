# 🌾 PRAGATI — Enterprise Agriculture AI Platform

> AI-powered platform empowering Indian farmers with crop disease detection, smart advisory, market intelligence, and multilingual support.

---

## 🏗️ Architecture Overview

```
PRAGATI/
├── backend/                    # FastAPI Python backend
│   ├── app/
│   │   ├── api/routes/         # All API endpoints
│   │   ├── core/               # Config, security (JWT)
│   │   ├── db/                 # SQLAlchemy async DB
│   │   ├── models/             # MySQL ORM models
│   │   ├── services/
│   │   │   ├── ai/             # LLM, disease, crop, translation
│   │   │   ├── rag/            # LangChain RAG pipeline
│   │   │   ├── ocr/            # Tesseract OCR
│   │   │   ├── weather/        # Open-Meteo API
│   │   │   └── market/         # Market price service
│   │   └── utils/              # PDF generator
│   ├── data/
│   │   ├── raw/                # Knowledge base text files
│   │   ├── uploads/            # User uploaded files
│   │   └── vector_store/       # ChromaDB embeddings
│   ├── ml_models/              # PyTorch disease detection model
│   └── scripts/                # DB init, setup scripts
├── frontend/                   # React + Vite + TailwindCSS
│   └── src/
│       ├── pages/              # All 11 module pages
│       ├── components/         # Layout, UI components
│       ├── store/              # Zustand state management
│       ├── services/           # Axios API client
│       └── i18n/               # Hindi, Marathi, Gujarati, English
└── docker-compose.yml
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, Framer Motion |
| State | Zustand |
| Charts | Recharts |
| Backend | FastAPI, Python 3.11 |
| Database | MySQL 8 (structured data) |
| Vector DB | ChromaDB (RAG embeddings) |
| LLM | Ollama + Llama3 (100% free, local) |
| Embeddings | sentence-transformers (multilingual) |
| RAG | LangChain RetrievalQA |
| OCR | Tesseract (offline) |
| Weather | Open-Meteo (free, no API key) |
| TTS | gTTS (free) |
| PDF | ReportLab |
| Translation | deep-translator (Google Translate free) |

---

## 🚀 Installation in WSL (Step by Step)

### Step 1: Open WSL terminal

```bash
# In Windows, press Win+R, type: wsl
# OR open Windows Terminal and select Ubuntu
```

### Step 2: Navigate to project

```bash
cd /mnt/c/Users/hp/OneDrive/Documents/OneDrive/Desktop/PRAGATI
```

### Step 3: Install system dependencies

```bash
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3-pip \
    tesseract-ocr tesseract-ocr-hin tesseract-ocr-mar tesseract-ocr-guj \
    poppler-utils libgl1-mesa-glx libglib2.0-0 curl
```

### Step 4: Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 5: Install MySQL in WSL

```bash
sudo apt-get install -y mysql-server
sudo service mysql start
sudo mysql -u root -e "
  CREATE DATABASE IF NOT EXISTS pragati_db;
  CREATE USER IF NOT EXISTS 'pragati_user'@'localhost' IDENTIFIED BY 'pragati_pass';
  GRANT ALL PRIVILEGES ON pragati_db.* TO 'pragati_user'@'localhost';
  FLUSH PRIVILEGES;
"
```

### Step 6: Install Ollama (Local LLM - FREE)

```bash
curl -fsSL https://ollama.ai/install.sh | sh
# Start Ollama service
ollama serve &
# Pull Llama3 model (4GB download - do once)
ollama pull llama3
```

> **Alternative smaller model** (if RAM is limited):
> ```bash
> ollama pull llama3.2:1b   # Only 1.3GB
> # Then update backend/.env: OLLAMA_MODEL=llama3.2:1b
> ```

### Step 7: Setup Python backend

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gtts aiomysql
```

### Step 8: Configure environment

```bash
# Edit .env file with your MySQL credentials
nano .env
# Verify these lines:
# DB_USER=pragati_user
# DB_PASSWORD=pragati_pass
# DB_NAME=pragati_db
# OLLAMA_MODEL=llama3
```

### Step 9: Initialize database & index knowledge base

```bash
# Still in backend/ with venv activated
python scripts/init_db.py
```

### Step 10: Setup frontend

```bash
cd ../frontend
npm install
```

---

## ▶️ Running the Application

### Terminal 1 — Ollama (if not running)
```bash
ollama serve
```

### Terminal 2 — Backend
```bash
cd /mnt/c/Users/hp/.../PRAGATI/backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 3 — Frontend
```bash
cd /mnt/c/Users/hp/.../PRAGATI/frontend
npm run dev
```

### Access the app
- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs
- **Admin Login**: phone=`9999999999`, password=`Admin@123`

---

## 🔑 What to Provide

After running `init_db.py`, provide:

1. **MySQL credentials** (already set in .env)
2. **Ollama model name** (llama3 or llama3.2:1b)
3. Nothing else — all services are free and local!

---

## 🌐 API Endpoints Summary

| Module | Endpoint | Method |
|--------|----------|--------|
| Auth | `/api/auth/login` | POST |
| Auth | `/api/auth/register` | POST |
| Disease | `/api/disease/scan` | POST |
| Disease | `/api/disease/report/{id}/pdf` | GET |
| Chatbot | `/api/chatbot/chat` | POST |
| Chatbot | `/api/chatbot/ws/{session}` | WS |
| Weather | `/api/weather/forecast?location=` | GET |
| Soil | `/api/soil/analyze` | POST |
| Soil | `/api/soil/ocr` | POST |
| Market | `/api/market/prices` | GET |
| Farm | `/api/farm/calculate` | POST |
| Forum | `/api/forum/posts` | GET/POST |
| Voice | `/api/voice/ask` | POST |
| Voice | `/api/voice/text-to-speech` | POST |
| Admin | `/api/admin/stats` | GET |
| Admin | `/api/admin/documents/upload` | POST |

---

## 🎨 Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Brand Purple | `#6C3FC5` | Primary actions, brand |
| Brand Light | `#8b5cf6` | Hover states |
| Amber | `#F59E0B` | Accents, CTAs |
| Surface | `#0f0a1e` | Background |
| Card | `#1a1030` | Card backgrounds |
| Elevated | `#231540` | Elevated surfaces |
| Border | `#2d1f4a` | Borders |

---

## 🤖 AI Architecture

```
User Query
    │
    ▼
Language Detection (character analysis)
    │
    ▼
LangChain RetrievalQA Chain
    │
    ├── ChromaDB Vector Store
    │       └── sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
    │               └── Agriculture Knowledge Base (indexed PDFs + text)
    │
    └── Ollama LLM (Llama3 - local, free)
            └── Structured prompt with language instruction
    │
    ▼
Response in user's language
    │
    ▼
Optional: gTTS → Audio output
```

---

## 📱 Multilingual Support

Language changes instantly across the entire app:
- **Hindi** (हिंदी) — Default
- **Marathi** (मराठी)
- **Gujarati** (ગુજરાતી)
- **English**

Language switcher available in:
1. Sidebar (dropdown)
2. Top header (quick toggle buttons)
3. Any page (persisted in localStorage + DB)

All AI responses, PDF reports, and UI text follow the selected language.

---

## 📄 PDF Reports Available

Every module generates downloadable PDF reports in the user's chosen language:
- Disease scan report
- Soil & crop recommendation report
- Market price report
- Farm profitability report

---

## 🔒 Security

- JWT authentication (HS256)
- bcrypt password hashing
- Role-based access (farmer / admin)
- CORS configured
- File type validation on uploads
- AI content moderation on forum posts
