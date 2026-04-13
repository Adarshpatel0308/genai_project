import httpx
import random
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings

DATA_GOV_API = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

MOCK_COMMODITIES = {
    "wheat": {"base": 2100, "unit": "quintal"},
    "rice": {"base": 2200, "unit": "quintal"},
    "cotton": {"base": 6500, "unit": "quintal"},
    "soybean": {"base": 4200, "unit": "quintal"},
    "maize": {"base": 1800, "unit": "quintal"},
    "onion": {"base": 1500, "unit": "quintal"},
    "tomato": {"base": 1200, "unit": "quintal"},
    "potato": {"base": 1100, "unit": "quintal"},
    "sugarcane": {"base": 350, "unit": "quintal"},
    "groundnut": {"base": 5500, "unit": "quintal"},
    "mustard": {"base": 5200, "unit": "quintal"},
    "chilli": {"base": 8000, "unit": "quintal"},
    "garlic": {"base": 3000, "unit": "quintal"},
    "sorghum": {"base": 2000, "unit": "quintal"},
}

# All mandis per state
MANDIS = {
    "Maharashtra": ["Pune", "Nashik", "Nagpur", "Aurangabad", "Solapur", "Kolhapur", "Sangli", "Satara", "Ahmednagar", "Latur"],
    "Gujarat": ["Ahmedabad", "Surat", "Rajkot", "Vadodara", "Junagadh", "Anand", "Mehsana", "Gondal", "Unjha", "Amreli"],
    "Punjab": ["Ludhiana", "Amritsar", "Patiala", "Jalandhar", "Bathinda", "Moga", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Sangrur"],
    "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam", "Rewa", "Vidisha", "Chhindwara", "Hoshangabad", "Narsinghpur", "Seoni"],
    "Uttar Pradesh": ["Lucknow", "Agra", "Kanpur", "Varanasi", "Allahabad", "Meerut", "Bareilly", "Aligarh", "Moradabad", "Gorakhpur"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Sikar", "Nagaur"],
    "Haryana": ["Ambala", "Hisar", "Rohtak", "Karnal", "Panipat", "Sonipat", "Fatehabad", "Sirsa", "Bhiwani", "Kurukshetra"],
    "Karnataka": ["Bangalore", "Mysore", "Hubli", "Belgaum", "Davangere", "Shimoga", "Tumkur", "Raichur", "Bijapur", "Hassan"],
    "Andhra Pradesh": ["Hyderabad", "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Tirupati", "Kakinada", "Rajahmundry", "Eluru"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode", "Vellore", "Dindigul", "Thanjavur"],
}

COMMODITY_ALIASES = {
    "wheat": ["Wheat", "Gehun", "Gehu"],
    "rice": ["Rice", "Paddy", "Dhan"],
    "cotton": ["Cotton", "Kapas", "Karpas"],
    "soybean": ["Soybean", "Soya Bean", "Soyabean"],
    "maize": ["Maize", "Corn", "Makka"],
    "onion": ["Onion", "Pyaz", "Kanda"],
    "tomato": ["Tomato", "Tamatar"],
    "potato": ["Potato", "Aloo", "Batata"],
    "groundnut": ["Groundnut", "Moongfali", "Peanut"],
    "mustard": ["Mustard", "Sarson", "Rapeseed"],
    "garlic": ["Garlic", "Lahsun"],
    "chilli": ["Chilli", "Mirchi", "Red Chilli"],
}


async def fetch_real_mandi_prices(commodity: str, state: str) -> list:
    """Fetch real mandi prices from data.gov.in API."""
    aliases = COMMODITY_ALIASES.get(commodity.lower(), [commodity.capitalize()])

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for alias in aliases[:2]:
                resp = await client.get(
                    DATA_GOV_API,
                    params={
                        "api-key": settings.DATA_GOV_KEY,
                        "format": "json",
                        "limit": 50,
                        "filters[state.keyword]": state,
                        "filters[commodity]": alias,
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    records = data.get("records", [])
                    if records:
                        prices = []
                        for r in records:
                            try:
                                prices.append({
                                    "date": r.get("arrival_date", str(date.today())),
                                    "commodity": commodity,
                                    "mandi": f"{r.get('market', 'Unknown')} ({r.get('district', '')})",
                                    "state": state,
                                    "min_price": float(r.get("min_price", 0)),
                                    "max_price": float(r.get("max_price", 0)),
                                    "modal_price": float(r.get("modal_price", 0)),
                                    "unit": "quintal",
                                    "district": r.get("district", ""),
                                })
                            except Exception:
                                continue
                        if prices:
                            return prices
    except Exception as e:
        print(f"⚠️  data.gov.in API failed: {e}")

    return []  # Return empty to trigger fallback


def generate_mock_prices(commodity: str, state: str, days: int = 7) -> list:
    base = MOCK_COMMODITIES.get(commodity.lower(), {"base": 2000})["base"]
    prices = []
    today = date.today()
    mandis = MANDIS.get(state, ["Local APMC"])

    for i in range(days):
        d = today - timedelta(days=days - i - 1)
        for mandi in mandis[:5]:
            variation = random.uniform(-0.08, 0.08)
            modal = round(base * (1 + variation))
            prices.append({
                "date": str(d),
                "commodity": commodity,
                "mandi": f"{mandi} APMC",
                "state": state,
                "min_price": round(modal * 0.93),
                "max_price": round(modal * 1.07),
                "modal_price": modal,
                "unit": MOCK_COMMODITIES.get(commodity.lower(), {"unit": "quintal"})["unit"],
                "district": mandi,
            })
    return prices


def predict_prices(commodity: str, current_price: float, days: int = 7) -> list:
    predictions = []
    today = date.today()
    trend = random.uniform(-0.02, 0.03)
    for i in range(1, days + 1):
        d = today + timedelta(days=i)
        noise = random.uniform(-0.02, 0.02)
        predicted = round(current_price * (1 + trend * i + noise))
        predictions.append({
            "date": str(d),
            "predicted_price": predicted,
            "confidence": round(max(50, 90 - i * 5), 1)
        })
    return predictions


def get_sell_advice(commodity: str, current_price: float, predictions: list) -> dict:
    avg_predicted = sum(p["predicted_price"] for p in predictions[:3]) / 3
    if avg_predicted > current_price * 1.05:
        return {"action": "hold", "reason": "Prices expected to rise in next 3 days",
                "expected_gain": f"{round((avg_predicted/current_price - 1)*100, 1)}%"}
    elif avg_predicted < current_price * 0.97:
        return {"action": "sell_now", "reason": "Prices may fall - sell immediately",
                "expected_loss": f"{round((1 - avg_predicted/current_price)*100, 1)}%"}
    return {"action": "neutral", "reason": "Prices stable - sell at best mandi"}


async def get_market_data(commodity: str, state: str, db: AsyncSession) -> dict:
    # Try real API first
    real_prices = await fetch_real_mandi_prices(commodity, state)

    if real_prices:
        prices = real_prices
        data_source = "live"
    else:
        prices = generate_mock_prices(commodity, state, days=7)
        data_source = "estimated"

    if not prices:
        prices = generate_mock_prices(commodity, state, days=7)

    # Get today's prices grouped by mandi
    today_str = str(date.today())
    today_prices = [p for p in prices if p["date"] == today_str]
    if not today_prices:
        today_prices = prices[-min(10, len(prices)):]

    current_price = round(sum(p["modal_price"] for p in today_prices) / len(today_prices)) if today_prices else 2000
    predictions = predict_prices(commodity, current_price)
    sell_advice = get_sell_advice(commodity, current_price, predictions)

    best_mandi = max(today_prices, key=lambda x: x["modal_price"]) if today_prices else {}

    # All unique mandis
    all_mandis = list({p["mandi"] for p in prices})

    return {
        "commodity": commodity,
        "state": state,
        "current_price": current_price,
        "unit": "quintal",
        "data_source": data_source,
        "historical_prices": prices,
        "today_prices": today_prices,
        "price_predictions": predictions,
        "sell_advice": sell_advice,
        "best_mandi": best_mandi.get("mandi", ""),
        "available_mandis": all_mandis,
        "total_mandis": len(all_mandis),
    }
