from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import os, uuid, io

from app.db.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.soil import SoilRecord, CropRecommendation
from app.services.ai.crop_service import get_crop_recommendations
from app.services.ocr.soil_ocr import extract_soil_from_image
from app.services.ai.translation_service import translate_text
from app.utils.pdf_generator import generate_pdf

router = APIRouter()


class SoilInput(BaseModel):
    soil_type: Optional[str] = None
    ph: Optional[float] = None
    nitrogen: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None
    organic_carbon: Optional[float] = None
    zinc: Optional[float] = None
    iron: Optional[float] = None
    location_state: Optional[str] = None
    location_district: Optional[str] = None
    language: str = "hi"
    mode: Optional[str] = "advisory"  # 'health' or 'advisory'


@router.post("/analyze")
async def analyze_soil(
    data: SoilInput,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    soil_record = SoilRecord(
        user_id=current_user["id"],
        soil_type=data.soil_type,
        ph=data.ph,
        nitrogen=data.nitrogen,
        phosphorus=data.phosphorus,
        potassium=data.potassium,
        organic_carbon=data.organic_carbon,
        zinc=data.zinc,
        iron=data.iron,
        location_state=data.location_state,
        location_district=data.location_district,
        source="manual"
    )
    db.add(soil_record)
    await db.flush()

    soil_dict = data.model_dump()

    # Use Gemini for soil health analysis if available
    gemini_health = None
    try:
        from app.services.ai.gemini_service import gemini_analyze_soil
        result = await gemini_analyze_soil(soil_dict, data.language)
        if result:
            gemini_health = result
    except Exception:
        pass

    recommendations = await get_crop_recommendations(soil_dict, data.language)

    # Override ai_explanation with Gemini soil health if mode is health
    if gemini_health and data.model_dump().get('mode') == 'health':
        recommendations['ai_explanation'] = gemini_health

    rec = CropRecommendation(
        soil_record_id=soil_record.id,
        user_id=current_user["id"],
        recommended_crops=recommendations["recommended_crops"],
        fertilizer_plan=recommendations["fertilizer_plan"],
        irrigation_schedule=recommendations["irrigation_schedule"],
        rotation_plan=recommendations["rotation_plan"],
        ai_explanation=recommendations["ai_explanation"],
        language=data.language
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)

    return {"soil_record_id": soil_record.id, "recommendation_id": rec.id, **recommendations}


@router.post("/ocr")
async def soil_card_ocr(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["jpg", "jpeg", "png", "pdf"]:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, PDF allowed")

    filename = f"{uuid.uuid4()}.{ext}"
    save_path = os.path.join(settings.UPLOAD_DIR, filename)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    result = await extract_soil_from_image(save_path)
    return {"image_url": f"/uploads/{filename}", **result}


@router.get("/history")
async def get_soil_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SoilRecord).where(SoilRecord.user_id == current_user["id"])
        .order_by(SoilRecord.created_at.desc()).limit(10)
    )
    records = result.scalars().all()
    return [{"id": r.id, "soil_type": r.soil_type, "ph": r.ph, "nitrogen": r.nitrogen,
             "phosphorus": r.phosphorus, "potassium": r.potassium,
             "location_state": r.location_state, "created_at": str(r.created_at)} for r in records]


@router.get("/report/{rec_id}/pdf")
async def download_soil_report(
    rec_id: int,
    language: str = "en",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CropRecommendation).where(CropRecommendation.id == rec_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    explanation = translate_text(rec.ai_explanation or "", language)
    crops = [c["crop"] for c in (rec.recommended_crops or [])]

    sections = [
        {"heading": "Recommended Crops", "content": crops},
        {"heading": "AI Analysis", "content": explanation},
        {"heading": "Fertilizer Plan", "content": rec.fertilizer_plan or {}},
    ]
    pdf_bytes = generate_pdf("Soil & Crop Recommendation Report", sections, language)
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=soil_report_{rec_id}.pdf"})
