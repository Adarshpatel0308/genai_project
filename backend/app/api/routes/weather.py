from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from app.core.security import get_current_user
from app.services.weather.weather_service import get_weather_forecast

router = APIRouter()


@router.get("/forecast")
async def weather_forecast(
    location: str = Query(..., description="City or district name"),
    current_user: dict = Depends(get_current_user)
):
    try:
        return await get_weather_forecast(location)
    except ValueError as e:
        return JSONResponse(status_code=422, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Weather service unavailable: {str(e)}"})
