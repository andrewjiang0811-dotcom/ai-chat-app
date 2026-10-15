import json
import re
from typing import Dict, Any, Optional
import httpx

EMOTION_KEYWORDS = {
    'shy': ['害羞', '臉紅', '討厭啦', '笨蛋', '哼！', '哼~', '哼，', '才沒有', '才不是', '哪有', '///', '😳', '喵~', '傲嬌', '不理你了', '心跳', '唔...'],
    'angry': ['生氣', '可惡', '氣死', '怒', '閉嘴', '過分', '不可原諒', '欠揍', '憤怒', '不准', '😠', '😡', '💢'],
    'sad': ['難過', '傷心', '嗚嗚', '對不起', '抱歉', '好慘', '心疼', '失落', '遺憾', '好痛', '沮喪', '委屈', '😭', '😢', '🥺', '💔'],
    'surprised': ['驚訝', '天啊', '不會吧', '震驚', '哇！', '真的假的', '怎麼會', '居然', '嚇到了', '不敢相信', '😱', '😲', '？！', '太神奇了'],
    'happy': ['開心', '太好了', '高興', '哈哈', '呵呵', '嘻嘻', '真棒', '太棒了', '喜歡', '愉快', '歡迎', '多指教', '太讚了', '好棒', '感謝', '榮幸', '😊', '😄', '🥰', '✨', '🎉', '❤️'],
    'thinking': ['讓我想想', '思考', '分析', '研究', '考慮', '推論', '理論上', '邏輯', '觀察', '探討', '關鍵在於', '🤔', '🧐']
}

EMOTION_NAMES = {
    'default': '預設 / 平常',
    'happy': '開心 / 歡喜',
    'shy': '害羞 / 傲嬌',
    'angry': '生氣 / 氣惱',
    'sad': '難過 / 哭泣',
    'surprised': '驚訝 / 震撼',
    'thinking': '思考 / 專注'
}

EMOTION_ICONS = {
    'default': '✨',
    'happy': '😊',
    'shy': '😳',
    'angry': '😠',
    'sad': '😢',
    'surprised': '😲',
    'thinking': '🤔'
}

def detect_emotion_rules(text: str) -> str:
    """Fast rule-based emotion detection from text in Traditional/Simplified Chinese."""
    if not text:
        return 'default'

    # Check matching keywords count or first match
    for emotion, kws in EMOTION_KEYWORDS.items():
        for kw in kws:
            if kw in text:
                return emotion
    return 'default'

async def detect_emotion_ai(text: str, config: Dict[str, Any]) -> str:
    """Analyze emotion using connected AI provider (DeepSeek, OpenAI, Gemini, Ollama)."""
    if not text.strip():
        return 'default'

    provider = config.get("provider", "openai")
    prompt = f"請分析以下這段 AI 回應的情緒語氣，請務必嚴格只回傳以下 7 個英文單詞之一（不要有多餘符號或解釋）：happy, shy, angry, sad, surprised, thinking, default。\n回應文本：{text[:300]}"

    try:
        if provider in ("openai", "custom"):
            api_key = config.get("openai_api_key", "")
            base_url = config.get("openai_base_url", "https://api.openai.com/v1").rstrip("/")
            model = config.get("model", "deepseek-chat")
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 10,
                "temperature": 0.1
            }
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
                if res.status_code == 200:
                    ans = res.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip().lower()
                    for em in ["happy", "shy", "angry", "sad", "surprised", "thinking", "default"]:
                        if em in ans:
                            return em
        elif provider == "gemini":
            api_key = config.get("gemini_api_key", "")
            if api_key:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
                payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
                async with httpx.AsyncClient(timeout=4.0) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        ans = res.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip().lower()
                        for em in ["happy", "shy", "angry", "sad", "surprised", "thinking", "default"]:
                            if em in ans:
                                return em
        elif provider == "ollama":
            host = config.get("ollama_host", "http://localhost:11434").rstrip("/")
            model = config.get("model", "llama3:latest")
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False
            }
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.post(f"{host}/api/chat", json=payload)
                if res.status_code == 200:
                    ans = res.json().get("message", {}).get("content", "").strip().lower()
                    for em in ["happy", "shy", "angry", "sad", "surprised", "thinking", "default"]:
                        if em in ans:
                            return em
    except Exception:
        pass

    return detect_emotion_rules(text)

async def detect_emotion(text: str, use_ai: bool = False, config: Dict[str, Any] = None) -> Dict[str, Any]:
    """Unified emotion detection returning emotion key, label name, and icon."""
    if use_ai and config:
        emotion = await detect_emotion_ai(text, config)
        method = "ai"
    else:
        emotion = detect_emotion_rules(text)
        method = "rules"

    return {
        "emotion": emotion,
        "name": EMOTION_NAMES.get(emotion, '預設'),
        "icon": EMOTION_ICONS.get(emotion, '✨'),
        "method": method
    }
