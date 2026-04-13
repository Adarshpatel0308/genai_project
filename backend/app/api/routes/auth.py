from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    name: str
    phone: str
    password: str
    email: Optional[str] = None
    language: str = "hi"
    state: Optional[str] = None
    district: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    name: str
    phone: str
    email: Optional[str]
    role: str
    language: str
    state: Optional[str]
    district: Optional[str]


@router.post("/register")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.phone == data.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone already registered")

    user = User(
        name=data.name,
        phone=data.phone,
        email=data.email,
        password_hash=hash_password(data.password),
        language=data.language,
        state=data.state,
        district=data.district
    )
    db.add(user)
    await db.flush()
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "name": user.name, "role": user.role, "language": user.language}}


@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.phone == form.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "name": user.name, "role": user.role, "language": user.language}}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "name": user.name, "phone": user.phone, "email": user.email,
            "role": user.role, "language": user.language, "state": user.state, "district": user.district}


@router.patch("/language")
async def update_language(language: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if user:
        user.language = language
    return {"message": "Language updated", "language": language}
