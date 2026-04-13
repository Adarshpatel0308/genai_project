from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import Optional, List
import os, uuid

from app.db.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.forum import ForumPost, ForumComment
from app.services.ai.llm_service import run_chain

router = APIRouter()

MODERATION_PROMPT = """You are a content moderator for an agriculture forum.
Check if this post contains: hate speech, spam, adult content, or completely off-topic content.
Reply with ONLY: APPROVED or FLAGGED: <reason>"""

AI_SUGGEST_PROMPT = """You are an agriculture expert. A farmer posted this question on a forum.
Provide a helpful, practical answer in simple language. Keep it under 150 words."""


@router.post("/posts")
async def create_post(
    title: str = Form(...),
    content: str = Form(...),
    category: str = Form("general"),
    language: str = Form("hi"),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    image_url = None
    if file:
        ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{ext}"
        save_path = os.path.join(settings.UPLOAD_DIR, filename)
        with open(save_path, "wb") as f:
            f.write(await file.read())
        image_url = f"/uploads/{filename}"

    # AI moderation
    mod_result = await run_chain(MODERATION_PROMPT, f"Title: {title}\nContent: {content}")
    is_flagged = mod_result.strip().startswith("FLAGGED")

    # AI suggestion
    ai_suggestion = await run_chain(AI_SUGGEST_PROMPT, f"{title}\n{content}")

    post = ForumPost(
        user_id=current_user["id"],
        title=title,
        content=content,
        image_url=image_url,
        category=category,
        is_flagged=is_flagged,
        is_approved=not is_flagged,
        ai_suggestion=ai_suggestion,
        language=language
    )
    db.add(post)
    await db.flush()
    return {"post_id": post.id, "is_flagged": is_flagged, "ai_suggestion": ai_suggestion}


@router.get("/posts")
async def list_posts(
    category: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    query = select(ForumPost).where(ForumPost.is_approved == True)
    if category:
        query = query.where(ForumPost.category == category)
    query = query.order_by(ForumPost.created_at.desc()).offset((page-1)*limit).limit(limit)
    result = await db.execute(query)
    posts = result.scalars().all()
    return [{"id": p.id, "title": p.title, "content": p.content[:200],
             "category": p.category, "upvotes": p.upvotes, "image_url": p.image_url,
             "ai_suggestion": p.ai_suggestion, "created_at": str(p.created_at)} for p in posts]


@router.get("/posts/{post_id}")
async def get_post(post_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ForumPost).where(ForumPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comments_result = await db.execute(
        select(ForumComment).where(ForumComment.post_id == post_id, ForumComment.is_approved == True)
        .order_by(ForumComment.created_at)
    )
    comments = comments_result.scalars().all()

    return {
        "id": post.id, "title": post.title, "content": post.content,
        "category": post.category, "upvotes": post.upvotes, "image_url": post.image_url,
        "ai_suggestion": post.ai_suggestion, "created_at": str(post.created_at),
        "comments": [{"id": c.id, "content": c.content, "upvotes": c.upvotes,
                      "is_ai": c.is_ai_generated, "created_at": str(c.created_at)} for c in comments]
    }


@router.post("/posts/{post_id}/comment")
async def add_comment(
    post_id: int,
    content: str = Form(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    comment = ForumComment(
        post_id=post_id,
        user_id=current_user["id"],
        content=content,
        is_approved=True
    )
    db.add(comment)
    return {"message": "Comment added"}


@router.post("/posts/{post_id}/upvote")
async def upvote_post(post_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(update(ForumPost).where(ForumPost.id == post_id).values(upvotes=ForumPost.upvotes + 1))
    return {"message": "Upvoted"}
