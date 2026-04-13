import os
import asyncio
from PIL import Image

# ── Model setup ──────────────────────────────────────────────────────────────
# Uses linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification
# Trained on PlantVillage — 38 classes, free on HuggingFace
_pipeline = None
HF_MODEL = "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        try:
            from transformers import pipeline
            import torch
            print("📥 Loading plant disease model from HuggingFace (first run ~500MB)...")
            _pipeline = pipeline(
                "image-classification",
                model=HF_MODEL,
                top_k=3,
            )
            print("✅ Plant disease model loaded")
        except ImportError:
            print("⚠️  transformers/torch not installed — HuggingFace fallback disabled")
            _pipeline = None
        except Exception as e:
            print(f"⚠️  HuggingFace model load failed: {e}")
            _pipeline = None
    return _pipeline


# ── Disease metadata ──────────────────────────────────────────────────────────
SEVERITY_MAP = {
    "healthy": "none",
    "rust":    "high",
    "blight":  "high",
    "scab":    "medium",
    "mildew":  "medium",
    "spot":    "medium",
    "mold":    "medium",
    "virus":   "critical",
    "mites":   "low",
    "rot":     "high",
    "curl":    "high",
    "mosaic":  "high",
}

# Fast template responses per disease keyword
TEMPLATES = {
    "rust": {
        "hi": "**पत्ती रस्ट (Leaf Rust) रोग पाया गया** 🟠\n\n**कारण:** Puccinia triticina फफूंद\n\n**🧪 रासायनिक उपचार:**\n- प्रोपिकोनाज़ोल 25 EC @ 1 मिली/लीटर पानी में छिड़काव करें\n- टेबुकोनाज़ोल 250 EC @ 1 मिली/लीटर\n- 10-15 दिन बाद दोबारा छिड़काव करें\n\n**🌿 जैविक उपचार:**\n- नीम तेल 5 मिली/लीटर पानी में मिलाकर छिड़काव करें\n- ट्राइकोडर्मा विरिडी 5 ग्राम/लीटर का छिड़काव करें\n- गोमूत्र 10% घोल का छिड़काव करें\n- लहसुन-मिर्च का काढ़ा (100 ग्राम/10 लीटर) छिड़कें\n\n**बचाव:**\n- रोग प्रतिरोधी किस्में लगाएं (HD 2967, PBW 343)\n- समय पर बुवाई करें\n- खेत में जल निकासी सुधारें\n\n**गंभीरता:** अधिक — तुरंत उपाय करें",
        "en": "**Leaf Rust detected** 🟠\n\n**Cause:** Puccinia triticina fungus\n\n**🧪 Chemical Treatment:**\n- Spray Propiconazole 25 EC @ 1 ml/L water\n- Tebuconazole 250 EC @ 1 ml/L\n- Repeat spray after 10-15 days\n\n**🌿 Organic Treatment:**\n- Neem oil spray @ 5 ml/L water\n- Trichoderma viride @ 5 g/L foliar spray\n- Cow urine 10% solution spray\n- Garlic-chilli extract (100g/10L) spray\n\n**Prevention:**\n- Use resistant varieties (HD 2967, PBW 343)\n- Timely sowing\n- Improve field drainage\n\n**Severity:** High — act immediately",
    },
    "blight": {
        "hi": "**ब्लाइट रोग पाया गया** 🔴\n\n**🧪 रासायनिक उपचार:**\n- मैंकोजेब 75 WP @ 2.5 ग्राम/लीटर छिड़काव\n- मेटालैक्सिल + मैंकोजेब @ 2.5 ग्राम/लीटर\n\n**🌿 जैविक उपचार:**\n- बोर्डो मिश्रण (1%) का छिड़काव करें\n- ट्राइकोडर्मा हार्जियानम @ 5 ग्राम/लीटर\n- नीम केक 250 किग्रा/हेक्टेयर मिट्टी में मिलाएं\n\n**बचाव:**\n- संक्रमित पत्तियां तुरंत हटाएं\n- फसल चक्र अपनाएं\n\n**गंभीरता:** अधिक",
        "en": "**Blight detected** 🔴\n\n**🧪 Chemical Treatment:**\n- Mancozeb 75 WP @ 2.5 g/L\n- Metalaxyl + Mancozeb @ 2.5 g/L\n\n**🌿 Organic Treatment:**\n- Bordeaux mixture (1%) spray\n- Trichoderma harzianum @ 5 g/L foliar spray\n- Neem cake 250 kg/ha soil application\n\n**Prevention:**\n- Remove infected leaves immediately\n- Practice crop rotation\n\n**Severity:** High",
    },
    "mildew": {
        "hi": "**पाउडरी मिल्ड्यू रोग पाया गया** ⚪\n\n**🧪 रासायनिक उपचार:**\n- सल्फर 80 WP @ 3 ग्राम/लीटर छिड़काव\n- कार्बेन्डाजिम 50 WP @ 1 ग्राम/लीटर\n\n**🌿 जैविक उपचार:**\n- बेकिंग सोडा 5 ग्राम/लीटर + नीम तेल 3 मिली/लीटर\n- दूध 10% घोल का छिड़काव (सप्ताह में 2 बार)\n- जीवामृत का छिड़काव करें\n\n**बचाव:**\n- पौधों के बीच उचित दूरी रखें\n- नमी कम करें\n\n**गंभीरता:** मध्यम",
        "en": "**Powdery Mildew detected** ⚪\n\n**🧪 Chemical Treatment:**\n- Sulfur 80 WP @ 3 g/L\n- Carbendazim 50 WP @ 1 g/L\n\n**🌿 Organic Treatment:**\n- Baking soda 5g/L + Neem oil 3ml/L spray\n- Milk 10% solution spray (twice a week)\n- Jeevamrit foliar spray\n\n**Prevention:**\n- Maintain proper plant spacing\n- Reduce humidity\n\n**Severity:** Medium",
    },
    "spot": {
        "hi": "**लीफ स्पॉट रोग पाया गया** 🟡\n\n**🧪 रासायनिक उपचार:**\n- कॉपर ऑक्सीक्लोराइड 50 WP @ 3 ग्राम/लीटर\n- क्लोरोथालोनिल 75 WP @ 2 ग्राम/लीटर\n\n**🌿 जैविक उपचार:**\n- नीम तेल 5 मिली/लीटर + हल्दी पाउडर 2 ग्राम/लीटर\n- स्यूडोमोनास फ्लोरेसेंस @ 5 ग्राम/लीटर\n- बोर्डो मिश्रण 0.5% का छिड़काव\n\n**बचाव:**\n- रोगमुक्त बीज उपयोग करें\n- खेत साफ रखें\n\n**गंभीरता:** मध्यम",
        "en": "**Leaf Spot detected** 🟡\n\n**🧪 Chemical Treatment:**\n- Copper oxychloride 50 WP @ 3 g/L\n- Chlorothalonil 75 WP @ 2 g/L\n\n**🌿 Organic Treatment:**\n- Neem oil 5ml/L + Turmeric powder 2g/L spray\n- Pseudomonas fluorescens @ 5 g/L foliar spray\n- Bordeaux mixture 0.5% spray\n\n**Prevention:**\n- Use disease-free seeds\n- Keep field clean\n\n**Severity:** Medium",
    },
    "virus": {
        "hi": "**वायरस रोग पाया गया** 🔴\n\n**🧪 रासायनिक उपचार:**\n- वायरस का कोई सीधा इलाज नहीं\n- वाहक कीट (सफेद मक्खी/एफिड) नियंत्रण करें\n- इमिडाक्लोप्रिड 17.8 SL @ 0.5 मिली/लीटर\n\n**🌿 जैविक उपचार:**\n- नीम तेल 5 मिली/लीटर से वाहक कीट नियंत्रण\n- पीले चिपचिपे ट्रैप लगाएं\n- संक्रमित पौधे तुरंत उखाड़ें\n\n**बचाव:**\n- रोग प्रतिरोधी किस्में लगाएं\n- संक्रमित पौधे उखाड़ें\n\n**गंभीरता:** गंभीर",
        "en": "**Virus disease detected** 🔴\n\n**🧪 Chemical Treatment:**\n- No direct cure for virus\n- Control vector insects (whitefly/aphid)\n- Imidacloprid 17.8 SL @ 0.5 ml/L\n\n**🌿 Organic Treatment:**\n- Neem oil 5ml/L to control vector insects\n- Install yellow sticky traps\n- Remove infected plants immediately\n\n**Prevention:**\n- Use resistant varieties\n- Remove infected plants\n\n**Severity:** Critical",
    },
    "healthy": {
        "hi": "**फसल स्वस्थ है** ✅\n\n**रखरखाव सुझाव:**\n- हर 7 दिन में निगरानी करें\n- उचित सिंचाई और उर्वरक दें\n- कीट हमले के शुरुआती संकेतों पर ध्यान दें\n- मौसम के अनुसार निवारक छिड़काव करें\n\n**🌿 निवारक जैविक उपाय:**\n- जीवामृत का महीने में एक बार छिड़काव\n- नीम केक मिट्टी में मिलाएं",
        "en": "**Crop is Healthy** ✅\n\n**Maintenance Tips:**\n- Monitor every 7 days\n- Maintain proper irrigation and fertilization\n- Watch for early pest signs\n- Apply preventive spray as per season\n\n**🌿 Preventive Organic Measures:**\n- Monthly Jeevamrit foliar spray\n- Neem cake soil application",
    },
    "scab": {
        "hi": "**स्कैब रोग पाया गया**\n\n**🧪 रासायनिक उपचार:**\n- कैप्टान 50 WP @ 2.5 ग्राम/लीटर\n- थायरम 75 WP @ 2.5 ग्राम/लीटर\n\n**🌿 जैविक उपचार:**\n- बोर्डो मिश्रण 1% का छिड़काव\n- नीम तेल 5 मिली/लीटर\n\n**गंभीरता:** मध्यम",
        "en": "**Scab detected**\n\n**🧪 Chemical Treatment:**\n- Captan 50 WP @ 2.5 g/L\n- Thiram 75 WP @ 2.5 g/L\n\n**🌿 Organic Treatment:**\n- Bordeaux mixture 1% spray\n- Neem oil 5 ml/L spray\n\n**Severity:** Medium",
    },
    "rot": {
        "hi": "**रॉट (सड़न) रोग पाया गया** 🔴\n\n**🧪 रासायनिक उपचार:**\n- कार्बेन्डाजिम 50 WP @ 1 ग्राम/लीटर\n- थायोफेनेट मिथाइल @ 1 ग्राम/लीटर\n\n**🌿 जैविक उपचार:**\n- ट्राइकोडर्मा विरिडी 5 ग्राम/लीटर मिट्टी में मिलाएं\n- नीम केक 250 किग्रा/हेक्टेयर\n- जल निकासी सुधारें\n\n**बचाव:**\n- जल निकासी सुधारें\n- संक्रमित फल/पत्तियां हटाएं\n\n**गंभीरता:** अधिक",
        "en": "**Rot detected** 🔴\n\n**🧪 Chemical Treatment:**\n- Carbendazim 50 WP @ 1 g/L\n- Thiophanate methyl @ 1 g/L\n\n**🌿 Organic Treatment:**\n- Trichoderma viride 5 g/L soil drench\n- Neem cake 250 kg/ha soil application\n- Improve drainage\n\n**Prevention:**\n- Improve drainage\n- Remove infected fruits/leaves\n\n**Severity:** High",
    },
}


def get_severity(label: str) -> str:
    label_lower = label.lower()
    for keyword, severity in SEVERITY_MAP.items():
        if keyword in label_lower:
            return severity
    return "medium"


def get_template(label: str, language: str) -> str:
    label_lower = label.lower()
    lang = language if language in ("hi", "en") else "hi"
    for keyword, templates in TEMPLATES.items():
        if keyword in label_lower:
            return templates.get(lang, templates["en"])
    # Generic fallback
    disease_name = label.replace("_", " ").replace("___", " — ")
    if lang == "hi":
        return f"**{disease_name} रोग पाया गया**\n\n**उपचार:** नजदीकी कृषि केंद्र से संपर्क करें।\n**बचाव:** संक्रमित पत्तियां हटाएं, फसल चक्र अपनाएं।\n**गंभीरता:** मध्यम"
    return f"**{disease_name} detected**\n\n**Treatment:** Contact your local agriculture center.\n**Prevention:** Remove infected leaves, practice crop rotation.\n**Severity:** Medium"


async def detect_disease(image_path: str, language: str = "hi", crop_hint: str = "") -> dict:
    # Try Nebius Vision first (best accuracy)
    try:
        from app.services.ai.gemini_service import gemini_analyze_disease
        result = await gemini_analyze_disease(image_path, language, crop_hint)
        if result:
            # Enrich with structured fields
            return await _enrich_result(result, language)
    except Exception:
        pass

    # Fallback: HuggingFace model
    pipe = get_pipeline()
    if pipe is None:
        return {
            "crop": crop_hint or "Unknown", "disease": "Model not loaded",
            "confidence": 0, "severity": "none",
            "explanation": "Please install transformers: pip install transformers",
            "treatment_plan": {"raw": ""}
        }

    loop = asyncio.get_event_loop()
    img = Image.open(image_path).convert("RGB")
    results = await loop.run_in_executor(None, lambda: pipe(img))

    top = results[0]
    label: str = top["label"]
    score: float = top["score"]

    if crop_hint:
        hint_lower = crop_hint.lower().split()[0]
        for r in results:
            if hint_lower in r["label"].lower():
                top = r; label = r["label"]; score = r["score"]; break

    parts = label.split("___")
    crop = crop_hint or (parts[0].replace("_", " ") if len(parts) > 1 else "Crop")
    disease = parts[1].replace("_", " ") if len(parts) > 1 else label.replace("_", " ")
    confidence = round(score * 100, 1)
    severity = get_severity(label)
    explanation = get_template(label, language)

    # Search disease knowledge base
    try:
        from app.services.rag.disease_rag import get_enhanced_disease_context
        kb_text = await get_enhanced_disease_context(crop, disease, language)
        if kb_text and len(kb_text) > 100:
            explanation = kb_text
    except Exception:
        pass

    # Fallback to LLM
    if len(explanation) < 100:
        try:
            from app.services.ai.llm_service import run_chain
            lang_name = {"hi": "Hindi", "en": "English", "mr": "Marathi", "gu": "Gujarati"}.get(language, "Hindi")
            system = f"""You are an expert plant pathologist for Indian farmers. Respond in {lang_name}.
Give detailed disease management with organic and chemical options, doses, urgency, yield impact."""
            prompt = f"Crop: {crop}, Disease: {disease}, Severity: {severity}\nGive complete treatment guide."
            llm_text = await asyncio.wait_for(run_chain(system, prompt), timeout=25.0)
            if llm_text and len(llm_text) > 100:
                explanation = llm_text
        except Exception:
            pass

    base_result = {
        "crop": crop, "disease": disease, "confidence": confidence,
        "severity": severity, "explanation": explanation,
        "treatment_plan": {"raw": explanation},
        "top_predictions": [
            {"label": r["label"].split("___")[-1].replace("_", " "),
             "confidence": round(r["score"] * 100, 1)} for r in results
        ]
    }
    return await _enrich_result(base_result, language)


async def _enrich_result(result: dict, language: str) -> dict:
    """Add structured advisory fields to disease result."""
    crop = result.get("crop", "")
    disease = result.get("disease", "")
    severity = result.get("severity", "medium")
    lang = language if language in ("hi", "en") else "hi"

    # Urgency based on severity
    urgency_map = {
        "critical": {"hi": "🚨 तुरंत उपाय करें — 24 घंटे के अंदर", "en": "🚨 Immediate action — within 24 hours"},
        "high":     {"hi": "⚠️ 2-3 दिन के अंदर उपाय करें",         "en": "⚠️ Act within 2-3 days"},
        "medium":   {"hi": "📋 1 सप्ताह के अंदर उपाय करें",        "en": "📋 Act within 1 week"},
        "low":      {"hi": "✅ निगरानी जारी रखें",                   "en": "✅ Continue monitoring"},
        "none":     {"hi": "✅ फसल स्वस्थ है",                       "en": "✅ Crop is healthy"},
    }

    # Yield impact based on severity
    yield_impact_map = {
        "critical": {"hi": "उपचार न करने पर 50-70% उपज हानि संभव",  "en": "50-70% yield loss possible without treatment"},
        "high":     {"hi": "उपचार न करने पर 20-40% उपज हानि संभव",  "en": "20-40% yield loss possible without treatment"},
        "medium":   {"hi": "उपचार न करने पर 10-20% उपज हानि संभव",  "en": "10-20% yield loss possible without treatment"},
        "low":      {"hi": "5-10% उपज पर असर हो सकता है",            "en": "5-10% yield impact possible"},
        "none":     {"hi": "कोई उपज हानि नहीं",                       "en": "No yield loss expected"},
    }

    # Preventive measures
    prevention_map = {
        "hi": [
            "रोग प्रतिरोधी किस्में लगाएं",
            "फसल चक्र अपनाएं (हर 2-3 साल में)",
            "खेत में जल निकासी सुधारें",
            "संक्रमित पौधे तुरंत हटाएं",
            "बीज उपचार करके बुवाई करें",
            "नियमित निगरानी करें (हर 7 दिन)",
        ],
        "en": [
            "Use disease-resistant varieties",
            "Practice crop rotation (every 2-3 years)",
            "Improve field drainage",
            "Remove infected plants immediately",
            "Treat seeds before sowing",
            "Regular monitoring (every 7 days)",
        ]
    }

    result["urgency"] = urgency_map.get(severity, urgency_map["medium"])[lang]
    result["yield_impact"] = yield_impact_map.get(severity, yield_impact_map["medium"])[lang]
    result["preventive_measures"] = prevention_map[lang]
    result["scientific_name"] = _get_scientific_name(disease)
    result["affected_area_estimate"] = _estimate_affected_area(severity)

    return result


def _get_scientific_name(disease: str) -> str:
    disease_lower = disease.lower()
    scientific = {
        "leaf rust": "Puccinia triticina",
        "rust": "Puccinia spp.",
        "blight": "Alternaria solani / Phytophthora infestans",
        "powdery mildew": "Erysiphe graminis",
        "mildew": "Erysiphe spp.",
        "leaf spot": "Cercospora spp.",
        "mosaic": "Tobacco Mosaic Virus (TMV)",
        "bacterial blight": "Xanthomonas oryzae",
        "blast": "Magnaporthe oryzae",
        "smut": "Ustilago spp.",
        "rot": "Fusarium spp.",
        "wilt": "Fusarium oxysporum",
    }
    for key, name in scientific.items():
        if key in disease_lower:
            return name
    return ""


def _estimate_affected_area(severity: str) -> str:
    return {
        "critical": "60-80% leaf area affected",
        "high": "30-60% leaf area affected",
        "medium": "10-30% leaf area affected",
        "low": "< 10% leaf area affected",
        "none": "No infection detected",
    }.get(severity, "Unknown")
