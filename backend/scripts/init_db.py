#!/usr/bin/env python3
"""
Initialize PRAGATI database — creates DB, all tables, admin user, indexes knowledge base.
Run from backend/ directory:
    source venv/bin/activate
    python scripts/init_db.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Step 1: Create the database schema if it doesn't exist ──────────────────
def create_database_if_missing():
    import pymysql
    print("🔌 Connecting to MySQL as root...")
    try:
        conn = pymysql.connect(
            host="localhost",
            port=3306,
            user="root",
            password="Adarsh@88899",
            charset="utf8mb4",
        )
        cursor = conn.cursor()
        cursor.execute("CREATE DATABASE IF NOT EXISTS pragati_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        conn.commit()
        cursor.close()
        conn.close()
        print("✅ Database 'pragati_db' ready")
    except Exception as e:
        print(f"❌ MySQL connection failed: {e}")
        print("   Make sure MySQL is running:  sudo service mysql start")
        sys.exit(1)


# ── Step 2: Create all ORM tables ───────────────────────────────────────────
async def create_all_tables():
    from app.db.database import create_tables
    print("📐 Creating tables...")
    await create_tables()
    print("✅ All tables created")


# ── Step 3: Seed admin user ──────────────────────────────────────────────────
async def seed_admin():
    from sqlalchemy import select
    from app.db.database import AsyncSessionLocal
    from app.models.user import User
    from app.core.security import hash_password

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.phone == "9999999999"))
        if not result.scalar_one_or_none():
            admin = User(
                name="PRAGATI Admin",
                phone="9999999999",
                email="admin@pragati.ai",
                password_hash=hash_password("Admin@123"),
                role="admin",
                language="en",
            )
            db.add(admin)
            await db.commit()
            print("✅ Admin created  →  phone: 9999999999  |  password: Admin@123")
        else:
            print("ℹ️  Admin user already exists")


# ── Step 4: Index knowledge base into ChromaDB ───────────────────────────────
def index_knowledge_base():
    kb_path = "./data/raw/agriculture_knowledge_base.txt"
    if not os.path.exists(kb_path):
        print("⚠️  Knowledge base file not found — skipping RAG indexing")
        return
    try:
        from app.services.rag.rag_pipeline import index_document
        print("📚 Indexing knowledge base into ChromaDB (first run takes ~1 min)...")
        count = index_document(kb_path, {"source": "PRAGATI Knowledge Base", "type": "agriculture"})
        print(f"✅ Indexed {count} text chunks into ChromaDB")
    except Exception as e:
        print(f"⚠️  RAG indexing skipped (will work once sentence-transformers downloads): {e}")


# ── Main ─────────────────────────────────────────────────────────────────────
async def main():
    print("\n🌾  PRAGATI — Database Initialization\n" + "─" * 45)

    create_database_if_missing()
    await create_all_tables()
    await seed_admin()
    index_knowledge_base()

    print("\n🎉  Initialization complete!")
    print("─" * 45)
    print("▶  Start backend :  uvicorn main:app --reload --port 8000")
    print("▶  Start frontend:  cd ../frontend && npm run dev")
    print("🌐  Open          :  http://localhost:5173")
    print("🔑  Admin login   :  9999999999  /  Admin@123\n")


if __name__ == "__main__":
    asyncio.run(main())
