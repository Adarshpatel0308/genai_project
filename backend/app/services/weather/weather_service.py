import httpx
from app.core.config import settings

# WeatherAPI.com condition code → emoji
CONDITION_ICONS = {
    1000: "☀️", 1003: "⛅", 1006: "☁️", 1009: "☁️",
    1030: "🌫️", 1063: "🌦️", 1066: "🌨️", 1069: "🌧️",
    1072: "🌧️", 1087: "⛈️", 1114: "❄️", 1117: "❄️",
    1135: "🌫️", 1147: "🌫️", 1150: "🌦️", 1153: "🌦️",
    1168: "🌧️", 1171: "🌧️", 1180: "🌧️", 1183: "🌧️",
    1186: "🌧️", 1189: "🌧️", 1192: "⛈️", 1195: "⛈️",
    1198: "🌧️", 1201: "🌧️", 1204: "🌨️", 1207: "🌨️",
    1210: "❄️", 1213: "❄️", 1216: "❄️", 1219: "❄️",
    1222: "❄️", 1225: "❄️", 1237: "🌨️", 1240: "🌦️",
    1243: "🌧️", 1246: "⛈️", 1249: "🌨️", 1252: "🌨️",
    1255: "❄️", 1258: "❄️", 1261: "🌨️", 1264: "🌨️",
    1273: "⛈️", 1276: "⛈️", 1279: "⛈️", 1282: "⛈️",
}


async def get_weather_forecast(location: str) -> dict:
    """Fetch 7-day weather forecast using WeatherAPI.com."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{settings.WEATHER_API_BASE}/forecast.json",
                params={
                    "key": settings.WEATHER_API_KEY,
                    "q": location,
                    "days": 7,
                    "aqi": "yes",
                    "alerts": "yes",
                }
            )
            if resp.status_code == 400:
                # WeatherAPI returns 400 for unknown locations — try lat,lon fallback
                raise ValueError(f"Location not found: {location}")
            resp.raise_for_status()
            data = resp.json()
    except ValueError:
        raise
    except Exception as e:
        print(f"WeatherAPI failed: {e}")
        raise ValueError(f"Could not fetch weather for '{location}'. Check location name or API key.")

    loc = data["location"]
    forecast_days = data["forecast"]["forecastday"]
    current = data["current"]

    # Build 7-day forecast
    forecast = []
    for day_data in forecast_days:
        day = day_data["day"]
        code = day["condition"]["code"]
        rain_prob = day.get("daily_chance_of_rain", 0)
        max_temp = day["maxtemp_c"]
        avg_humidity = day["avghumidity"]

        forecast.append({
            "date": day_data["date"],
            "max_temp": round(max_temp),
            "min_temp": round(day["mintemp_c"]),
            "avg_temp": round(day["avgtemp_c"]),
            "rainfall_mm": round(day.get("totalprecip_mm", 0), 1),
            "rain_probability": int(rain_prob),
            "wind_speed": round(day["maxwind_kph"]),
            "humidity": int(avg_humidity),
            "uv_index": day.get("uv", 0),
            "condition": day["condition"]["text"],
            "condition_icon": CONDITION_ICONS.get(code, "🌡️"),
            "sunrise": day_data["astro"]["sunrise"],
            "sunset": day_data["astro"]["sunset"],
            "pest_risk": _calculate_pest_risk(rain_prob, max_temp, avg_humidity),
        })

    # Current conditions
    current_conditions = {
        "temp_c": current["temp_c"],
        "feels_like": current["feelslike_c"],
        "humidity": current["humidity"],
        "wind_kph": current["wind_kph"],
        "condition": current["condition"]["text"],
        "condition_icon": CONDITION_ICONS.get(current["condition"]["code"], "🌡️"),
        "uv_index": current.get("uv", 0),
        "visibility_km": current.get("vis_km", 0),
        "pressure_mb": current.get("pressure_mb", 0),
    }

    # Air quality if available
    aqi_data = current.get("air_quality", {})
    air_quality = None
    if aqi_data:
        aqi_index = aqi_data.get("us-epa-index", 1)
        aqi_labels = {1: "Good", 2: "Moderate", 3: "Unhealthy for sensitive", 4: "Unhealthy", 5: "Very Unhealthy", 6: "Hazardous"}
        air_quality = {
            "index": aqi_index,
            "label": aqi_labels.get(aqi_index, "Good"),
            "pm2_5": round(aqi_data.get("pm2_5", 0), 1),
        }

    # Alerts
    alerts = []
    for alert in data.get("alerts", {}).get("alert", []):
        alerts.append({
            "type": alert.get("category", "Weather"),
            "message": alert.get("headline", alert.get("desc", "Weather alert")),
            "date": alert.get("effective", "")[:10],
        })

    # Add custom agricultural alerts
    alerts += _generate_agri_alerts(forecast)

    return {
        "location": f"{loc['name']}, {loc['region']}",
        "district": loc["name"],
        "state": loc["region"],
        "country": loc["country"],
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "timezone": loc["tz_id"],
        "local_time": loc["localtime"],
        "current": current_conditions,
        "air_quality": air_quality,
        "forecast": forecast,
        "irrigation_advice": _irrigation_advice(forecast),
        "alerts": alerts,
    }


def _calculate_pest_risk(rain_prob: float, max_temp: float, humidity: float = 70) -> str:
    if rain_prob > 70 and max_temp > 28 and humidity > 75:
        return "high"
    elif rain_prob > 40 or max_temp > 32 or humidity > 80:
        return "medium"
    return "low"


def _irrigation_advice(forecast: list) -> list:
    advice = []
    for day in forecast:
        if day["rainfall_mm"] > 10:
            advice.append({"date": day["date"], "action": "skip", "reason": f"Rain expected ({day['rainfall_mm']}mm)"})
        elif day["max_temp"] > 38:
            advice.append({"date": day["date"], "action": "irrigate_morning", "reason": f"Heat wave ({day['max_temp']}°C) — irrigate early morning"})
        elif day["rain_probability"] > 60:
            advice.append({"date": day["date"], "action": "skip", "reason": f"High rain chance ({day['rain_probability']}%)"})
        else:
            advice.append({"date": day["date"], "action": "normal", "reason": "Normal conditions"})
    return advice


def _generate_agri_alerts(forecast: list) -> list:
    alerts = []
    for day in forecast:
        if day["rain_probability"] > 80:
            alerts.append({"date": day["date"], "type": "heavy_rain", "message": f"Heavy rain expected ({day['rain_probability']}%) — protect harvested crops"})
        if day["max_temp"] > 42:
            alerts.append({"date": day["date"], "type": "heat_wave", "message": f"Extreme heat ({day['max_temp']}°C) — increase irrigation frequency"})
        if day["pest_risk"] == "high":
            alerts.append({"date": day["date"], "type": "pest_risk", "message": "High pest/fungal risk due to humidity — inspect crops and spray preventively"})
        if day["wind_speed"] > 40:
            alerts.append({"date": day["date"], "type": "strong_wind", "message": f"Strong winds ({day['wind_speed']} km/h) — avoid spraying pesticides"})
    return alerts
