from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.security import get_current_user
from app.services.ai.translation_service import translate_text, detect_language

router = APIRouter()


class TranslateRequest(BaseModel):
    text: str
    target_language: str
    source_language: str = "auto"


@router.post("/translate")
async def translate(req: TranslateRequest):
    translated = translate_text(req.text, req.target_language, req.source_language)
    return {"original": req.text, "translated": translated, "target_language": req.target_language}


@router.post("/detect")
async def detect_lang(text: str):
    lang = detect_language(text)
    return {"text": text[:50], "detected_language": lang}
