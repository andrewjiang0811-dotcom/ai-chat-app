import os
import json
import uuid
from typing import Dict, Any, Optional
import core.compat
from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
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
    load_persona_touch_zones,
    update_persona_emotion_settings,
    remove_persona_backgrounds,
    update_persona_sprite_view
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
DEVICES_DIR = os.path.join(DATA_DIR, "devices")
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(DEVICES_DIR, exist_ok=True)

DEFAULT_CONFIG = {
    "provider": "ollama",
    "model": "llama3:latest",
    "ollama_host": "http://localhost:11434",
    "gemini_api_key": "",
    "gemini_web_secure_1psid": "",
    "gemini_web_secure_1psidts": "",
    "gemini_web_secure_1psidcc": "",
    "gemini_web_proxy": "",
    "openai_api_key": "",
    "openai_base_url": "https://api.openai.com/v1",
    "tts_voice": DEFAULT_VOICE,
    "tts_auto_play": False
}

def get_device_id(req: Request) -> str:
    """Extract and sanitize device_id from request header or query parameter."""
    dev = req.headers.get("x-device-id") or req.query_params.get("device_id") or "default"
    clean = "".join(c for c in dev if c.isalnum() or c in ("-", "_")).strip()
    return clean or "default"

def get_device_config_path(device_id: str) -> str:
    clean = "".join(c for c in device_id if c.isalnum() or c in ("-", "_")).strip() or "default"
    return os.path.join(DEVICES_DIR, f"{clean}.json")

def load_global_config() -> Dict[str, Any]:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CONFIG_FILE):
        save_global_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            merged = DEFAULT_CONFIG.copy()
            merged.update(cfg)
            return merged
    except Exception:
        return DEFAULT_CONFIG.copy()

def save_global_config(cfg: Dict[str, Any]):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

# 敏感金鑰與帳號 Cookie 清單（嚴格隔離，絕不跨裝置洩漏主機的 Google 帳號或私人金鑰）
SENSITIVE_CREDENTIAL_KEYS = {
    "gemini_web_secure_1psid",
    "gemini_web_secure_1psidts",
    "gemini_web_secure_1psidcc",
    "gemini_api_key",
    "openai_api_key",
    "gemini_web_proxy"
}

def load_config(device_id: Optional[str] = "default") -> Dict[str, Any]:
    """Load config for a specific device, falling back to non-sensitive global defaults."""
    cfg = load_global_config()
    dev_id = (device_id or "default").strip()
    has_custom = False
    if dev_id and dev_id != "default":
        dev_file = get_device_config_path(dev_id)
        if os.path.exists(dev_file):
            try:
                with open(dev_file, "r", encoding="utf-8") as f:
                    overrides = json.load(f)
                    # 清除未在該裝置設定檔中明確指定的敏感憑證，杜絕自動繼承主機個人 Google 帳號 / 金鑰
                    for k in SENSITIVE_CREDENTIAL_KEYS:
                        if k not in overrides:
                            cfg[k] = ""
                    cfg.update(overrides)
                    has_custom = True
            except Exception:
                pass
        else:
            # 全新未設定裝置：清空所有敏感憑證，確保乾淨獨立空間
            for k in SENSITIVE_CREDENTIAL_KEYS:
                cfg[k] = ""
            # 若主機預設為雲端服務，新裝置預設為免金鑰的本地離線 Ollama
            if cfg.get("provider") in ("gemini_web", "gemini", "openai"):
                cfg["provider"] = "ollama"
                cfg["model"] = "llama3:latest"
    cfg["_device_id"] = dev_id
    cfg["_is_custom"] = has_custom
    return cfg

def save_config(cfg_updates: Dict[str, Any], device_id: Optional[str] = "default") -> Dict[str, Any]:
    """Save config. If device is 'default', updates global config; otherwise updates device override."""
    dev_id = (device_id or "default").strip()
    clean_updates = {k: v for k, v in cfg_updates.items() if not k.startswith("_") or k == "_nickname"}
    if dev_id == "default":
        curr = load_global_config()
        curr.update(clean_updates)
        save_global_config(curr)
        return load_config("default")
    else:
        dev_file = get_device_config_path(dev_id)
        dev_cfg = {}
        if os.path.exists(dev_file):
            try:
                with open(dev_file, "r", encoding="utf-8") as f:
                    dev_cfg = json.load(f)
            except Exception:
                dev_cfg = {}
        dev_cfg.update(clean_updates)
        with open(dev_file, "w", encoding="utf-8") as f:
            json.dump(dev_cfg, f, ensure_ascii=False, indent=2)
        return load_config(dev_id)

def reset_device_config(device_id: str):
    """Delete device-specific overrides and revert back to host defaults."""
    if device_id and device_id != "default":
        dev_file = get_device_config_path(device_id)
        if os.path.exists(dev_file):
            try:
                os.remove(dev_file)
            except Exception:
                pass

# Initialize Database on launch
init_db()

app = FastAPI(title="AI Chat App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
async def get_app_config(req: Request):
    dev_id = get_device_id(req)
    return load_config(dev_id)

@app.post("/api/config")
async def update_app_config(req: Request):
    dev_id = get_device_id(req)
    data = await req.json()
    cfg = save_config(data, device_id=dev_id)
    return {"status": "ok", "config": cfg}

@app.post("/api/config/reset")
async def reset_app_config(req: Request):
    dev_id = get_device_id(req)
    reset_device_config(dev_id)
    return {"status": "ok", "config": load_config(dev_id)}

@app.get("/api/devices")
async def list_device_profiles():
    """列出目前已註冊或自訂的身分/裝置列表，供使用者快速切換身分"""
    devices = [{"id": "default", "nickname": "主電腦預設 (Host)", "is_host": True}]
    if os.path.exists(DEVICES_DIR):
        for fname in os.listdir(DEVICES_DIR):
            if fname.endswith(".json"):
                dev_id = fname[:-5]
                try:
                    with open(os.path.join(DEVICES_DIR, fname), "r", encoding="utf-8") as f:
                        dcfg = json.load(f)
                    devices.append({
                        "id": dev_id,
                        "nickname": dcfg.get("_nickname") or dev_id,
                        "provider": dcfg.get("provider", "ollama"),
                        "has_gemini_web": bool(dcfg.get("gemini_web_secure_1psid")),
                        "is_host": False
                    })
                except Exception:
                    devices.append({"id": dev_id, "nickname": dev_id, "is_host": False})
    return devices

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
    persona_dir = os.path.join(AVATARS_DIR, persona_id)
    os.makedirs(persona_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
    if not ext or ext not in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".jfif"]:
        ext = ".png"
    filename = f"avatar_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(persona_dir, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    image_url = f"/avatars/{persona_id}/{filename}"
    updated = update_persona_avatar(persona_id, image_url, display_mode)
    return updated

@app.patch("/api/personas/{persona_id}/display_mode")
async def patch_persona_display_mode(persona_id: str, req: Request):
    data = await req.json()
    mode = data.get("display_mode", "half_body")
    p = get_persona(persona_id)
    updated = update_persona_avatar(persona_id, image_url=p.get("image_url", ""), display_mode=mode)
    return updated

@app.patch("/api/personas/{persona_id}/sprite_view")
@app.post("/api/personas/{persona_id}/sprite_view")
async def patch_persona_sprite_view(persona_id: str, req: Request):
    try:
        data = await req.json()
    except Exception:
        data = {}
    updated = update_persona_sprite_view(persona_id, data)
    return {
        "success": True,
        "persona_id": persona_id,
        "sprite_view": updated.get("sprite_view", {"scale": 1.0, "x": 0.0, "y": 0.0})
    }

# Emotion-Specific Sprites & Touch Zones APIs
@app.post("/api/personas/{persona_id}/emotions/{emotion}")
async def upload_persona_emotion_avatar_file(
    persona_id: str,
    emotion: str,
    file: UploadFile = File(...)
):
    persona_dir = os.path.join(AVATARS_DIR, persona_id)
    os.makedirs(persona_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
    if not ext or ext not in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".jfif"]:
        ext = ".png"
    filename = f"{emotion}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(persona_dir, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    image_url = f"/avatars/{persona_id}/{filename}"
    updated = update_persona_emotion_avatar(persona_id, emotion, image_url)
    return updated

@app.delete("/api/personas/{persona_id}/emotions/{emotion}")
async def remove_persona_emotion_avatar_file(persona_id: str, emotion: str):
    return delete_persona_emotion_avatar(persona_id, emotion)

@app.get("/api/personas/{persona_id}/touch_zones")
async def get_persona_touch_zones_endpoint(persona_id: str):
    zones = load_persona_touch_zones(persona_id)
    return {"persona_id": persona_id, "touch_zones": zones}

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
async def api_detect_emotion(req: DetectEmotionReq, http_req: Request):
    dev_id = get_device_id(http_req)
    config = load_config(dev_id)
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
async def list_chat_sessions(req: Request):
    dev_id = get_device_id(req)
    return get_sessions(dev_id)

@app.post("/api/sessions")
async def create_chat_session(req: Request, body: CreateSessionReq):
    dev_id = get_device_id(req)
    session_id = str(uuid.uuid4())
    cid = body.character_id or "assistant"
    session = create_session(session_id, body.title or "新對話", cid, device_id=dev_id)
    persona = get_persona(cid)
    if persona and persona.get("first_message"):
        add_message(session_id, "assistant", persona["first_message"])
    return session

@app.get("/api/sessions/{session_id}/messages")
async def get_session_message_history(session_id: str, req: Request):
    dev_id = get_device_id(req)
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if dev_id != "default" and session.get("device_id") and session.get("device_id") != dev_id:
        raise HTTPException(status_code=403, detail="Permission denied")
    messages = get_messages(session_id)
    return {"session": session, "messages": messages}

@app.patch("/api/sessions/{session_id}")
async def patch_session(session_id: str, req: Request):
    data = await req.json()
    update_session(session_id, title=data.get("title"), character_id=data.get("character_id"))
    return get_session(session_id)

@app.delete("/api/sessions/{session_id}")
async def remove_chat_session(session_id: str, req: Request):
    dev_id = get_device_id(req)
    success = delete_session(session_id, device_id=dev_id)
    if not success:
        raise HTTPException(status_code=403, detail="Permission denied or session not found")
    return {"status": "deleted"}

# Model query API
@app.get("/api/models")
async def list_available_models(req: Request):
    dev_id = get_device_id(req)
    config = load_config(dev_id)
    ollama_models = await get_ollama_models(config.get("ollama_host", "http://localhost:11434"))
    gemini_models = await get_gemini_models(config.get("gemini_api_key", ""))
    gemini_web_models = await get_gemini_webapi_models(
        secure_1psid=config.get("gemini_web_secure_1psid", ""),
        secure_1psidts=config.get("gemini_web_secure_1psidts", ""),
        secure_1psidcc=config.get("gemini_web_secure_1psidcc", ""),
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
    secure_1psidcc: Optional[str] = ""
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
        secure_1psidcc=req.secure_1psidcc or "",
        gemini_web_proxy=req.gemini_web_proxy or ""
    )
    return result

# Gemini Web One-Click Login & Cookie Extraction APIs
@app.post("/api/gemini/launch_login")
async def api_launch_gemini_login(req: Request):
    from core.cookie_extractor import launch_gemini_login_browser, get_device_cdp_port
    dev_id = get_device_id(req)
    port = get_device_cdp_port(dev_id)
    ok, msg = launch_gemini_login_browser(port=port, profile_id=dev_id)
    return {"success": ok, "message": msg, "port": port, "device_id": dev_id}

@app.post("/api/gemini/extract_cookies")
async def api_extract_gemini_cookies(req: Request):
    from core.cookie_extractor import extract_from_cdp_async, get_device_cdp_port
    dev_id = get_device_id(req)
    port = get_device_cdp_port(dev_id)
    ports = [port]
    if port != 9225:
        ports.append(9225)
    if port != 9222:
        ports.append(9222)

    ok, cookies, msg = await extract_from_cdp_async(ports)
    if ok and cookies.get("__Secure-1PSID"):
        cookie_updates = {
            "gemini_web_secure_1psid": cookies.get("__Secure-1PSID", ""),
            "gemini_web_secure_1psidts": cookies.get("__Secure-1PSIDTS", ""),
            "gemini_web_secure_1psidcc": cookies.get("__Secure-1PSIDCC", ""),
            "provider": "gemini_web"
        }
        save_config(cookie_updates, device_id=dev_id)

        # 僅當操作者為主機 (default) 裝置時，才快取至全域 gemini_cookies.json
        if dev_id == "default":
            try:
                cookie_file = os.path.join(DATA_DIR, "gemini_cookies.json")
                with open(cookie_file, "w", encoding="utf-8") as f:
                    json.dump(cookies, f, indent=2, ensure_ascii=False)
            except Exception:
                pass

        return {
            "success": True,
            "cookies": {
                "__Secure-1PSID": cookies.get("__Secure-1PSID", ""),
                "__Secure-1PSIDTS": cookies.get("__Secure-1PSIDTS", ""),
                "__Secure-1PSIDCC": cookies.get("__Secure-1PSIDCC", "")
            },
            "message": f"成功從登入瀏覽器中讀取到 Cookie，並已自動儲存至您的裝置 ({dev_id}) 專屬設定！"
        }
    return {
        "success": False,
        "message": f"尚未在瀏覽器中偵測到登入成功的 Cookie（{msg}），請確認您已在開啟的視窗中完成 Google 登入！"
    }

class ParseCookiesReq(BaseModel):
    raw_text: str

@app.post("/api/gemini/parse_cookies")
async def api_parse_gemini_cookies(body: ParseCookiesReq, req: Request):
    from core.cookie_extractor import parse_cookie_string
    dev_id = get_device_id(req)
    cookies = parse_cookie_string(body.raw_text)
    if cookies.get("__Secure-1PSID"):
        cookie_updates = {
            "gemini_web_secure_1psid": cookies.get("__Secure-1PSID", ""),
            "gemini_web_secure_1psidts": cookies.get("__Secure-1PSIDTS", ""),
            "gemini_web_secure_1psidcc": cookies.get("__Secure-1PSIDCC", ""),
            "provider": "gemini_web"
        }
        save_config(cookie_updates, device_id=dev_id)
        return {
            "success": True,
            "cookies": cookies,
            "message": f"成功解析並已自動儲存至您的裝置 ({dev_id}) 設定！"
        }
    return {
        "success": False,
        "cookies": {},
        "message": "未能從貼上的文字中解析出 __Secure-1PSID。請確認內容包含 Google Cookie 字串或 cURL 請求！"
    }

class SyncCookiesReq(BaseModel):
    cookies: Optional[Dict[str, str]] = None
    raw_text: Optional[str] = None

@app.post("/api/gemini/sync_cookies")
async def api_sync_gemini_cookies(body: SyncCookiesReq, req: Request):
    from core.cookie_extractor import parse_cookie_string
    dev_id = get_device_id(req)
    found = {}
    if body.cookies:
        found = body.cookies
    elif body.raw_text:
        found = parse_cookie_string(body.raw_text)

    sid = found.get("__Secure-1PSID") or found.get("gemini_web_secure_1psid")
    if sid:
        cookie_updates = {
            "gemini_web_secure_1psid": sid,
            "gemini_web_secure_1psidts": found.get("__Secure-1PSIDTS") or found.get("gemini_web_secure_1psidts") or "",
            "gemini_web_secure_1psidcc": found.get("__Secure-1PSIDCC") or found.get("gemini_web_secure_1psidcc") or "",
            "provider": "gemini_web"
        }
        save_config(cookie_updates, device_id=dev_id)
        return {
            "success": True,
            "message": f"成功綁定您的 Google Gemini 帳號至裝置 ({dev_id})！",
            "cookies": cookie_updates
        }
    return {
        "success": False,
        "message": "未包含有效的 __Secure-1PSID Cookie！"
    }

@app.get("/api/gemini/download_helper")
async def api_download_gemini_helper(req: Request):
    """
    提供給家庭成員在自己的 Windows 電腦上一鍵執行的登入批次檔。
    在遠端電腦開啟 Chrome 登入後，自動提取 Cookie 並回傳給本主機儲存至該成員的裝置設定。
    """
    dev_id = get_device_id(req)
    host = req.headers.get("host") or "127.0.0.1:8000"
    server_url = f"http://{host}"

    template = r"""@echo off
chcp 65001 >nul
title AI 助手 - 家人 Gemini 帳號快速登入與同步小工具
color 0b
echo ========================================================
echo   AI 助手 - 家人 Gemini 帳號一鍵登入同步工具
echo   目標裝置身分: __TARGET_DEV_ID__
echo   伺服器位址: __SERVER_URL__
echo ========================================================
echo.
echo [1/3] 正在尋找本機之 Google Chrome 或 Microsoft Edge 瀏覽器...

set BROWSER_EXE=
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set BROWSER_EXE="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set BROWSER_EXE="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set BROWSER_EXE="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set BROWSER_EXE="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set BROWSER_EXE="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if not defined BROWSER_EXE (
    echo [錯誤] 未在本機找到 Chrome 或 Edge 瀏覽器！請手動安裝後再試。
    pause
    exit /b 1
)

set TEMP_PROFILE=%TEMP%\gemini_family___TARGET_DEV_ID__
if not exist "%TEMP_PROFILE%" mkdir "%TEMP_PROFILE%"

echo [2/3] 正在開啟專用登入視窗，請在彈出的視窗中登入您的 Google 帳號...
start "" %BROWSER_EXE% --user-data-dir="%TEMP_PROFILE%" --remote-debugging-port=9225 --no-first-run --no-default-browser-check "https://gemini.google.com"

echo.
echo [3/3] 正在監控並讀取登入 Cookie (免按 F12，全自動偵測)...
echo 請在剛剛開啟的網頁中完成登入...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$devId = '__TARGET_DEV_ID__'; $server = '__SERVER_URL__'; $found = $false; ^
   for ($i = 0; $i -lt 40; $i++) { ^
     Start-Sleep -Seconds 2; ^
     try { ^
       $tabs = Invoke-RestMethod -Uri 'http://127.0.0.1:9225/json' -TimeoutSec 2 -ErrorAction SilentlyContinue; ^
       $wsUrl = ($tabs | Where-Object { $_.url -like '*gemini.google.com*' -and $_.webSocketDebuggerUrl } | Select-Object -First 1).webSocketDebuggerUrl; ^
       if (-not $wsUrl) { $wsUrl = ($tabs | Where-Object { $_.webSocketDebuggerUrl } | Select-Object -First 1).webSocketDebuggerUrl }; ^
       if ($wsUrl) { ^
         $ws = New-Object System.Net.WebSockets.ClientWebSocket; ^
         $cts = New-Object System.Threading.CancellationTokenSource(3000); ^
         $task = $ws.ConnectAsync([uri]$wsUrl, $cts.Token); ^
         $task.Wait(); ^
         $cmd = [System.Text.Encoding]::UTF8.GetBytes('{\"id\":1,\"method\":\"Network.getAllCookies\"}'); ^
         $sendTask = $ws.SendAsync([ArraySegment[byte]]$cmd, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token); ^
         $sendTask.Wait(); ^
         $buffer = New-Object byte[] 65536; ^
         $segment = New-Object ArraySegment[byte] -ArgumentList @(,$buffer); ^
         $recvTask = $ws.ReceiveAsync($segment, $cts.Token); ^
         $recvTask.Wait(); ^
         $jsonStr = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $recvTask.Result.Count); ^
         $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', $cts.Token).Wait() | Out-Null; ^
         $data = $jsonStr | ConvertFrom-Json; ^
         $sid = ($data.result.cookies | Where-Object { $_.name -eq '__Secure-1PSID' } | Select-Object -First 1).value; ^
         $ts = ($data.result.cookies | Where-Object { $_.name -eq '__Secure-1PSIDTS' } | Select-Object -First 1).value; ^
         $cc = ($data.result.cookies | Where-Object { $_.name -eq '__Secure-1PSIDCC' } | Select-Object -First 1).value; ^
         if ($sid) { ^
           Write-Host '===> 偵測到登入成功！正在同步至 AI 助手...'; ^
           $bodyObj = @{ cookies = @{ '__Secure-1PSID' = $sid; '__Secure-1PSIDTS' = $ts; '__Secure-1PSIDCC' = $cc } }; ^
           $postJson = $bodyObj | ConvertTo-Json; ^
           $syncResp = Invoke-RestMethod -Uri \"$server/api/gemini/sync_cookies?device_id=$devId\" -Method Post -Body $postJson -ContentType 'application/json'; ^
           Write-Host ('[OK] ' + $syncResp.message); ^
           $found = $true; ^
           break; ^
         } ^
       } ^
     } catch {} ^
   } ^
   if (-not $found) { Write-Host '[提示] 超時或尚未完成登入。請確認已成功登入 Google 帳號！' }"

echo.
echo ========================================================
echo   同步作業結束！若顯示 [OK] 則表示已成功綁定！
echo   您可以關閉此小工具並回到 AI 助手網頁開始暢聊～
echo ========================================================
pause
"""
    bat_script = template.replace("__TARGET_DEV_ID__", dev_id).replace("__SERVER_URL__", server_url)

    return Response(
        content=bat_script.encode("utf-8"),
        media_type="application/x-bat",
        headers={"Content-Disposition": f"attachment; filename=login_gemini_{dev_id}.bat"}
    )

# TTS Voice APIs
@app.get("/api/voices")
async def list_voices():
    return AVAILABLE_VOICES

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None

@app.post("/api/tts")
async def generate_tts(body: TTSRequest, req: Request):
    dev_id = get_device_id(req)
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")
    config = load_config(dev_id)
    voice = body.voice or config.get("tts_voice", DEFAULT_VOICE)
    try:
        audio_data = await synthesize_speech(body.text, voice)
        return Response(content=audio_data, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {str(e)}")

# Chat Streaming API
class SendMessageReq(BaseModel):
    content: str
    character_id: Optional[str] = None

@app.post("/api/sessions/{session_id}/chat")
async def chat_stream(session_id: str, body: SendMessageReq, req: Request):
    dev_id = get_device_id(req)
    session = get_session(session_id)
    if not session:
        # Auto-create if not exists
        character_id = body.character_id or "assistant"
        session = create_session(session_id, "新對話", character_id, device_id=dev_id)

    # Save user message
    add_message(session_id, "user", body.content)

    # Auto title update if this is the first turn
    existing_msgs = get_messages(session_id)
    if len(existing_msgs) <= 2 and (session["title"] == "新對話" or not session["title"]):
        # Extract first 15 chars as title
        clean_title = body.content.strip().split("\n")[0][:15]
        update_session(session_id, title=clean_title)

    # Fetch persona
    character_id = body.character_id or session.get("character_id", "assistant")
    persona = get_persona(character_id)

    # Build context messages
    context = [{"role": "system", "content": persona["system_prompt"]}]
    for m in existing_msgs[-12:]:  # Keep recent history
        if m["role"] in ("user", "assistant"):
            context.append({"role": m["role"], "content": m["content"]})

    config = load_config(dev_id)
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

