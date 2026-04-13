"""
Tool Calling definitions for Krishi GPT.

Each tool is defined as an OpenAI-compatible function schema.
The executor maps tool name → actual async function.
"""
import json
import asyncio

# ── Tool schemas (OpenAI function-calling format) ─────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "find_nearest_mandis",
            "description": (
                "Find the nearest APMC mandi markets to a given location in India. "
                "Use this when the user asks about nearby mandis, where to sell crops, "
                "or mentions their village/district/city and wants mandi information."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "Village or town name. E.g. 'Chandon', 'Bankhedi', 'Pune'"
                    },
                    "district": {
                        "type": "string",
                        "description": "District name. E.g. 'Narmadapuram', 'Hoshangabad', 'Pune'"
                    },
                    "state": {
                        "type": "string",
                        "description": "Indian state name. E.g. 'Madhya Pradesh', 'Maharashtra'"
                    }
                },
                "required": ["location"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_market_prices",
            "description": (
                "Get current mandi/market prices for a specific crop in a state. "
                "Use this when user asks about crop prices, mandi rates, bhav, "
                "or whether to sell now or hold."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "commodity": {
                        "type": "string",
                        "description": "Crop name in English. E.g. 'wheat', 'onion', 'soybean', 'cotton'"
                    },
                    "state": {
                        "type": "string",
                        "description": "Indian state name. E.g. 'Maharashtra', 'Punjab'"
                    }
                },
                "required": ["commodity", "state"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": (
                "Get current weather and 7-day forecast for a location. "
                "Use this when user asks about weather, rain, temperature, "
                "or whether conditions are good for sowing/harvesting."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City or district name in India"
                    }
                },
                "required": ["location"]
            }
        }
    }
]


# ── Tool executor ─────────────────────────────────────────────────────────────
async def execute_tool(tool_name: str, tool_args: dict) -> str:
    """Execute the tool and return a string result for the LLM to use."""
    try:
        if tool_name == "find_nearest_mandis":
            return await _run_nearest_mandis(**tool_args)

        elif tool_name == "get_market_prices":
            return await _run_market_prices(**tool_args)

        elif tool_name == "get_weather":
            return await _run_weather(**tool_args)

        else:
            return f"Unknown tool: {tool_name}"

    except Exception as e:
        return f"Tool '{tool_name}' failed: {str(e)}"


# ── Individual tool implementations ──────────────────────────────────────────

async def _run_nearest_mandis(location: str, state: str = None, district: str = None) -> str:
    from app.services.market.mandi_locator import find_nearest_mandis

    result = await find_nearest_mandis(
        location,
        state_hint=state,
        district_hint=district,
        top_n=5
    )

    if "error" in result:
        return result["error"]

    mandis = result.get("mandis", [])
    if not mandis:
        return "No mandis found near this location."

    lines = [f"Nearest mandis to {location}" + (f", {district}" if district else "") + ":"]
    for i, m in enumerate(mandis, 1):
        price_summary = ""
        if m.get("prices"):
            top_prices = sorted(m["prices"], key=lambda x: x["modal_price"], reverse=True)[:3]
            price_summary = " | ".join(
                f"{p['commodity']}: \u20b9{p['modal_price']}/quintal"
                for p in top_prices if p["modal_price"] > 0
            )
        lines.append(
            f"{i}. {m['name']} ({m['district']}, {m['state']}) \u2014 {m['distance_km']} km"
            + (f"\n   Prices: {price_summary}" if price_summary else " (no live price data today)")
        )
    lines.append(f"\n{result.get('recommendation', '')}")
    return "\n".join(lines)


async def _run_market_prices(commodity: str, state: str) -> str:
    from app.services.market.market_service import fetch_real_mandi_prices

    prices = await fetch_real_mandi_prices(commodity, state)
    if not prices:
        return f"No live price data found for {commodity} in {state}. Market may be closed or data unavailable."

    # Summarise: avg modal, best mandi, range
    modal_prices = [p["modal_price"] for p in prices if p["modal_price"] > 0]
    if not modal_prices:
        return f"Price data found but values are zero for {commodity} in {state}."

    avg_modal = round(sum(modal_prices) / len(modal_prices))
    best = max(prices, key=lambda x: x["modal_price"])
    worst = min(prices, key=lambda x: x["modal_price"])

    lines = [
        f"Market prices for {commodity.title()} in {state}:",
        f"• Average modal price: ₹{avg_modal}/quintal",
        f"• Best mandi: {best['mandi']} — ₹{best['modal_price']}/quintal",
        f"• Lowest mandi: {worst['mandi']} — ₹{worst['modal_price']}/quintal",
        f"• Total mandis reporting: {len(prices)}",
        f"• Price range: ₹{min(p['min_price'] for p in prices)} – ₹{max(p['max_price'] for p in prices)}/quintal",
    ]
    return "\n".join(lines)


async def _run_weather(location: str) -> str:
    import httpx
    from app.core.config import settings

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{settings.WEATHER_API_BASE}/forecast.json",
                params={"key": settings.WEATHER_API_KEY, "q": location, "days": 3, "lang": "en"}
            )
            if resp.status_code != 200:
                return f"Weather data unavailable for {location}."

            data = resp.json()
            current = data["current"]
            forecast = data["forecast"]["forecastday"]

            lines = [
                f"Weather in {location}:",
                f"• Now: {current['temp_c']}°C, {current['condition']['text']}",
                f"• Humidity: {current['humidity']}%, Wind: {current['wind_kph']} km/h",
                "• 3-day forecast:",
            ]
            for day in forecast:
                lines.append(
                    f"  {day['date']}: {day['day']['condition']['text']}, "
                    f"{day['day']['mintemp_c']}–{day['day']['maxtemp_c']}°C, "
                    f"Rain: {day['day']['daily_chance_of_rain']}%"
                )
            return "\n".join(lines)

    except Exception as e:
        return f"Weather fetch failed: {e}"
