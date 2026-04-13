from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import asyncio

from app.core.config import settings
from app.db.database import create_tables
from app.api.routes import (
    auth, disease, chatbot, weather, soil,
    market, farm_calc, forum, admin, voice, translate
)


async def _seed_admin():
    try:
        from sqlalchemy import select
        from app.db.database import AsyncSessionLocal
        from app.models.user import User
        from app.core.security import hash_password
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.phone == "9999999999"))
            if not result.scalar_one_or_none():
                db.add(User(
                    name="PRAGATI Admin",
                    phone="9999999999",
                    email="admin@pragati.ai",
                    password_hash=hash_password("Admin@123"),
                    role="admin",
                    language="en",
                ))
                await db.commit()
                print("✅ Admin user created")
    except Exception as e:
        print(f"⚠️  Admin seed failed: {e}")


async def _warmup_groq():
    """Pre-load everything so first user request is instant."""
    try:
        from app.services.ai.llm_service import run_chain, get_nebius_client
        from app.services.rag.rag_pipeline import get_embeddings, get_vectorstore

        # 1. Init Nebius client
        get_nebius_client()

        # 2. Pre-load HuggingFace embeddings model (biggest delay — 2-3 min on first load)
        print("⏳ Loading embeddings model...")
        get_embeddings()
        print("✅ Embeddings model loaded")

        # 3. Init ChromaDB vectorstore
        get_vectorstore()
        print("✅ ChromaDB ready")

        # 4. Warm up Nebius LLM
        await run_chain("You are a helpful assistant.", "hi")

        from app.api.routes.chatbot import mark_groq_ready
        mark_groq_ready()
        print("✅ Nebius pre-warmed and ready")
    except Exception as e:
        from app.api.routes.chatbot import mark_groq_ready
        mark_groq_ready()
        print(f"⚠️  Warmup failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    # Auto-create admin user if not exists
    await _seed_admin()
    # Start Groq warmup in background — server starts immediately
    asyncio.create_task(_warmup_groq())
    yield


app = FastAPI(
    title="PRAGATI API",
    description="Enterprise Agriculture AI Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads
os.makedirs("data/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="data/uploads"), name="uploads")

# Register all routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(disease.router, prefix="/api/disease", tags=["Disease Scanner"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Krishi GPT"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])
app.include_router(soil.router, prefix="/api/soil", tags=["Soil & Crop"])
app.include_router(market.router, prefix="/api/market", tags=["Market Prices"])
app.include_router(farm_calc.router, prefix="/api/farm", tags=["Farm Calculator"])
app.include_router(forum.router, prefix="/api/forum", tags=["Community Forum"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice Assistant"])
app.include_router(translate.router, prefix="/api/translate", tags=["Translation"])


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
