from deep_translator import GoogleTranslator

LANGUAGE_CODES = {
    "en": "english",
    "hi": "hindi",
    "mr": "marathi",
    "gu": "gujarati",
}

GOOGLE_LANG_CODES = {
    "en": "en",
    "hi": "hi",
    "mr": "mr",
    "gu": "gu",
}


def translate_text(text: str, target_lang: str, source_lang: str = "auto") -> str:
    """Translate text using Google Translate (free tier via deep-translator)."""
    if not text or target_lang == source_lang:
        return text

    target = GOOGLE_LANG_CODES.get(target_lang, "hi")

    try:
        translator = GoogleTranslator(source=source_lang, target=target)
        # Split long text into chunks (deep-translator limit: 5000 chars)
        if len(text) <= 4500:
            return translator.translate(text)
        else:
            chunks = [text[i:i+4500] for i in range(0, len(text), 4500)]
            return " ".join(translator.translate(chunk) for chunk in chunks)
    except Exception as e:
        return text  # Fallback: return original


def detect_language(text: str) -> str:
    """Simple language detection based on character ranges."""
    devanagari_count = sum(1 for c in text if '\u0900' <= c <= '\u097F')
    gujarati_count = sum(1 for c in text if '\u0A80' <= c <= '\u0AFF')

    total = len(text)
    if total == 0:
        return "en"

    if devanagari_count / total > 0.3:
        return "hi"  # Could be Hindi or Marathi - default to Hindi
    elif gujarati_count / total > 0.3:
        return "gu"
    else:
        return "en"
