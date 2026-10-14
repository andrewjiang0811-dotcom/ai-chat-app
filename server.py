import os
import json
import uuid
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from core.database import (
    init_db,
    get_sessions,
    get_session,
    create_session,
    update_session,
    delete_session,
    add_message,
    get_messages
)
from core.personas import (
    load_personas,
    get_persona,
    upsert_persona,
    delete_persona
)
from core.llm_provider import (
    get_ollama_models,
    stream_chat_response
)
from core.tts_engine import (
    AVAILABLE_VOICES,
    DEFAULT_VOICE,
    synthesize_speech
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
STATIC_DIR = os.path.join(BASE_DIR, "static")

DEFAULT_CONFIG = {
    "provider": "ollama",
    "model": "llama3:latest",
    "ollama_host": "http://localhost:11434",
    "gemini_api_key": "",
    "openai_api_key": "",
    "openai_base_url": "https://api.openai.com/v1",
    "tts_voice": DEFAULT_VOICE,
    "tts_auto_play": False
}

def load_config() -> Dict[str, Any]:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CONFIG_FILE):
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            merged = DEFAULT_CONFIG.copy()
            merged.update(cfg)
            return merged
    except Exception:
        return DEFAULT_CONFIG.copy()

def save_config(cfg: Dict[str, Any]):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

# Initialize Database on launch
init_db()

app = FastAPI(title="AI Chat App")

# Serve static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
async def get_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>AI Chat App - Frontend loading...</h1>"

# Config APIs
@app.get("/api/config")
async def get_app_config():
    return load_config()

@app.post("/api/config")
async def update_app_config(req: Request):
    data = await req.json()
    curr = load_config()
    curr.update(data)
    save_config(curr)
    return {"status": "ok", "config": curr}

# Persona APIs
@app.get("/api/personas")
async def list_personas():
    return load_personas()

@app.post("/api/personas")
async def save_persona_item(req: Request):
    data = await req.json()
    if not data.get("id"):
        data["id"] = "custom_" + str(uuid.uuid4())[:8]
    return upsert_persona(data)

@app.delete("/api/personas/{persona_id}")
async def remove_persona_item(persona_id: str):
    return delete_persona(persona_id)

# Session APIs
class CreateSessionReq(BaseModel):
    title: Optional[str] = "新對話"
    character_id: Optional[str] = "assistant"

@app.get("/api/sessions")
async def list_chat_sessions():
    return get_sessions()

@app.post("/api/sessions")
async def create_chat_session(req: CreateSessionReq):
    session_id = str(uuid.uuid4())
    session = create_session(session_id, req.title or "新對話", req.character_id or "assistant")
    return session

@app.get("/api/sessions/{session_id}/messages")
async def get_session_message_history(session_id: str):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = get_messages(session_id)
    return {"session": session, "messages": messages}

@app.patch("/api/sessions/{session_id}")
async def patch_session(session_id: str, req: Request):
    data = await req.json()
    update_session(session_id, title=data.get("title"), character_id=data.get("character_id"))
    return get_session(session_id)

@app.delete("/api/sessions/{session_id}")
async def remove_chat_session(session_id: str):
    delete_session(session_id)
    return {"status": "deleted"}

# Model query API
@app.get("/api/models")
async def list_available_models():
    config = load_config()
    ollama_models = await get_ollama_models(config.get("ollama_host", "http://localhost:11434"))
    
    popular_gemini = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
    popular_openai = ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet", "deepseek-chat"]
    
    return {
        "ollama": ollama_models,
        "gemini": popular_gemini,
        "openai": popular_openai
    }

# TTS Voice APIs
@app.get("/api/voices")
async def list_voices():
    return AVAILABLE_VOICES

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None

@app.post("/api/tts")
async def generate_tts(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")
    config = load_config()
    voice = req.voice or config.get("tts_voice", DEFAULT_VOICE)
    try:
        audio_data = await synthesize_speech(req.text, voice)
        return Response(content=audio_data, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {str(e)}")

# Chat Streaming API
class SendMessageReq(BaseModel):
    content: str
    character_id: Optional[str] = None

@app.post("/api/sessions/{session_id}/chat")
async def chat_stream(session_id: str, req: SendMessageReq):
    session = get_session(session_id)
    if not session:
        # Auto-create if not exists
        character_id = req.character_id or "assistant"
        session = create_session(session_id, "新對話", character_id)

    # Save user message
    add_message(session_id, "user", req.content)

    # Auto title update if this is the first turn
    existing_msgs = get_messages(session_id)
    if len(existing_msgs) <= 2 and (session["title"] == "新對話" or not session["title"]):
        # Extract first 15 chars as title
        clean_title = req.content.strip().split("\n")[0][:15]
        update_session(session_id, title=clean_title)

    # Fetch persona
    character_id = req.character_id or session.get("character_id", "assistant")
    persona = get_persona(character_id)

    # Build context messages
    context = [{"role": "system", "content": persona["system_prompt"]}]
    for m in existing_msgs[-12:]:  # Keep recent history
        if m["role"] in ("user", "assistant"):
            context.append({"role": m["role"], "content": m["content"]})

    config = load_config()
    provider = config.get("provider", "ollama")
    model = config.get("model", "llama3:latest")

    async def event_generator():
        collected_chunks = []
        try:
            async for chunk in stream_chat_response(provider, model, context, config):
                collected_chunks.append(chunk)
                payload = json.dumps({"type": "chunk", "content": chunk}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
        except Exception as e:
            err_msg = f"\n[串流發生錯誤: {str(e)}]"
            collected_chunks.append(err_msg)
            payload = json.dumps({"type": "chunk", "content": err_msg}, ensure_ascii=False)
            yield f"data: {payload}\n\n"

        # Save assistant message into SQLite
        full_reply = "".join(collected_chunks)
        if full_reply.strip():
            add_message(session_id, "assistant", full_reply)

        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
