from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime, JSON, Date
from sqlalchemy.sql import func
from app.db.database import Base


class MarketPrice(Base):
    __tablename__ = "market_prices"

    id = Column(Integer, primary_key=True, index=True)
    commodity = Column(String(100), nullable=False)
    mandi_name = Column(String(100), nullable=False)
    state = Column(String(50), nullable=False)
    district = Column(String(50), nullable=True)
    min_price = Column(Float, nullable=False)
    max_price = Column(Float, nullable=False)
    modal_price = Column(Float, nullable=False)
    unit = Column(String(20), default="quintal")
    price_date = Column(Date, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class FarmExpense(Base):
    __tablename__ = "farm_expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    crop_name = Column(String(100), nullable=False)
    area_acres = Column(Float, nullable=False)
    seed_cost = Column(Float, default=0)
    fertilizer_cost = Column(Float, default=0)
    pesticide_cost = Column(Float, default=0)
    labour_cost = Column(Float, default=0)
    machinery_cost = Column(Float, default=0)
    irrigation_cost = Column(Float, default=0)
    other_cost = Column(Float, default=0)
    expected_yield_kg = Column(Float, nullable=True)
    selling_price_per_kg = Column(Float, nullable=True)
    ai_analysis = Column(JSON, nullable=True)
    language = Column(String(10), default="hi")
    created_at = Column(DateTime, server_default=func.now())
