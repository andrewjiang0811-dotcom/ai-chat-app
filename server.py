import os
import json
import uuid
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File, Form
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
    delete_persona,
    update_persona_avatar,
    update_persona_emotion_avatar,
    delete_persona_emotion_avatar,
    update_persona_touch_zones,
    update_persona_emotion_settings,
    remove_persona_backgrounds
)
from core.emotion_analyzer import detect_emotion
from core.llm_provider import (
    get_ollama_models,
    get_gemini_models,
    get_gemini_webapi_models,
    get_openai_compatible_models,
    test_provider_connection,
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
    "gemini_web_secure_1psid": "",
    "gemini_web_secure_1psidts": "",
    "gemini_web_proxy": "",
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

AVATARS_DIR = os.path.join(DATA_DIR, "avatars")
BACKGROUNDS_DIR = os.path.join(DATA_DIR, "backgrounds")
os.makedirs(AVATARS_DIR, exist_ok=True)
os.makedirs(BACKGROUNDS_DIR, exist_ok=True)

# Serve static files & uploaded media
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/avatars", StaticFiles(directory=AVATARS_DIR), name="avatars")
app.mount("/backgrounds", StaticFiles(directory=BACKGROUNDS_DIR), name="backgrounds")

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

@app.post("/api/personas/{persona_id}/avatar")
async def upload_persona_avatar_file(
    persona_id: str,
    file: UploadFile = File(...),
    display_mode: Optional[str] = Form(None)
):
    os.makedirs(AVATARS_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
    if not ext or ext not in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".jfif"]:
        ext = ".png"
    filename = f"{persona_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(AVATARS_DIR, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    image_url = f"/avatars/{filename}"
    updated = update_persona_avatar(persona_id, image_url, display_mode)
    return updated

@app.patch("/api/personas/{persona_id}/display_mode")
async def patch_persona_display_mode(persona_id: str, req: Request):
    data = await req.json()
    mode = data.get("display_mode", "half_body")
    p = get_persona(persona_id)
    updated = update_persona_avatar(persona_id, image_url=p.get("image_url", ""), display_mode=mode)
    return updated

# Emotion-Specific Sprites & Touch Zones APIs
@app.post("/api/personas/{persona_id}/emotions/{emotion}")
async def upload_persona_emotion_avatar_file(
    persona_id: str,
    emotion: str,
    file: UploadFile = File(...)
):
    os.makedirs(AVATARS_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
    if not ext or ext not in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".jfif"]:
        ext = ".png"
    filename = f"{persona_id}_{emotion}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(AVATARS_DIR, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    image_url = f"/avatars/{filename}"
    updated = update_persona_emotion_avatar(persona_id, emotion, image_url)
    return updated

@app.delete("/api/personas/{persona_id}/emotions/{emotion}")
async def remove_persona_emotion_avatar_file(persona_id: str, emotion: str):
    return delete_persona_emotion_avatar(persona_id, emotion)

@app.put("/api/personas/{persona_id}/touch_zones")
async def save_persona_touch_zones(persona_id: str, req: Request):
    data = await req.json()
    zones = data.get("touch_zones", [])
    updated = update_persona_touch_zones(persona_id, zones)
    return updated

@app.patch("/api/personas/{persona_id}/emotion_settings")
async def patch_persona_emotion_settings(persona_id: str, req: Request):
    data = await req.json()
    auto_emotion = data.get("auto_emotion", True)
    emotion_method = data.get("emotion_method", "rules")
    updated = update_persona_emotion_settings(persona_id, auto_emotion, emotion_method)
    return updated

@app.post("/api/personas/{persona_id}/remove_background")
async def api_remove_persona_background(persona_id: str):
    updated = remove_persona_backgrounds(persona_id, AVATARS_DIR)
    return updated


class DetectEmotionReq(BaseModel):
    text: str
    use_ai: Optional[bool] = False

@app.post("/api/emotion/detect")
async def api_detect_emotion(req: DetectEmotionReq):
    config = load_config()
    result = await detect_emotion(req.text, use_ai=req.use_ai, config=config)
    return result


# Chat Background Upload API
@app.post("/api/chat/background")
async def upload_chat_background(file: UploadFile = File(...)):
    os.makedirs(BACKGROUNDS_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".jpg"
    if not ext or ext not in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".jfif"]:
        ext = ".jpg"
    filename = f"bg_{uuid.uuid4().hex[:10]}{ext}"
    filepath = os.path.join(BACKGROUNDS_DIR, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    return {"url": f"/backgrounds/{filename}"}

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
    gemini_models = await get_gemini_models(config.get("gemini_api_key", ""))
    gemini_web_models = await get_gemini_webapi_models(
        secure_1psid=config.get("gemini_web_secure_1psid", ""),
        secure_1psidts=config.get("gemini_web_secure_1psidts", ""),
        proxy=config.get("gemini_web_proxy", "")
    )
    openai_models = await get_openai_compatible_models(
        base_url=config.get("openai_base_url", "https://api.openai.com/v1"),
        api_key=config.get("openai_api_key", "")
    )
    
    return {
        "ollama": ollama_models,
        "gemini": gemini_models,
        "gemini_web": gemini_web_models,
        "openai": openai_models
    }

class TestConnectionReq(BaseModel):
    provider: str
    ollama_host: Optional[str] = "http://localhost:11434"
    gemini_api_key: Optional[str] = ""
    openai_api_key: Optional[str] = ""
    openai_base_url: Optional[str] = "https://api.openai.com/v1"
    secure_1psid: Optional[str] = ""
    secure_1psidts: Optional[str] = ""
    gemini_web_proxy: Optional[str] = ""

@app.post("/api/models/test")
async def test_model_connection(req: TestConnectionReq):
    result = await test_provider_connection(
        provider=req.provider,
        ollama_host=req.ollama_host or "http://localhost:11434",
        gemini_api_key=req.gemini_api_key or "",
        openai_api_key=req.openai_api_key or "",
        openai_base_url=req.openai_base_url or "https://api.openai.com/v1",
        secure_1psid=req.secure_1psid or "",
        secure_1psidts=req.secure_1psidts or "",
        gemini_web_proxy=req.gemini_web_proxy or ""
    )
    return result

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

            # Auto-detect emotion if enabled
            if persona.get("auto_emotion", True):
                try:
                    use_ai = persona.get("emotion_method") == "ai"
                    em_data = await detect_emotion(full_reply, use_ai=use_ai, config=config)
                    payload = json.dumps({
                        "type": "emotion",
                        "emotion": em_data["emotion"],
                        "name": em_data["name"],
                        "icon": em_data["icon"]
                    }, ensure_ascii=False)
                    yield f"data: {payload}\n\n"
                except Exception:
                    pass

        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

