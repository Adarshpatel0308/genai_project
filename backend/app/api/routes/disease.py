from fastapi import APIRouter, UploadFile, File, Depends, Form, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os, uuid, io

from app.db.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.disease import DiseaseScan
from app.services.ai.disease_service import detect_disease
from app.services.ai.translation_service import translate_text
from app.utils.pdf_generator import generate_pdf

router = APIRouter()


@router.post("/scan")
async def scan_disease(
    file: UploadFile = File(...),
    language: str = Form("hi"),
    crop_hint: str = Form(""),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")

    # Save uploaded image
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    save_path = os.path.join(settings.UPLOAD_DIR, filename)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    # Run disease detection with optional crop hint
    result = await detect_disease(save_path, language, crop_hint=crop_hint)

    # Save to DB
    scan = DiseaseScan(
        user_id=current_user["id"],
        image_url=f"/uploads/{filename}",
        crop_type=result["crop"],
        detected_disease=result["disease"],
        confidence_score=result["confidence"],
        severity=result["severity"],
        ai_explanation=result["explanation"],
        treatment_plan=result["treatment_plan"],
        language=language
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    return {
        "scan_id": scan.id,
        "image_url": scan.image_url,
        **result
    }


@router.get("/history")
async def get_scan_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DiseaseScan)
        .where(DiseaseScan.user_id == current_user["id"])
        .order_by(DiseaseScan.created_at.desc())
        .limit(20)
    )
    scans = result.scalars().all()
    return [{"id": s.id, "crop": s.crop_type, "disease": s.detected_disease,
             "severity": s.severity, "confidence": s.confidence_score,
             "image_url": s.image_url, "created_at": str(s.created_at)} for s in scans]


@router.get("/report/{scan_id}/pdf")
async def download_report(
    scan_id: int,
    language: str = "en",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(DiseaseScan).where(DiseaseScan.id == scan_id))
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    explanation = translate_text(scan.ai_explanation or "", language)

    sections = [
        {"heading": "Disease Detection Result", "content": {
            "Crop": scan.crop_type, "Disease": scan.detected_disease,
            "Confidence": f"{scan.confidence_score}%", "Severity": scan.severity
        }},
        {"heading": "AI Analysis & Treatment Plan", "content": explanation},
    ]

    pdf_bytes = generate_pdf(f"Disease Report - {scan.crop_type}", sections, language)
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=disease_report_{scan_id}.pdf"})
