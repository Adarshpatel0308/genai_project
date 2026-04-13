#!/bin/bash
# ============================================================
# PRAGATI Platform - Complete WSL Setup Script
# Run: bash scripts/setup.sh
# ============================================================

set -e
echo "🌾 Setting up PRAGATI Agriculture AI Platform..."

# ---- 1. System packages ----
echo "📦 Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y \
    python3.11 python3.11-venv python3-pip \
    tesseract-ocr tesseract-ocr-hin tesseract-ocr-mar tesseract-ocr-guj \
    poppler-utils libgl1-mesa-glx libglib2.0-0 \
    mysql-client curl wget git

# ---- 2. Node.js ----
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# ---- 3. Python virtual environment ----
echo "🐍 Setting up Python environment..."
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt
pip install gtts aiomysql  # Additional packages
cd ..

# ---- 4. Frontend dependencies ----
echo "⚛️  Installing frontend dependencies..."
cd frontend
npm install
cd ..

# ---- 5. Ollama (Local LLM) ----
echo "🤖 Installing Ollama..."
if ! command -v ollama &> /dev/null; then
    curl -fsSL https://ollama.ai/install.sh | sh
fi
echo "📥 Pulling Llama3 model (this may take a while)..."
ollama pull llama3

# ---- 6. Create directories ----
echo "📁 Creating data directories..."
mkdir -p backend/data/uploads/docs
mkdir -p backend/data/vector_store
mkdir -p backend/data/raw
mkdir -p backend/ml_models/disease_detection

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Start MySQL and create database (see README)"
echo "2. Update backend/.env with your MySQL credentials"
echo "3. Run: cd backend && source venv/bin/activate && python scripts/init_db.py"
echo "4. Start backend: uvicorn main:app --reload"
echo "5. Start frontend: cd frontend && npm run dev"
echo ""
echo "🌐 App will be at: http://localhost:5173"
echo "📚 API docs at: http://localhost:8000/docs"
