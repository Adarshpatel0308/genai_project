from app.services.ai.llm_service import run_chain, CROP_SYSTEM_PROMPT

# Rule-based crop suitability database
CROP_DATABASE = {
    "wheat": {"ph": (6.0, 7.5), "n": (80, 120), "p": (40, 60), "k": (40, 60), "season": "rabi"},
    "rice": {"ph": (5.5, 7.0), "n": (100, 150), "p": (30, 50), "k": (40, 60), "season": "kharif"},
    "cotton": {"ph": (6.0, 8.0), "n": (60, 100), "p": (30, 50), "k": (30, 50), "season": "kharif"},
    "sugarcane": {"ph": (6.0, 7.5), "n": (150, 200), "p": (60, 80), "k": (80, 100), "season": "annual"},
    "soybean": {"ph": (6.0, 7.0), "n": (20, 40), "p": (40, 60), "k": (40, 60), "season": "kharif"},
    "maize": {"ph": (5.8, 7.0), "n": (100, 150), "p": (50, 70), "k": (40, 60), "season": "kharif"},
    "tomato": {"ph": (6.0, 7.0), "n": (80, 120), "p": (60, 80), "k": (80, 100), "season": "rabi"},
    "onion": {"ph": (6.0, 7.5), "n": (60, 80), "p": (40, 60), "k": (60, 80), "season": "rabi"},
    "groundnut": {"ph": (6.0, 7.0), "n": (20, 40), "p": (40, 60), "k": (40, 60), "season": "kharif"},
    "chickpea": {"ph": (6.0, 8.0), "n": (20, 40), "p": (40, 60), "k": (20, 40), "season": "rabi"},
}

ROTATION_PLANS = {
    "wheat": ["soybean", "maize", "chickpea"],
    "rice": ["wheat", "mustard", "chickpea"],
    "cotton": ["wheat", "chickpea", "soybean"],
    "maize": ["wheat", "soybean", "chickpea"],
    "soybean": ["wheat", "maize", "cotton"],
}


def score_crop(crop_data: dict, soil: dict) -> float:
    score = 0
    ph = soil.get("ph", 7.0) or 7.0
    n = soil.get("nitrogen", 80) or 80
    p = soil.get("phosphorus", 40) or 40
    k = soil.get("potassium", 40) or 40

    ph_range = crop_data["ph"]
    if ph_range[0] <= ph <= ph_range[1]:
        score += 30
    elif abs(ph - ph_range[0]) < 0.5 or abs(ph - ph_range[1]) < 0.5:
        score += 15

    for val, key_range in [(n, "n"), (p, "p"), (k, "k")]:
        r = crop_data[key_range]
        if r[0] <= val <= r[1]:
            score += 20
        elif val >= r[0] * 0.7:
            score += 10

    return score


def get_rule_based_recommendations(soil_data: dict) -> list:
    scores = []
    for crop, data in CROP_DATABASE.items():
        s = score_crop(data, soil_data)
        scores.append({"crop": crop, "score": s, "season": data["season"]})
    scores.sort(key=lambda x: x["score"], reverse=True)
    return scores[:5]


async def get_crop_recommendations(soil_data: dict, language: str = "hi") -> dict:
    rule_recs = get_rule_based_recommendations(soil_data)
    top_crops = [r["crop"] for r in rule_recs[:3]]

    # Try Gemini first for detailed AI analysis
    ai_explanation = None
    try:
        from app.services.ai.gemini_service import gemini_crop_advisory
        result = await gemini_crop_advisory(soil_data, language)
        if result:
            ai_explanation = result
    except Exception:
        pass

    # Search soil knowledge base to enrich the response
    try:
        from app.services.rag.disease_rag import search_soil_knowledge
        soil_query = f"soil type {soil_data.get('soil_type','')} pH {soil_data.get('ph','')} crop recommendation {' '.join(top_crops)}"
        kb_context = search_soil_knowledge(soil_query, k=3)
        if kb_context and len(kb_context) > 100 and not ai_explanation:
            system = f"""You are an expert agronomist for Indian farmers. Use the knowledge base info below.
Respond in {'Hindi' if language == 'hi' else 'English'}. Give specific crop recommendations with fertilizer doses."""
            prompt = f"Soil: {soil_data}\n\nKnowledge Base:\n{kb_context[:2000]}\n\nGive crop recommendations."
            import asyncio
            from app.services.ai.llm_service import run_chain
            kb_result = await asyncio.wait_for(run_chain(system, prompt), timeout=20.0)
            if kb_result and len(kb_result) > 100:
                ai_explanation = kb_result
    except Exception:
        pass

    # Fallback to Groq if Gemini unavailable
    if not ai_explanation:
        try:
            import asyncio
            soil_summary = f"Soil Type: {soil_data.get('soil_type')}, pH: {soil_data.get('ph')}, N: {soil_data.get('nitrogen')}, P: {soil_data.get('phosphorus')}, K: {soil_data.get('potassium')}, State: {soil_data.get('location_state', 'India')}, Top crops: {', '.join(top_crops)}"
            system = CROP_SYSTEM_PROMPT.format(language=language)
            ai_explanation = await asyncio.wait_for(run_chain(system, soil_summary), timeout=15.0)
        except Exception:
            pass

    # Final fallback — static template
    if not ai_explanation:
        if language == "hi":
            ai_explanation = f"""**मिट्टी विश्लेषण के आधार पर सिफारिश:**

**शीर्ष फसलें:** {', '.join(top_crops)}

**उर्वरक सुझाव:**
- pH {soil_data.get('ph', 'N/A')}: {'चूना डालें (2-4 टन/हेक्टेयर)' if (soil_data.get('ph') or 7) < 6.5 else 'जिप्सम डालें' if (soil_data.get('ph') or 7) > 7.5 else 'pH सामान्य है'}
- नाइट्रोजन: {'कम है, यूरिया डालें' if (soil_data.get('nitrogen') or 80) < 80 else 'पर्याप्त है'}
- फास्फोरस: {'कम है, DAP डालें' if (soil_data.get('phosphorus') or 40) < 40 else 'पर्याप्त है'}

**फसल चक्र:** {top_crops[0] if top_crops else 'गेहूं'} के बाद {ROTATION_PLANS.get(top_crops[0], ['दलहन'])[0] if top_crops else 'दलहन'} लगाएं

**सिंचाई:** बुवाई के 20-25 दिन बाद पहली सिंचाई करें"""
        else:
            ai_explanation = f"""**Recommendation based on soil analysis:**

**Top Crops:** {', '.join(top_crops)}

**Fertilizer Advice:**
- pH {soil_data.get('ph', 'N/A')}: {'Apply lime 2-4 t/ha' if (soil_data.get('ph') or 7) < 6.5 else 'Apply gypsum' if (soil_data.get('ph') or 7) > 7.5 else 'pH is optimal'}
- Nitrogen: {'Low — apply Urea' if (soil_data.get('nitrogen') or 80) < 80 else 'Adequate'}
- Phosphorus: {'Low — apply DAP' if (soil_data.get('phosphorus') or 40) < 40 else 'Adequate'}

**Crop Rotation:** After {top_crops[0] if top_crops else 'wheat'}, grow {ROTATION_PLANS.get(top_crops[0], ['legume'])[0] if top_crops else 'legume'}

**Irrigation:** First irrigation 20-25 days after sowing"""

    rotation = []
    if top_crops:
        rotation = ROTATION_PLANS.get(top_crops[0], [top_crops[1]] if len(top_crops) > 1 else [])

    return {
        "recommended_crops": rule_recs[:5],
        "rotation_plan": rotation,
        "ai_explanation": ai_explanation,
        "fertilizer_plan": _generate_fertilizer_plan(soil_data, top_crops[0] if top_crops else "wheat"),
        "irrigation_schedule": _generate_irrigation_schedule(top_crops[0] if top_crops else "wheat")
    }


def _generate_fertilizer_plan(soil: dict, crop: str) -> dict:
    crop_data = CROP_DATABASE.get(crop, CROP_DATABASE["wheat"])
    current_n = soil.get("nitrogen", 0) or 0
    current_p = soil.get("phosphorus", 0) or 0
    current_k = soil.get("potassium", 0) or 0

    return {
        "crop": crop,
        "urea_kg_per_acre": max(0, round((crop_data["n"][0] - current_n) * 0.43 / 2.47, 1)),
        "dap_kg_per_acre": max(0, round((crop_data["p"][0] - current_p) * 0.46 / 2.47, 1)),
        "mop_kg_per_acre": max(0, round((crop_data["k"][0] - current_k) * 0.6 / 2.47, 1)),
        "application_schedule": ["Basal: 50% at sowing", "Top dress: 25% at 30 days", "Top dress: 25% at 60 days"]
    }


def _generate_irrigation_schedule(crop: str) -> list:
    schedules = {
        "wheat": [{"stage": "Sowing", "days": 0}, {"stage": "Crown root", "days": 21},
                  {"stage": "Tillering", "days": 45}, {"stage": "Jointing", "days": 65},
                  {"stage": "Flowering", "days": 85}, {"stage": "Grain filling", "days": 105}],
        "rice": [{"stage": "Transplanting", "days": 0}, {"stage": "Tillering", "days": 20},
                 {"stage": "Panicle initiation", "days": 55}, {"stage": "Flowering", "days": 75}],
    }
    return schedules.get(crop, [{"stage": "As needed", "days": 0}])
