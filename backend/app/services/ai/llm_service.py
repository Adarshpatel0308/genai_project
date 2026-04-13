import re
import json
import asyncio
from app.core.config import settings

_groq_client = None
_ollama_llm = None
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
            print(f"✅ Nebius LLM client initialized with model: {settings.NEBIUS_TEXT_MODEL}")
        except Exception as e:
            print(f"⚠️  Nebius init failed: {e}")
    return _nebius_client


def get_groq_client():
    global _groq_client
    if _groq_client is None and settings.GROQ_API_KEY:
        try:
            from groq import Groq
            _groq_client = Groq(api_key=settings.GROQ_API_KEY)
            print(f"✅ Groq client initialized with model: {settings.GROQ_MODEL}")
        except Exception as e:
            print(f"⚠️  Groq init failed: {e}")
    return _groq_client


def get_ollama_llm():
    global _ollama_llm
    if _ollama_llm is None:
        from langchain_ollama import OllamaLLM
        _ollama_llm = OllamaLLM(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            temperature=0.3,
            num_predict=512,
        )
    return _ollama_llm


def strip_think_tags(text: str) -> str:
    return re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()


async def run_chain(system_prompt: str, user_input: str) -> str:
    """Try Nebius first (fast), fallback to Groq, then Ollama."""

    # 1. Try Nebius (fastest)
    nebius = get_nebius_client()
    if nebius:
        try:
            loop = asyncio.get_event_loop()
            def call_nebius():
                response = nebius.chat.completions.create(
                    model=settings.NEBIUS_TEXT_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_input}
                    ],
                    max_tokens=800,
                    temperature=0.4,
                )
                return response.choices[0].message.content
            result = await asyncio.wait_for(
                loop.run_in_executor(None, call_nebius),
                timeout=15.0
            )
            return strip_think_tags(result)
        except asyncio.TimeoutError:
            print("⚠️  Nebius timed out, trying Groq")
        except Exception as e:
            print(f"⚠️  Nebius error: {e}, trying Groq")

    # 2. Fallback to Groq
    groq = get_groq_client()
    if groq:
        try:
            loop = asyncio.get_event_loop()
            def call_groq():
                response = groq.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_input}
                    ],
                    max_tokens=800,
                    temperature=0.4,
                )
                return response.choices[0].message.content
            result = await asyncio.wait_for(
                loop.run_in_executor(None, call_groq),
                timeout=15.0
            )
            return strip_think_tags(result)
        except asyncio.TimeoutError:
            print("⚠️  Groq timed out")
        except Exception as e:
            print(f"⚠️  Groq error: {e}")

    # 3. Fallback to Ollama
    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser
        llm = get_ollama_llm()
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}")
        ])
        chain = prompt | llm | StrOutputParser()
        result = await asyncio.wait_for(chain.ainvoke({"input": user_input}), timeout=30.0)
        return strip_think_tags(result)
    except Exception as e:
        print(f"⚠️  Ollama error: {e}")
        return ""


# ── System prompts ────────────────────────────────────────────────────────────

DISEASE_SYSTEM_PROMPT = """You are PRAGATI's expert agriculture AI for Indian farmers.
A crop disease has been detected. Give a concise farmer-friendly response in {language}.
Include: 1) Disease description 2) Treatment with specific pesticide names and doses 3) Prevention steps.
Be direct and practical. Use bullet points. Keep response under 200 words."""

CROP_SYSTEM_PROMPT = """You are PRAGATI's soil and crop expert for Indian farmers.
Based on soil data, give crop recommendations in {language}.
Include: 1) Top 3 crops with reasons 2) Fertilizer doses (NPK kg/ha) 3) Irrigation schedule 4) Crop rotation suggestion.
Be specific with quantities. Keep response under 250 words."""

CHATBOT_SYSTEM_PROMPT = """You are Krishi GPT — an expert AI agriculture advisor built into PRAGATI platform for Indian farmers.

## Your Persona
- You are like a trusted local Krishi Vigyan Kendra (KVK) expert
- You speak the farmer's language — simple, practical, no jargon
- You always give specific quantities, dates, product names — never vague advice
- You care about farmer's profit and sustainability

## Language Rule
Always respond in {language} language.
- 'hi' → Hindi (Devanagari script)
- 'en' → English
- 'mr' → Marathi
- 'gu' → Gujarati
Never mix languages in one response.

## Real-Time Tools Available
You MUST call tools for real-time data — never guess:
- `find_nearest_mandis` → when user asks about nearby mandis, where to sell, mandi location
- `get_market_prices` → when user asks crop prices, bhav, rate, sell or hold decision
- `get_weather` → when user asks weather, rain, temperature, sowing/harvesting conditions

## Few-Shot Examples
User: "gehu ka bhav kya hai Punjab mein?"
Action: Call get_market_prices(commodity="wheat", state="Punjab")
Response: "पंजाब में गेहूं का आज का भाव: [tool result से data]"

User: "mere paas kaunsi mandi hai, main Bankhedi MP mein hun"
Action: Call find_nearest_mandis(location="Bankhedi", district="Narmadapuram", state="Madhya Pradesh")
Response: "बांखेड़ी के पास की मंडियां: [tool result से data]"

User: "kal barish hogi kya Indore mein?"
Action: Call get_weather(location="Indore")
Response: "इंदौर का मौसम: [tool result से data]"

## Response Format
- Use bullet points for lists
- Bold important numbers/quantities
- End with 1 actionable tip
- Max 250 words unless detailed analysis needed

## RAG Knowledge Context
{context}"""

FARM_CALC_SYSTEM_PROMPT = """You are PRAGATI's farm profitability expert for Indian farmers.
Analyze the farm expense data and give optimization tips in {language}.
Include: 1) Cost reduction ideas 2) Yield improvement tips 3) Risk factors 4) Better crop alternatives if ROI is low.
Keep response under 200 words."""


# Keywords that indicate a tool is needed
_TOOL_KEYWORDS = [
    'mandi', 'market', 'price', 'bhav', 'bazar', 'sell', 'weather', 'rain',
    'barish', 'mausam', 'temperature', 'forecast', 'location', 'nearest',
    'paas', 'village', 'gaon', 'district', 'state', 'where', 'kahan',
    'kitna', 'rate', 'gehu', 'wheat', 'onion', 'pyaz', 'soybean', 'cotton',
    'najdik', 'nazdik', 'kareeb', 'pass', 'sabse', 'kaun', 'batao',
    'becho', 'bikri', 'fasal', 'crop', 'apmc', 'sabzi', 'anaj',
]

def _needs_tools(text: str) -> bool:
    """Quick check — only use tool-calling if message likely needs real-time data."""
    t = text.lower()
    return any(kw in t for kw in _TOOL_KEYWORDS)


# ── Tool-calling chain with Memory + Agentic Loop ───────────────────────────
async def run_chain_with_tools(
    system_prompt: str,
    user_input: str,
    history: list[dict] = None   # conversation memory injected here
) -> str:
    """
    Agentic loop with memory:
    1. Build messages = system + history (memory) + current user message
    2. LLM decides: answer directly OR call tool(s)
    3. Execute tools, inject results back
    4. LLM can call MORE tools if needed (agentic loop, max 3 iterations)
    5. Final answer returned
    """
    if not _needs_tools(user_input):
        # Simple message — use memory but skip tool overhead
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-6:])  # last 3 exchanges
        messages.append({"role": "user", "content": user_input})
        return await _run_with_messages(messages)

    from app.services.ai.tools import TOOLS, execute_tool

    # Build full message array with memory
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history[-6:])  # last 3 exchanges = 6 messages
    messages.append({"role": "user", "content": user_input})

    # ── Agentic loop — max 3 iterations ────────────────────────────────────────
    MAX_ITERATIONS = 3
    nebius = get_nebius_client()
    groq   = get_groq_client()

    for iteration in range(MAX_ITERATIONS):
        print(f"[AGENT] Iteration {iteration + 1}/{MAX_ITERATIONS}")

        # Try Nebius first
        response_msg = None
        if nebius:
            try:
                loop = asyncio.get_event_loop()
                def nebius_call(msgs=messages):
                    return nebius.chat.completions.create(
                        model=settings.NEBIUS_TEXT_MODEL,
                        messages=msgs,
                        tools=TOOLS,
                        tool_choice="auto",
                        max_tokens=1024,
                        temperature=0.4,
                    )
                resp = await asyncio.wait_for(
                    loop.run_in_executor(None, nebius_call), timeout=20.0
                )
                response_msg = resp.choices[0].message
            except Exception as e:
                print(f"[AGENT] Nebius error: {e}")

        # Fallback to Groq
        if response_msg is None and groq:
            try:
                loop = asyncio.get_event_loop()
                def groq_call(msgs=messages):
                    return groq.chat.completions.create(
                        model=settings.GROQ_MODEL,
                        messages=msgs,
                        tools=TOOLS,
                        tool_choice="auto",
                        max_tokens=1024,
                        temperature=0.4,
                    )
                resp = await asyncio.wait_for(
                    loop.run_in_executor(None, groq_call), timeout=20.0
                )
                response_msg = resp.choices[0].message
            except Exception as e:
                print(f"[AGENT] Groq error: {e}")

        if response_msg is None:
            break

        # No tool calls — LLM gave final answer
        if not response_msg.tool_calls:
            print(f"[AGENT] Final answer at iteration {iteration + 1}")
            return strip_think_tags(response_msg.content or "")

        # Execute all tool calls concurrently
        tool_calls = response_msg.tool_calls
        print(f"[AGENT] Calling tools: {[tc.function.name for tc in tool_calls]}")

        messages.append({
            "role": "assistant",
            "content": response_msg.content or "",
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in tool_calls
            ]
        })

        tool_results = await asyncio.gather(*[
            execute_tool(tc.function.name, json.loads(tc.function.arguments))
            for tc in tool_calls
        ])

        for tc, result in zip(tool_calls, tool_results):
            print(f"[AGENT] Tool '{tc.function.name}' result length: {len(str(result))}")
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": str(result),
            })

        # Continue loop — LLM may call more tools or give final answer

    # Max iterations reached — force final answer without tools
    print("[AGENT] Max iterations reached, forcing final answer")
    return await _run_with_messages(messages)


async def _run_with_messages(messages: list[dict]) -> str:
    """Simple LLM call with a pre-built messages array (no tools)."""
    nebius = get_nebius_client()
    if nebius:
        try:
            loop = asyncio.get_event_loop()
            def call(msgs=messages):
                return nebius.chat.completions.create(
                    model=settings.NEBIUS_TEXT_MODEL,
                    messages=msgs,
                    max_tokens=800,
                    temperature=0.4,
                ).choices[0].message.content
            result = await asyncio.wait_for(
                loop.run_in_executor(None, call), timeout=15.0
            )
            return strip_think_tags(result)
        except Exception as e:
            print(f"[LLM] Nebius error: {e}")

    groq = get_groq_client()
    if groq:
        try:
            loop = asyncio.get_event_loop()
            def call(msgs=messages):
                return groq.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=msgs,
                    max_tokens=800,
                    temperature=0.4,
                ).choices[0].message.content
            result = await asyncio.wait_for(
                loop.run_in_executor(None, call), timeout=15.0
            )
            return strip_think_tags(result)
        except Exception as e:
            print(f"[LLM] Groq error: {e}")

    return ""
