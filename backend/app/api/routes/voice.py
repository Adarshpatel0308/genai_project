from fastapi import APIRouter, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from app.core.security import get_current_user
from app.services.rag.rag_pipeline import rag_query
from app.services.ai.translation_service import detect_language

router = APIRouter()


class VoiceTextRequest(BaseModel):
    text: str
    language: str = "hi"


@router.post("/text-to-speech")
async def text_to_speech(
    req: VoiceTextRequest,
    current_user: dict = Depends(get_current_user)
):
    """Convert text to speech using gTTS (free, no API key)."""
    try:
        from gtts import gTTS
        lang_map = {"hi": "hi", "mr": "mr", "gu": "gu", "en": "en"}
        lang = lang_map.get(req.language, "hi")
        tts = gTTS(text=req.text, lang=lang, slow=False)
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        return StreamingResponse(audio_buffer, media_type="audio/mpeg",
                                 headers={"Content-Disposition": "attachment; filename=response.mp3"})
    except Exception as e:
        return {"error": str(e), "message": "TTS failed, install gtts: pip install gtts"}


@router.post("/ask")
async def voice_ask(
    text: str = Form(...),
    language: str = Form("hi"),
    current_user: dict = Depends(get_current_user)
):
    """Process voice query text and return answer + audio."""
    detected_lang = detect_language(text) or language
    answer = await rag_query(text, detected_lang)

    return {
        "question": text,
        "answer": answer,
        "language": detected_lang,
        "audio_url": None  # Frontend calls /text-to-speech separately
    }
