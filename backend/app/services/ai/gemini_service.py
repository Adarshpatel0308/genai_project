import asyncio
import base64
from app.core.config import settings

_nebius_client = None


def get_nebius_client():
    global _nebius_client
    if _nebius_client is None and settings.NEBIUS_API_KEY:
        try:
            from openai import OpenAI
            _nebius_client = OpenAI(
                base_url="https://api.studio.nebius.com/v1/",
                api_key=settings.NEBIUS_API_KEY
            )
            print("✅ Nebius client initialized")
        except Exception as e:
            print(f"⚠️  Nebius init failed: {e}")
    return _nebius_client


def _encode_image(image_path: str) -> str:
    import mimetypes
    mime = mimetypes.guess_type(image_path)[0] or "image/jpeg"
    with open(image_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{data}"


async def gemini_analyze_disease(image_path: str, language: str = "hi", crop_hint: str = "") -> dict:
    """Use Nebius Qwen2.5-VL vision model to detect crop disease from image."""
    client = get_nebius_client()
    if not client:
        return None

    lang_name = {"hi": "Hindi", "en": "English", "mr": "Marathi", "gu": "Gujarati"}.get(language, "Hindi")
    crop_context = f"The crop in this image is {crop_hint}." if crop_hint else "First identify the crop."

    prompt = f"""{crop_context}
Analyze this crop image carefully and diagnose any disease. Respond in {lang_name}.

Use EXACTLY this format (labels in English, content in {lang_name}):
CROP: [crop name in English]
DISEASE: [disease name or Healthy]
SEVERITY: [none/low/medium/high/critical]
CONFIDENCE: [0-100]

EXPLANATION:
[2-3 sentences describing symptoms visible in image]

🧪 Chemical Treatment:
[specific fungicide/pesticide with exact doses ml/L or g/L]

🌿 Organic Treatment:
[neem oil, trichoderma, jeevamrit with exact doses]

Prevention:
[4 specific prevention tips]"""

    try:
        loop = asyncio.get_event_loop()
        image_data = _encode_image(image_path)

        def call_nebius():
            response = client.chat.completions.create(
                model=settings.NEBIUS_VISION_MODEL,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data}}
                    ]
                }],
                max_tokens=1024,
                temperature=0.3
            )
            return response.choices[0].message.content

        text = await asyncio.wait_for(loop.run_in_executor(None, call_nebius), timeout=45.0)

        # Parse structured response
        lines = text.strip().split("\n")
        crop = crop_hint or "Unknown Crop"
        disease = "Unknown"
        severity = "medium"
        confidence = 85

        for line in lines:
            if line.startswith("CROP:"):
                crop = line.replace("CROP:", "").strip()
            elif line.startswith("DISEASE:"):
                disease = line.replace("DISEASE:", "").strip()
            elif line.startswith("SEVERITY:"):
                severity = line.replace("SEVERITY:", "").strip().lower()
            elif line.startswith("CONFIDENCE:"):
                try:
                    confidence = int("".join(filter(str.isdigit, line.replace("CONFIDENCE:", ""))))
                except:
                    confidence = 85

        if crop_hint:
            crop = crop_hint

        exp_idx = next((i for i, l in enumerate(lines) if "EXPLANATION:" in l), 5)
        explanation = "\n".join(lines[exp_idx:]).replace("EXPLANATION:", "").strip()

        return {
            "crop": crop,
            "disease": disease,
            "confidence": min(confidence, 99),
            "severity": severity if severity in ["none", "low", "medium", "high", "critical"] else "medium",
            "explanation": explanation,
            "treatment_plan": {"raw": explanation},
            "top_predictions": [{"label": disease, "confidence": confidence}],
            "source": "nebius-vision"
        }

    except Exception as e:
        print(f"⚠️  Nebius disease analysis failed: {e}")
        return None


async def gemini_analyze_soil(soil_data: dict, language: str = "hi") -> str:
    """Use Nebius LLM for detailed soil health analysis."""
    client = get_nebius_client()
    if not client:
        return None

    lang_name = {"hi": "Hindi", "en": "English", "mr": "Marathi", "gu": "Gujarati"}.get(language, "Hindi")

    prompt = f"""You are an expert soil scientist for Indian farmers.
Analyze this soil test data and give a detailed soil health report in {lang_name}.

Soil Data:
- Soil Type: {soil_data.get('soil_type', 'Unknown')}
- pH: {soil_data.get('ph', 'N/A')}
- Nitrogen (N): {soil_data.get('nitrogen', 'N/A')} kg/ha
- Phosphorus (P): {soil_data.get('phosphorus', 'N/A')} kg/ha
- Potassium (K): {soil_data.get('potassium', 'N/A')} kg/ha
- Organic Carbon: {soil_data.get('organic_carbon', 'N/A')} %
- Zinc: {soil_data.get('zinc', 'N/A')} ppm
- Location: {soil_data.get('location_state', 'India')}, {soil_data.get('location_district', '')}

Provide detailed analysis:
1. Overall soil health rating (Poor/Average/Good/Excellent) with reason
2. Each nutrient: current value vs ideal range, status
3. Specific deficiencies and their effect on crops
4. Chemical correction: exact product names and doses (kg/acre)
5. Organic improvement: vermicompost, green manure, biofertilizers with quantities
6. pH correction steps if needed
7. 6-month soil improvement action plan

Be very specific with quantities. Respond entirely in {lang_name}."""

    try:
        loop = asyncio.get_event_loop()

        def call_nebius():
            response = client.chat.completions.create(
                model=settings.NEBIUS_TEXT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1024,
                temperature=0.3
            )
            return response.choices[0].message.content

        return await asyncio.wait_for(loop.run_in_executor(None, call_nebius), timeout=30.0)
    except Exception as e:
        print(f"⚠️  Nebius soil analysis failed: {e}")
        return None


async def gemini_crop_advisory(soil_data: dict, language: str = "hi") -> str:
    """Use Nebius LLM for detailed crop recommendations."""
    client = get_nebius_client()
    if not client:
        return None

    lang_name = {"hi": "Hindi", "en": "English", "mr": "Marathi", "gu": "Gujarati"}.get(language, "Hindi")

    prompt = f"""You are an expert agronomist for Indian farmers.
Give detailed crop recommendations based on this soil data in {lang_name}.

Soil Data:
- Soil Type: {soil_data.get('soil_type', 'Unknown')}
- pH: {soil_data.get('ph', 'N/A')}
- Nitrogen: {soil_data.get('nitrogen', 'N/A')} kg/ha
- Phosphorus: {soil_data.get('phosphorus', 'N/A')} kg/ha
- Potassium: {soil_data.get('potassium', 'N/A')} kg/ha
- Organic Carbon: {soil_data.get('organic_carbon', 'N/A')} %
- Location: {soil_data.get('location_state', 'India')}

Provide:
1. Top 5 crops best suited for this soil with reasons
2. Season (Kharif/Rabi/Zaid) and expected yield per acre for each
3. Complete fertilizer schedule (NPK in kg/acre at sowing, 30 days, 60 days)
4. Irrigation schedule (number of irrigations and crop stages)
5. Crop rotation plan for next 2 years
6. Relevant government schemes (PM-KISAN, PMFBY, Soil Health Card etc)

Be specific with quantities. Respond entirely in {lang_name}."""

    try:
        loop = asyncio.get_event_loop()

        def call_nebius():
            response = client.chat.completions.create(
                model=settings.NEBIUS_TEXT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1024,
                temperature=0.3
            )
            return response.choices[0].message.content

        return await asyncio.wait_for(loop.run_in_executor(None, call_nebius), timeout=30.0)
    except Exception as e:
        print(f"⚠️  Nebius crop advisory failed: {e}")
        return None


async def gemini_ocr_soil_card(image_path: str) -> dict:
    """Use Nebius vision model to extract soil data from soil health card."""
    client = get_nebius_client()
    if not client:
        return None

    prompt = """Extract all soil test values from this Soil Health Card image.
Return ONLY a valid JSON object with these exact keys (null for missing):
{
  "ph": <number>,
  "nitrogen": <number in kg/ha>,
  "phosphorus": <number in kg/ha>,
  "potassium": <number in kg/ha>,
  "organic_carbon": <number in %>,
  "zinc": <number in ppm>,
  "iron": <number in ppm>,
  "soil_type": "<exact text e.g. Sandy Loam, Black Cotton, Alluvial, Red, Laterite>",
  "location": "<district or village name>"
}
Read every value carefully. Return only the JSON, no other text."""

    try:
        loop = asyncio.get_event_loop()
        image_data = _encode_image(image_path)

        def call_nebius():
            response = client.chat.completions.create(
                model=settings.NEBIUS_VISION_MODEL,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data}}
                    ]
                }],
                max_tokens=512,
                temperature=0.1
            )
            return response.choices[0].message.content

        text = await asyncio.wait_for(loop.run_in_executor(None, call_nebius), timeout=30.0)

        import json, re
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        return None
    except Exception as e:
        print(f"⚠️  Nebius OCR failed: {e}")
        return None
