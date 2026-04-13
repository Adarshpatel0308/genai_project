from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from app.db.database import Base


class DiseaseScan(Base):
    __tablename__ = "disease_scans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    image_url = Column(String(255), nullable=False)
    crop_type = Column(String(100), nullable=True)
    detected_disease = Column(String(200), nullable=True)
    confidence_score = Column(Float, nullable=True)
    severity = Column(String(20), nullable=True)  # low, medium, high, critical
    ai_explanation = Column(Text, nullable=True)
    treatment_plan = Column(JSON, nullable=True)
    language = Column(String(10), default="hi")
    created_at = Column(DateTime, server_default=func.now())
