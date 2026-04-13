from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import uuid
import asyncio

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.forum import ChatHistory
from app.services.rag.rag_pipeline import rag_query
from app.services.ai.translation_service import detect_language

router = APIRouter()

# Warmup state — set to True once Groq responds successfully
_groq_ready = False
_groq_ready_event = asyncio.Event()


def mark_groq_ready():
    global _groq_ready
    _groq_ready = True
    _groq_ready_event.set()


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    language: Optional[str] = None


@router.post("/chat")
async def chat(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    session_id = req.session_id or str(uuid.uuid4())
    language = req.language or detect_language(req.message) or "hi"

    if not _groq_ready:
        try:
            await asyncio.wait_for(_groq_ready_event.wait(), timeout=45.0)
        except asyncio.TimeoutError:
            pass

    # ── Fetch conversation history for memory ────────────────────────────────
    history: list[dict] = []
    if req.session_id:  # only fetch if continuing an existing session
        try:
            result = await db.execute(
                select(ChatHistory)
                .where(
                    ChatHistory.user_id == current_user["id"],
                    ChatHistory.session_id == session_id
                )
                .order_by(ChatHistory.created_at.desc())
                .limit(6)  # last 3 exchanges (6 messages)
            )
            past = result.scalars().all()
            # Reverse to chronological order
            history = [
                {"role": m.role, "content": m.content}
                for m in reversed(past)
            ]
        except Exception as e:
            print(f"History fetch failed: {e}")

    # ── Run agentic RAG query with memory ──────────────────────────────────
    answer = await rag_query(req.message, language, history=history)

    # Save to DB
    try:
        db.add(ChatHistory(user_id=current_user["id"], session_id=session_id,
                           role="user", content=req.message, language=language))
        db.add(ChatHistory(user_id=current_user["id"], session_id=session_id,
                           role="assistant", content=answer, language=language))
        await db.commit()
    except Exception as e:
        print(f"Chat history save failed: {e}")
        await db.rollback()

    return {"session_id": session_id, "answer": answer, "language": language}


@router.get("/history/{session_id}")
async def get_chat_history(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ChatHistory)
        .where(ChatHistory.user_id == current_user["id"],
               ChatHistory.session_id == session_id)
        .order_by(ChatHistory.created_at)
    )
    messages = result.scalars().all()
    return [{"role": m.role, "content": m.content, "created_at": str(m.created_at)} for m in messages]


@router.get("/sessions")
async def get_sessions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func
    result = await db.execute(
        select(ChatHistory.session_id, func.max(ChatHistory.created_at).label("last_msg"))
        .where(ChatHistory.user_id == current_user["id"])
        .group_by(ChatHistory.session_id)
        .order_by(func.max(ChatHistory.created_at).desc())
        .limit(20)
    )
    sessions = result.all()
    return [{"session_id": s.session_id, "last_message": str(s.last_msg)} for s in sessions]


@router.websocket("/ws/{session_id}")
async def chat_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "")
            language = data.get("language", "hi")
            answer = await rag_query(message, language)
            await websocket.send_json({"answer": answer, "session_id": session_id})
    except WebSocketDisconnect:
        pass
