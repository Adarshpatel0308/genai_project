from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import io

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.market import FarmExpense
from app.services.ai.llm_service import run_chain, FARM_CALC_SYSTEM_PROMPT
from app.services.ai.translation_service import translate_text
from app.utils.pdf_generator import generate_pdf

router = APIRouter()


class FarmExpenseInput(BaseModel):
    crop_name: str
    area_acres: float
    seed_cost: float = 0
    fertilizer_cost: float = 0
    pesticide_cost: float = 0
    labour_cost: float = 0
    machinery_cost: float = 0
    irrigation_cost: float = 0
    other_cost: float = 0
    expected_yield_kg: Optional[float] = None
    selling_price_per_kg: Optional[float] = None
    language: str = "hi"


@router.post("/calculate")
async def calculate_farm_profit(
    data: FarmExpenseInput,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    total_cost = (data.seed_cost + data.fertilizer_cost + data.pesticide_cost +
                  data.labour_cost + data.machinery_cost + data.irrigation_cost + data.other_cost)

    gross_revenue = 0
    net_profit = 0
    roi = 0

    if data.expected_yield_kg and data.selling_price_per_kg:
        gross_revenue = data.expected_yield_kg * data.selling_price_per_kg
        net_profit = gross_revenue - total_cost
        roi = round((net_profit / total_cost * 100), 2) if total_cost > 0 else 0

    cost_per_acre = round(total_cost / data.area_acres, 2) if data.area_acres > 0 else 0

    # AI optimization tips
    expense_summary = f"""
    Crop: {data.crop_name}, Area: {data.area_acres} acres
    Total Cost: ₹{total_cost}, Revenue: ₹{gross_revenue}, Profit: ₹{net_profit}, ROI: {roi}%
    Breakdown: Seeds ₹{data.seed_cost}, Fertilizer ₹{data.fertilizer_cost}, 
    Labour ₹{data.labour_cost}, Pesticide ₹{data.pesticide_cost}, Machinery ₹{data.machinery_cost}
    """
    system = FARM_CALC_SYSTEM_PROMPT.format(language=data.language)
    ai_tips = await run_chain(system, expense_summary)

    analysis = {
        "total_cost": total_cost,
        "cost_per_acre": cost_per_acre,
        "gross_revenue": gross_revenue,
        "net_profit": net_profit,
        "roi_percent": roi,
        "ai_optimization_tips": ai_tips,
        "risk_level": "high" if roi < 10 else "medium" if roi < 25 else "low"
    }

    expense = FarmExpense(
        user_id=current_user["id"],
        crop_name=data.crop_name,
        area_acres=data.area_acres,
        seed_cost=data.seed_cost,
        fertilizer_cost=data.fertilizer_cost,
        pesticide_cost=data.pesticide_cost,
        labour_cost=data.labour_cost,
        machinery_cost=data.machinery_cost,
        irrigation_cost=data.irrigation_cost,
        other_cost=data.other_cost,
        expected_yield_kg=data.expected_yield_kg,
        selling_price_per_kg=data.selling_price_per_kg,
        ai_analysis=analysis,
        language=data.language
    )
    db.add(expense)
    await db.flush()

    return {"expense_id": expense.id, **analysis}


@router.get("/history")
async def get_expense_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(FarmExpense).where(FarmExpense.user_id == current_user["id"])
        .order_by(FarmExpense.created_at.desc()).limit(10)
    )
    expenses = result.scalars().all()
    return [{"id": e.id, "crop": e.crop_name, "area": e.area_acres,
             "roi": e.ai_analysis.get("roi_percent") if e.ai_analysis else None,
             "created_at": str(e.created_at)} for e in expenses]


@router.get("/report/{expense_id}/pdf")
async def download_farm_report(
    expense_id: int,
    language: str = "en",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from fastapi import HTTPException
    result = await db.execute(select(FarmExpense).where(FarmExpense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Record not found")

    analysis = expense.ai_analysis or {}
    tips = translate_text(analysis.get("ai_optimization_tips", ""), language)

    sections = [
        {"heading": "Farm Details", "content": {"Crop": expense.crop_name, "Area": f"{expense.area_acres} acres"}},
        {"heading": "Financial Summary", "content": {
            "Total Cost": f"₹{analysis.get('total_cost', 0)}",
            "Gross Revenue": f"₹{analysis.get('gross_revenue', 0)}",
            "Net Profit": f"₹{analysis.get('net_profit', 0)}",
            "ROI": f"{analysis.get('roi_percent', 0)}%",
            "Risk Level": analysis.get("risk_level", "N/A")
        }},
        {"heading": "AI Optimization Tips", "content": tips},
    ]
    pdf_bytes = generate_pdf(f"Farm Profitability Report - {expense.crop_name}", sections, language)
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=farm_report_{expense_id}.pdf"})
