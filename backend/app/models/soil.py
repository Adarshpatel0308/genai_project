from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from app.db.database import Base


class SoilRecord(Base):
    __tablename__ = "soil_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    soil_type = Column(String(50), nullable=True)
    ph = Column(Float, nullable=True)
    nitrogen = Column(Float, nullable=True)
    phosphorus = Column(Float, nullable=True)
    potassium = Column(Float, nullable=True)
    organic_carbon = Column(Float, nullable=True)
    zinc = Column(Float, nullable=True)
    iron = Column(Float, nullable=True)
    location_state = Column(String(50), nullable=True)
    location_district = Column(String(50), nullable=True)
    source = Column(String(20), default="manual")  # manual, ocr
    ocr_image_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class CropRecommendation(Base):
    __tablename__ = "crop_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    soil_record_id = Column(Integer, ForeignKey("soil_records.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recommended_crops = Column(JSON, nullable=True)
    fertilizer_plan = Column(JSON, nullable=True)
    irrigation_schedule = Column(JSON, nullable=True)
    rotation_plan = Column(JSON, nullable=True)
    ai_explanation = Column(Text, nullable=True)
    language = Column(String(10), default="hi")
    created_at = Column(DateTime, server_default=func.now())
