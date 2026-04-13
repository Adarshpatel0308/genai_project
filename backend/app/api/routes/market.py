from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import io

from app.db.database import get_db
from app.core.security import get_current_user
from app.services.market.market_service import get_market_data, MOCK_COMMODITIES, MANDIS
from app.services.market.mandi_locator import find_nearest_mandis, geocode_location, _mandi_cache
from app.utils.pdf_generator import generate_pdf

router = APIRouter()


@router.get("/prices")
async def get_prices(
    commodity: str = Query(...),
    state: str = Query("Maharashtra"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_market_data(commodity, state, db)


@router.get("/commodities")
async def list_commodities():
    return {"commodities": list(MOCK_COMMODITIES.keys())}


@router.get("/states")
async def list_states():
    return {"states": list(MANDIS.keys())}


@router.delete("/cache/clear")
async def clear_mandi_cache(current_user: dict = Depends(get_current_user)):
    """Clear mandi cache to force fresh data fetch."""
    _mandi_cache.clear()
    return {"message": "Cache cleared"}


@router.get("/nearest-mandis")
async def nearest_mandis(
    lat: float = Query(None),
    lon: float = Query(None),
    location: str = Query(None),
    state: str = Query(None),
    district: str = Query(None),
    top: int = Query(5, ge=1, le=10),
    current_user: dict = Depends(get_current_user),
):
    from app.services.market.mandi_locator import get_mandis, get_nearest_mandis, build_recommendation

    if lat is not None and lon is not None:
        mandis = await get_mandis(state or "Madhya Pradesh", district)
        if not mandis:
            return {"error": "Could not fetch mandi data. Try again later."}
        result = await get_nearest_mandis(lat, lon, mandis, top_n=top, state_hint=state)
        return {"lat": lat, "lon": lon, **result}

    if not location:
        return {"error": "Provide lat/lon or location name"}

    result = await find_nearest_mandis(
        location, state_hint=state, district_hint=district, top_n=top
    )
    if "coordinates" in result:
        result["lat"] = result["coordinates"]["lat"]
        result["lon"] = result["coordinates"]["lng"]
    return result


@router.get("/report/pdf")
async def download_market_report(
    commodity: str = Query(...),
    state: str = Query("Maharashtra"),
    language: str = "en",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await get_market_data(commodity, state, db)
    sections = [
        {"heading": "Current Market Price", "content": {
            "Commodity": commodity, "State": state,
            "Current Price": f"₹{data['current_price']} per {data['unit']}",
            "Best Mandi": data["best_mandi"]
        }},
        {"heading": "Sell Advice", "content": {
            "Action": data["sell_advice"]["action"],
            "Reason": data["sell_advice"]["reason"]
        }},
        {"heading": "7-Day Price Prediction", "content": [
            f"{p['date']}: ₹{p['predicted_price']} (Confidence: {p['confidence']}%)"
            for p in data["price_predictions"]
        ]},
    ]
    pdf_bytes = generate_pdf(f"Market Price Report - {commodity}", sections, language)
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=market_{commodity}.pdf"})
