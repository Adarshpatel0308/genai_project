import pytesseract
from PIL import Image
import re
import os
from pdf2image import convert_from_path
from app.services.ai.llm_service import run_chain

OCR_SYSTEM_PROMPT = """Extract soil test report data from the following OCR text.
Return ONLY a JSON object with these exact keys:
ph, nitrogen, phosphorus, potassium, organic_carbon, zinc, iron, soil_type, location
Use null for missing values. Numbers only for numeric fields.
For soil_type, look for terms like: Sandy Loam, Clay Loam, Black, Alluvial, Red, Laterite, Loamy, Sandy, Saline.
Return the exact soil type name found in the text, do NOT invent one."""


async def extract_soil_from_image(file_path: str) -> dict:
    """Extract soil data from image or PDF using Gemini Vision first, then Tesseract fallback."""

    # Try Gemini Vision first (much more accurate)
    try:
        from app.services.ai.gemini_service import gemini_ocr_soil_card
        if not file_path.lower().endswith(".pdf"):
            gemini_result = await gemini_ocr_soil_card(file_path)
            if gemini_result:
                return {
                    "raw_text": "Extracted via Gemini Vision",
                    "extracted": gemini_result
                }
    except Exception as e:
        print(f"⚠️  Gemini OCR failed, falling back to Tesseract: {e}")

    # Fallback: Tesseract OCR
    if file_path.lower().endswith(".pdf"):
        pages = convert_from_path(file_path, dpi=200)
        raw_text = ""
        for page in pages[:3]:
            raw_text += pytesseract.image_to_string(page, lang="eng+hin") + "\n"
    else:
        img = Image.open(file_path)
        raw_text = pytesseract.image_to_string(img, lang="eng+hin")

    # Try LLM to parse OCR text
    llm_response = await run_chain(OCR_SYSTEM_PROMPT, raw_text[:3000])

    import json
    try:
        start = llm_response.find("{")
        end = llm_response.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(llm_response[start:end])
        else:
            data = _regex_fallback(raw_text)
    except Exception:
        data = _regex_fallback(raw_text)

    return {"raw_text": raw_text[:500], "extracted": data}


def _regex_fallback(text: str) -> dict:
    """Regex-based fallback extraction."""
    def find_value(patterns):
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                try:
                    return float(m.group(1))
                except Exception:
                    return m.group(1)
        return None

    # Detect soil type from text
    soil_type = None
    soil_type_patterns = [
        (r'sandy\s*loam', 'Sandy Loam'),
        (r'clay\s*loam', 'Clay Loam'),
        (r'black\s*(cotton|regur)?', 'Black (Regur)'),
        (r'alluvial', 'Alluvial'),
        (r'red\s*soil', 'Red'),
        (r'laterite', 'Laterite'),
        (r'loamy', 'Loamy'),
        (r'sandy', 'Sandy Loam'),
        (r'clay', 'Clay Loam'),
        (r'saline', 'Saline'),
    ]
    for pattern, label in soil_type_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            soil_type = label
            break

    return {
        "ph": find_value([r"pH[:\s]+(\d+\.?\d*)", r"ph[:\s]+(\d+\.?\d*)"]),
        "nitrogen": find_value([r"N[:\s]+(\d+\.?\d*)", r"Nitrogen[:\s]+(\d+\.?\d*)"]),
        "phosphorus": find_value([r"P[:\s]+(\d+\.?\d*)", r"Phosphorus[:\s]+(\d+\.?\d*)"]),
        "potassium": find_value([r"K[:\s]+(\d+\.?\d*)", r"Potassium[:\s]+(\d+\.?\d*)"]),
        "organic_carbon": find_value([r"OC[:\s]+(\d+\.?\d*)", r"Organic Carbon[:\s]+(\d+\.?\d*)"]),
        "zinc": find_value([r"Zn[:\s]+(\d+\.?\d*)", r"Zinc[:\s]+(\d+\.?\d*)"]),
        "iron": find_value([r"Fe[:\s]+(\d+\.?\d*)", r"Iron[:\s]+(\d+\.?\d*)"]),
        "soil_type": soil_type,
        "location": None
    }
