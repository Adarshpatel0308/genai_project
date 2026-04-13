from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(15), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("farmer", "admin", "expert"), default="farmer")
    language = Column(String(10), default="hi")
    state = Column(String(50), nullable=True)
    district = Column(String(50), nullable=True)
    village = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    avatar_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
