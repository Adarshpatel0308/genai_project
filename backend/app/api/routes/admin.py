from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from pydantic import BaseModel
from typing import Optional
import os, uuid

from app.db.database import get_db
from app.core.security import require_admin, get_current_user, hash_password
from app.core.config import settings
from app.models.forum import ForumPost, KnowledgeDocument
from app.models.user import User
from app.models.disease import DiseaseScan
from app.services.rag.rag_pipeline import index_document
from app.services.rag.disease_rag import index_disease_document, index_soil_document

router = APIRouter()

ALLOWED_KB_EXTENSIONS = ["pdf", "ppt", "pptx", "txt", "jpg", "jpeg", "png"]


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    users = await db.execute(select(func.count(User.id)))
    scans = await db.execute(select(func.count(DiseaseScan.id)))
    posts = await db.execute(select(func.count(ForumPost.id)))
    docs = await db.execute(select(func.count(KnowledgeDocument.id)))
    disease_stats = await db.execute(
        select(DiseaseScan.detected_disease, DiseaseScan.crop_type, func.count(DiseaseScan.id).label('count'))
        .group_by(DiseaseScan.detected_disease, DiseaseScan.crop_type)
        .order_by(func.count(DiseaseScan.id).desc()).limit(10)
    )
    return {
        "total_users": users.scalar(), "total_scans": scans.scalar(),
        "total_forum_posts": posts.scalar(), "total_documents": docs.scalar(),
        "top_diseases": [{"disease": r.detected_disease, "crop": r.crop_type, "count": r.count}
                         for r in disease_stats.all()],
    }


# ── KrishiGPT Knowledge Base ──────────────────────────────────────────────────

@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...), title: str = Form(...),
    doc_type: str = Form("general"), language: str = Form("hi"),
    admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)
):
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["pdf", "txt"]:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files allowed")
    filename = f"{uuid.uuid4()}.{ext}"
    save_path = os.path.join(settings.UPLOAD_DIR, "docs", filename)
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    chunks_count = index_document(save_path, {"title": title, "type": doc_type, "language": language})
    doc = KnowledgeDocument(title=title, file_url=f"/uploads/docs/{filename}",
                            doc_type=doc_type, language=language, is_indexed=True, uploaded_by=admin["id"])
    db.add(doc)
    await db.commit()
    return {"document_id": doc.id, "chunks_indexed": chunks_count, "message": "Indexed into KrishiGPT knowledge base"}


@router.get("/documents")
async def list_documents(admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc()))
    docs = result.scalars().all()
    return [{"id": d.id, "title": d.title, "type": d.doc_type, "language": d.language,
             "is_indexed": d.is_indexed, "created_at": str(d.created_at)} for d in docs]


# ── Disease Knowledge Base ────────────────────────────────────────────────────

@router.post("/knowledge/disease/upload")
async def upload_disease_knowledge(
    file: UploadFile = File(...), title: str = Form(...),
    crop_type: str = Form("general"), language: str = Form("hi"),
    admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)
):
    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_KB_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Allowed: {', '.join(ALLOWED_KB_EXTENSIONS)}")
    filename = f"{uuid.uuid4()}.{ext}"
    save_dir = os.path.join(settings.UPLOAD_DIR, "disease_kb")
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, filename)
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    chunks = index_disease_document(save_path, {"title": title, "crop_type": crop_type, "language": language, "type": "disease_knowledge"})
    doc = KnowledgeDocument(title=title, file_url=f"/uploads/disease_kb/{filename}",
                            doc_type=f"disease_{crop_type}", language=language, is_indexed=True, uploaded_by=admin["id"])
    db.add(doc)
    await db.commit()
    return {"document_id": doc.id, "chunks_indexed": chunks, "message": f"Indexed {chunks} chunks into disease knowledge base"}


@router.get("/knowledge/disease/list")
async def list_disease_knowledge(admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.doc_type.like("disease_%")).order_by(KnowledgeDocument.created_at.desc()))
    docs = result.scalars().all()
    return [{"id": d.id, "title": d.title, "type": d.doc_type, "language": d.language, "created_at": str(d.created_at)} for d in docs]


# ── Soil & Crop Knowledge Base ────────────────────────────────────────────────

@router.post("/knowledge/soil/upload")
async def upload_soil_knowledge(
    file: UploadFile = File(...), title: str = Form(...),
    doc_type: str = Form("soil_guide"), language: str = Form("hi"),
    admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)
):
    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_KB_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Allowed: {', '.join(ALLOWED_KB_EXTENSIONS)}")
    filename = f"{uuid.uuid4()}.{ext}"
    save_dir = os.path.join(settings.UPLOAD_DIR, "soil_kb")
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, filename)
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    chunks = index_soil_document(save_path, {"title": title, "doc_type": doc_type, "language": language, "type": "soil_knowledge"})
    doc = KnowledgeDocument(title=title, file_url=f"/uploads/soil_kb/{filename}",
                            doc_type=doc_type, language=language, is_indexed=True, uploaded_by=admin["id"])
    db.add(doc)
    await db.commit()
    return {"document_id": doc.id, "chunks_indexed": chunks, "message": f"Indexed {chunks} chunks into soil/crop knowledge base"}


@router.get("/knowledge/soil/list")
async def list_soil_knowledge(admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.doc_type.in_(["soil_guide", "crop_guide", "fertilizer_guide", "soil_health"])).order_by(KnowledgeDocument.created_at.desc()))
    docs = result.scalars().all()
    return [{"id": d.id, "title": d.title, "type": d.doc_type, "language": d.language, "created_at": str(d.created_at)} for d in docs]


# ── Expert Management ─────────────────────────────────────────────────────────

class ExpertRegisterRequest(BaseModel):
    name: str
    phone: str
    password: str
    email: Optional[str] = None
    specialization: str = "general"
    state: Optional[str] = None
    district: Optional[str] = None
    designation: str = ""


@router.post("/experts/register")
async def register_expert(data: ExpertRegisterRequest, admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.phone == data.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone already registered")
    expert = User(name=data.name, phone=data.phone, email=data.email,
                  password_hash=hash_password(data.password), role="expert",
                  state=data.state, district=data.district, language="hi", is_active=True)
    db.add(expert)
    await db.commit()
    await db.refresh(expert)
    return {"id": expert.id, "name": expert.name, "message": f"Expert {expert.name} registered successfully"}


@router.get("/experts")
async def list_experts(admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.role == "expert").order_by(User.created_at.desc()))
    experts = result.scalars().all()
    return [{"id": e.id, "name": e.name, "phone": e.phone, "email": e.email,
             "state": e.state, "district": e.district, "is_active": e.is_active,
             "created_at": str(e.created_at)} for e in experts]


@router.get("/experts/public")
async def get_public_experts(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.role == "expert", User.is_active == True))
    experts = result.scalars().all()
    return [{"id": e.id, "name": e.name, "state": e.state, "district": e.district} for e in experts]


# ── Forum Moderation ──────────────────────────────────────────────────────────

@router.get("/forum/flagged")
async def get_flagged_posts(admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ForumPost).where(ForumPost.is_flagged == True))
    posts = result.scalars().all()
    return [{"id": p.id, "title": p.title, "content": p.content[:200], "created_at": str(p.created_at)} for p in posts]


@router.patch("/forum/posts/{post_id}/approve")
async def approve_post(post_id: int, admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    await db.execute(update(ForumPost).where(ForumPost.id == post_id).values(is_approved=True, is_flagged=False))
    return {"message": "Post approved"}


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(admin: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at.desc()).limit(100))
    users = result.scalars().all()
    return [{"id": u.id, "name": u.name, "phone": u.phone, "role": u.role,
             "state": u.state, "is_active": u.is_active, "created_at": str(u.created_at)} for u in users]
