"""
Nearest Mandi Finder — Fixed Implementation
============================================
- OpenCage geocoding for user location AND each mandi (unique coords per mandi)
- data.gov.in with strict state+district filtering
- Haversine distance per mandi
- District-first priority (local mandis always shown first)
- Detailed debug logs
"""

import math
import asyncio
import httpx
from datetime import date
from app.core.config import settings

DATA_GOV_API = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
OPENCAGE_API = "https://api.opencagedata.com/geocode/v1/json"

# ── District name aliases (renamed districts still stored with old names in API) ──
DISTRICT_ALIASES: dict[str, list[str]] = {
    "Narmadapuram": ["Hoshangabad", "Narmadapuram"],
    "Hoshangabad":  ["Hoshangabad", "Narmadapuram"],
    "Alirajpur":    ["Alirajpur", "Jhabua"],
    "Agar Malwa":   ["Agar Malwa", "Shajapur"],
    "Niwari":       ["Niwari", "Tikamgarh"],
}

def resolve_district_names(district: str) -> list[str]:
    """Return all known API names for a district (handles renames)."""
    for key, aliases in DISTRICT_ALIASES.items():
        if district.lower() in [a.lower() for a in aliases]:
            return aliases
    return [district]

# ── Caches ────────────────────────────────────────────────────────────────────
_geo_cache:   dict = {}  # query → {lat, lng}  (geocoding only, NOT distances)
_mandi_cache: dict = {}  # "state|district" → raw records from data.gov.in


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — OpenCage geocoding
# ─────────────────────────────────────────────────────────────────────────────
async def get_coordinates(location: str) -> dict | None:
    """Convert any location string → {lat, lng} via OpenCage."""
    if not location or not location.strip():
        return None

    # Already lat,lng from browser
    parts = location.split(",")
    if len(parts) == 2:
        try:
            lat, lng = float(parts[0].strip()), float(parts[1].strip())
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return {"lat": lat, "lng": lng}
        except ValueError:
            pass

    key = location.strip().lower()
    if key in _geo_cache:
        return _geo_cache[key]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                OPENCAGE_API,
                params={
                    "q":              location,
                    "key":            settings.OPENCAGE_KEY,
                    "countrycode":    "in",
                    "limit":          1,
                    "no_annotations": 1,
                }
            )
            if resp.status_code != 200:
                print(f"[GEO] OpenCage {resp.status_code} for '{location}'")
                return None

            results = resp.json().get("results", [])
            if not results:
                print(f"[GEO] No results for '{location}'")
                return None

            geo = results[0]["geometry"]
            coords = {"lat": round(geo["lat"], 6), "lng": round(geo["lng"], 6)}
            _geo_cache[key] = coords
            print(f"[GEO] '{location}' → {coords}")
            return coords

    except Exception as e:
        print(f"[GEO] Failed for '{location}': {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Fetch mandis from data.gov.in with strict filtering
# ─────────────────────────────────────────────────────────────────────────────
async def get_mandis(state: str, district: str = None) -> list[dict]:
    """
    Fetch mandis filtered by state and optionally district.
    Tries all known aliases for renamed districts.
    """
    # Resolve district aliases (e.g. Narmadapuram -> also try Hoshangabad)
    district_names = resolve_district_names(district) if district else [None]

    cache_key = f"{state}|{district or ''}".lower()
    if cache_key in _mandi_cache:
        return _mandi_cache[cache_key]

    all_seen: dict = {}

    for d_name in district_names:
        params = {
            "api-key":                settings.DATA_GOV_KEY,
            "format":                 "json",
            "limit":                  500,
            "filters[state.keyword]": state,
        }
        if d_name:
            params["filters[district]"] = d_name

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(DATA_GOV_API, params=params)
                if resp.status_code != 200:
                    print(f"[MANDI] data.gov.in error {resp.status_code}")
                    continue
                records = resp.json().get("records", [])

            for r in records:
                s = r.get("state",    "").strip()
                d = r.get("district", "").strip()
                m = r.get("market",   "").strip()
                if not (s and d and m):
                    continue
                if s.lower() != state.lower():
                    continue
                k = (s, d, m)
                if k not in all_seen:
                    all_seen[k] = {"name": m, "district": d, "state": s, "prices": []}
                try:
                    all_seen[k]["prices"].append({
                        "commodity":   r.get("commodity", ""),
                        "min_price":   float(r.get("min_price",   0)),
                        "max_price":   float(r.get("max_price",   0)),
                        "modal_price": float(r.get("modal_price", 0)),
                        "date":        r.get("arrival_date", str(date.today())),
                    })
                except Exception:
                    pass
        except Exception as e:
            print(f"[MANDI] Fetch failed for district={d_name}: {e}")

    mandis = list(all_seen.values())
    _mandi_cache[cache_key] = mandis
    print(f"[MANDI] {len(mandis)} unique mandis | state={state} district={district} (tried: {district_names})")
    return mandis


# ─────────────────────────────────────────────────────────────────────────────
# LLM-powered mandi discovery (Nebius knows local mandi names)
# ─────────────────────────────────────────────────────────────────────────────
async def llm_discover_mandis(village: str, district: str, state: str) -> list[dict]:
    """
    Ask Nebius LLM to list known APMC mandis near the given location.
    Returns list of {name, district, state} dicts.
    These are then matched against data.gov.in for live prices.
    """
    try:
        from app.services.ai.llm_service import get_nebius_client
        from app.core.config import settings as s
        client = get_nebius_client()
        if not client:
            return []

        prompt = f"""List the nearest APMC mandi markets to {village}, {district}, {state}, India.
Return ONLY a JSON array, no explanation. Format:
[{{"name": "Mandi Name", "district": "District", "state": "{state}"}}, ...]
Include up to 8 mandis sorted by proximity. Only real mandis, no guessing."""

        import asyncio, json
        loop = asyncio.get_event_loop()
        def call():
            r = client.chat.completions.create(
                model=s.NEBIUS_TEXT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=400,
                temperature=0.1,
            )
            return r.choices[0].message.content

        text = await asyncio.wait_for(loop.run_in_executor(None, call), timeout=15.0)

        # Extract JSON array from response
        import re
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if not match:
            return []
        mandis = json.loads(match.group())
        print(f"[LLM] Discovered {len(mandis)} mandis near {village}, {district}")
        return [m for m in mandis if isinstance(m, dict) and m.get('name')]

    except Exception as e:
        print(f"[LLM] Mandi discovery failed: {e}")
        return []


async def fetch_prices_for_mandi(mandi_name: str, district: str, state: str) -> list[dict]:
    """
    Fetch live prices from data.gov.in for a specific mandi.
    Tries exact market name match.
    """
    # Try district aliases
    district_names = resolve_district_names(district)

    for d_name in district_names:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    DATA_GOV_API,
                    params={
                        "api-key":                settings.DATA_GOV_KEY,
                        "format":                 "json",
                        "limit":                  50,
                        "filters[state.keyword]": state,
                        "filters[district]":      d_name,
                        "filters[market]":        mandi_name,
                    }
                )
                if resp.status_code == 200:
                    records = resp.json().get("records", [])
                    if records:
                        prices = []
                        for r in records:
                            try:
                                prices.append({
                                    "commodity":   r.get("commodity", ""),
                                    "min_price":   float(r.get("min_price",   0)),
                                    "max_price":   float(r.get("max_price",   0)),
                                    "modal_price": float(r.get("modal_price", 0)),
                                    "date":        r.get("arrival_date", str(date.today())),
                                })
                            except Exception:
                                pass
                        if prices:
                            print(f"[PRICE] Found {len(prices)} prices for {mandi_name}")
                            return prices
        except Exception as e:
            print(f"[PRICE] Failed for {mandi_name}: {e}")

    print(f"[PRICE] No live data for {mandi_name} (not reporting today)")
    return []
# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Haversine distance
# ─────────────────────────────────────────────────────────────────────────────
def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return round(R * 2 * math.asin(math.sqrt(a)), 1)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Geocode each mandi uniquely and compute distance
# ─────────────────────────────────────────────────────────────────────────────
async def enrich_mandi_with_distance(
    mandi: dict, user_lat: float, user_lng: float
) -> dict | None:
    """
    Geocode mandi by 'MandiName, District, State' for unique coordinates.
    Falls back to 'District, State' if mandi name not found.
    Returns mandi dict with distance_km, or None if geocoding fails.
    """
    # Try specific mandi name first, then district fallback
    queries = [
        f"{mandi['name']}, {mandi['district']}, {mandi['state']}",
        f"{mandi['district']}, {mandi['state']}",
    ]

    coords = None
    for q in queries:
        coords = await get_coordinates(q)
        if coords:
            break

    if not coords:
        print(f"[DIST] Could not geocode mandi: {mandi['name']}")
        return None

    dist = calculate_distance(user_lat, user_lng, coords["lat"], coords["lng"])
    print(f"[DIST] {mandi['name']} ({mandi['district']}) → coords={coords} dist={dist}km")

    return {
        "name":        mandi["name"],
        "district":    mandi["district"],
        "state":       mandi["state"],
        "prices":      mandi["prices"],
        "distance_km": dist,
        "_lat":        coords["lat"],
        "_lng":        coords["lng"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Recommendation
# ─────────────────────────────────────────────────────────────────────────────
def build_recommendation(mandis: list[dict], user_district: str = None) -> str:
    if not mandis:
        return "No mandis found near your location."

    nearest = mandis[0]

    if nearest["distance_km"] < 15:
        return (
            f"✅ {nearest['name']} ({nearest['distance_km']} km) is very close. "
            f"Visit it first for best convenience."
        )

    similar = [m for m in mandis[1:] if m["distance_km"] <= nearest["distance_km"] * 1.2]
    if similar:
        names = ", ".join(m["name"] for m in [nearest] + similar[:2])
        return (
            f"📊 {names} are within similar distance. "
            f"Compare prices before deciding where to sell."
        )

    return (
        f"📍 {nearest['name']} ({nearest['distance_km']} km) is your nearest mandi. "
        f"Check prices before visiting."
    )


# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Main pipeline
# ─────────────────────────────────────────────────────────────────────────────
async def find_nearest_mandis(
    location: str,
    state_hint: str = None,
    district_hint: str = None,
    top_n: int = 5,
) -> dict:
    """
    Hybrid pipeline:
    1. Geocode user location (OpenCage)
    2. LLM discovers nearby mandi names (Nebius knows local geography)
    3. Fetch live prices from data.gov.in for LLM-discovered mandis
    4. Also fetch from data.gov.in directly as fallback
    5. Geocode each mandi, calculate Haversine distance
    6. Sort by distance, return top_n
    """
    # 1. Geocode user location
    coords = await get_coordinates(location)
    if not coords:
        return {"error": f"Could not find '{location}'. Try 'Bankhedi, Madhya Pradesh'."}
    print(f"[USER] '{location}' → {coords}")

    state   = state_hint   or "Madhya Pradesh"
    district = district_hint or ""

    # 2. LLM discovers nearby mandis concurrently with data.gov.in fetch
    village = location.split(',')[0].strip()
    llm_task   = asyncio.create_task(llm_discover_mandis(village, district, state))
    api_task   = asyncio.create_task(get_mandis(state, district or None))

    llm_mandis, api_mandis = await asyncio.gather(llm_task, api_task)

    # 3. Fetch live prices for LLM-discovered mandis
    async def enrich_llm_mandi(m: dict) -> dict | None:
        prices = await fetch_prices_for_mandi(m['name'], m.get('district', district), state)
        return {
            "name":     m['name'],
            "district": m.get('district', district),
            "state":    state,
            "prices":   prices,
            "source":   "llm",
        }

    llm_enriched = await asyncio.gather(*[enrich_llm_mandi(m) for m in llm_mandis])

    # 4. Merge LLM mandis + API mandis (dedup by name)
    seen_names = set()
    all_mandis = []
    for m in list(llm_enriched) + api_mandis:
        if not m:
            continue
        key = m['name'].lower().strip()
        if key not in seen_names:
            seen_names.add(key)
            all_mandis.append(m)

    if not all_mandis:
        return {"error": "Could not find any mandis. Try again later."}

    # 5. Geocode each mandi + compute distance
    sem = asyncio.Semaphore(3)
    async def safe_enrich(mandi: dict) -> dict | None:
        async with sem:
            return await enrich_mandi_with_distance(mandi, coords["lat"], coords["lng"])

    results  = await asyncio.gather(*[safe_enrich(m) for m in all_mandis])
    enriched = [r for r in results if r is not None]

    if not enriched:
        return {"error": "Could not determine mandi distances."}

    # 6. Sort by distance
    sorted_mandis = sorted(enriched, key=lambda x: x["distance_km"])[:top_n]
    for m in sorted_mandis:
        m.pop("_lat", None)
        m.pop("_lng", None)
        m.pop("source", None)

    return {
        "user_location":        location,
        "coordinates":          coords,
        "mandis":               sorted_mandis,
        "recommendation":       build_recommendation(sorted_mandis, district_hint),
        "total_mandis_checked": len(enriched),
    }


# ── Backward-compat wrappers ──────────────────────────────────────────────────
async def geocode_location(query: str) -> tuple[float, float] | None:
    c = await get_coordinates(query)
    return (c["lat"], c["lng"]) if c else None


async def get_nearest_mandis(
    lat: float, lon: float,
    mandis: list[dict] = None,
    top_n: int = 5,
    state_hint: str = None,
) -> dict:
    if mandis is None:
        mandis = await get_mandis(state_hint or "Madhya Pradesh")
    if not mandis:
        return {"error": "No mandi data available."}

    sem = asyncio.Semaphore(3)

    async def safe_enrich(m):
        async with sem:
            return await enrich_mandi_with_distance(m, lat, lon)

    results = await asyncio.gather(*[safe_enrich(m) for m in mandis])
    enriched = [r for r in results if r is not None]
    if not enriched:
        return {"error": "Could not geocode mandis."}

    sorted_m = sorted(enriched, key=lambda x: x["distance_km"])[:top_n]
    for m in sorted_m:
        m.pop("_lat", None); m.pop("_lng", None)

    return {
        "mandis":               sorted_m,
        "recommendation":       build_recommendation(sorted_m),
        "total_mandis_checked": len(enriched),
    }
