import os
import json
from typing import List, Dict

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
PERSONAS_FILE = os.path.join(DATA_DIR, "personas.json")

DEFAULT_PERSONAS = [
    {
        "id": "assistant",
        "name": "萬能助理",
        "avatar": "🤖",
        "image_url": "",
        "display_mode": "half_body",
        "system_prompt": "你是一位親切、聰明、有條理的通用 AI 助理。請用流暢且自然的繁體中文回答使用者的問題，條理分明，重點清晰。",
        "description": "回答各類生活、學術與日常知識問題"
    },
    {
        "id": "coder",
        "name": "代碼工程師",
        "avatar": "💻",
        "image_url": "",
        "display_mode": "half_body",
        "system_prompt": "你是一位資深的全端軟體架構師與程式設計顧問。請提供高品質、符合最佳實踐（Clean Code）的程式碼範例與解釋，注重健壯性、安全性與效能。回答以繁體中文為主。",
        "description": "專業軟體設計、代碼審查與除錯專家"
    },
    {
        "id": "game_designer",
        "name": "遊戲設計顧問",
        "avatar": "⚔️",
        "image_url": "",
        "display_mode": "half_body",
        "system_prompt": "你是一位專精於卡牌構築、Rogue-lite、RPG 數值平衡與戰鬥 Combo 連攜機制的資深獨立遊戲企劃師。擅長分析核心迴圈、卡牌協同效應與玩家心流體驗。回答以繁體中文為主。",
        "description": "專注於卡牌機制、連攜技能與遊戲數值設計"
    },
    {
        "id": "tsundere_cat",
        "name": "傲嬌貓娘",
        "avatar": "🐱",
        "image_url": "",
        "display_mode": "half_body",
        "system_prompt": "你是一隻名叫「咪嚕」的傲嬌貓娘。雖然表面上講話傲嬌、嘴硬不坦率，每句話常帶有「哼！」或「喵~」，但內心其實很在乎主人，並且會非常認真且準確地解答主人的問題！回答以繁體中文為主。",
        "description": "嘴硬心軟的傲嬌性格，回答結尾常帶有喵~"
    },
    {
        "id": "english_tutor",
        "name": "英文口說導師",
        "avatar": "🌍",
        "image_url": "",
        "display_mode": "half_body",
        "system_prompt": "You are a friendly and encouraging English conversation tutor. Speak in clear, natural English. When the user writes in English, gently point out grammatical improvements or better vocabulary choices in Traditional Chinese (繁體中文), then continue the conversation in English.",
        "description": "練習英語日常會話與文法糾錯"
    }
]

DEFAULT_TOUCH_ZONES = [
    {
        "id": "head_touch",
        "name": "頭部 (摸摸頭)",
        "emotion": "happy",
        "dialogue": "（被輕輕摸了摸頭）嘿嘿～好舒服喔，謝謝你！",
        "x": 28,
        "y": 6,
        "width": 44,
        "height": 22,
        "priority": 1
    },
    {
        "id": "face_touch",
        "name": "嘴部 / 臉頰 (捏捏臉)",
        "emotion": "shy",
        "dialogue": "（臉頰泛起微紅）哇...！突然碰我的臉，好害羞喔...",
        "x": 35,
        "y": 28,
        "width": 30,
        "height": 18,
        "priority": 2
    },
    {
        "id": "body_touch",
        "name": "身體 / 手部 (牽牽手)",
        "emotion": "happy",
        "dialogue": "（溫暖地握住你的手）我們一起繼續加油吧！",
        "x": 25,
        "y": 48,
        "width": 50,
        "height": 38,
        "priority": 3
    }
]

def load_personas() -> List[Dict]:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(PERSONAS_FILE):
        save_personas(DEFAULT_PERSONAS)
        return DEFAULT_PERSONAS
    
    try:
        with open(PERSONAS_FILE, "r", encoding="utf-8") as f:
            personas = json.load(f)
            # Ensure default personas exist and populate missing fields
            existing_ids = {p["id"] for p in personas}
            for default_p in DEFAULT_PERSONAS:
                if default_p["id"] not in existing_ids:
                    personas.append(default_p)
            for p in personas:
                if "image_url" not in p:
                    p["image_url"] = ""
                if "display_mode" not in p:
                    p["display_mode"] = "half_body"
                if "emotions" not in p or not isinstance(p["emotions"], dict):
                    p["emotions"] = {"default": p.get("image_url", "")}
                elif "default" not in p["emotions"] and p.get("image_url"):
                    p["emotions"]["default"] = p["image_url"]
                if "touch_zones" not in p or not isinstance(p["touch_zones"], list):
                    p["touch_zones"] = [dict(z) for z in DEFAULT_TOUCH_ZONES]
                if "auto_emotion" not in p:
                    p["auto_emotion"] = True
                if "emotion_method" not in p:
                    p["emotion_method"] = "rules"
            return personas
    except Exception:
        return DEFAULT_PERSONAS

def save_personas(personas: List[Dict]):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(PERSONAS_FILE, "w", encoding="utf-8") as f:
        json.dump(personas, f, ensure_ascii=False, indent=2)

def get_persona(persona_id: str) -> Dict:
    personas = load_personas()
    for p in personas:
        if p["id"] == persona_id:
            return p
    return personas[0] if personas else DEFAULT_PERSONAS[0]

def update_persona_avatar(persona_id: str, image_url: str, display_mode: str = None) -> Dict:
    personas = load_personas()
    target = None
    for p in personas:
        if p["id"] == persona_id:
            p["image_url"] = image_url
            if "emotions" not in p or not isinstance(p["emotions"], dict):
                p["emotions"] = {}
            p["emotions"]["default"] = image_url
            if display_mode:
                p["display_mode"] = display_mode
            target = p
            break
    save_personas(personas)
    return target or get_persona(persona_id)

def update_persona_emotion_avatar(persona_id: str, emotion: str, image_url: str) -> Dict:
    personas = load_personas()
    target = None
    for p in personas:
        if p["id"] == persona_id:
            if "emotions" not in p or not isinstance(p["emotions"], dict):
                p["emotions"] = {}
                if p.get("image_url"):
                    p["emotions"]["default"] = p["image_url"]
            p["emotions"][emotion] = image_url
            if emotion == "default" or not p.get("image_url"):
                p["image_url"] = image_url
            target = p
            break
    save_personas(personas)
    return target or get_persona(persona_id)

def delete_persona_emotion_avatar(persona_id: str, emotion: str) -> Dict:
    personas = load_personas()
    target = None
    for p in personas:
        if p["id"] == persona_id:
            if "emotions" in p and emotion in p["emotions"]:
                del p["emotions"][emotion]
                if emotion == "default":
                    p["image_url"] = ""
            target = p
            break
    save_personas(personas)
    return target or get_persona(persona_id)

def update_persona_touch_zones(persona_id: str, touch_zones: List[Dict]) -> Dict:
    personas = load_personas()
    target = None
    for p in personas:
        if p["id"] == persona_id:
            p["touch_zones"] = touch_zones
            target = p
            break
    save_personas(personas)
    return target or get_persona(persona_id)

def update_persona_emotion_settings(persona_id: str, auto_emotion: bool, emotion_method: str = "rules") -> Dict:
    personas = load_personas()
    target = None
    for p in personas:
        if p["id"] == persona_id:
            p["auto_emotion"] = auto_emotion
            p["emotion_method"] = emotion_method
            target = p
            break
    save_personas(personas)
    return target or get_persona(persona_id)

def upsert_persona(persona_data: Dict) -> List[Dict]:
    personas = load_personas()
    if "image_url" not in persona_data:
        persona_data["image_url"] = ""
    if "display_mode" not in persona_data:
        persona_data["display_mode"] = "half_body"
    if "emotions" not in persona_data or not isinstance(persona_data["emotions"], dict):
        persona_data["emotions"] = {"default": persona_data.get("image_url", "")}
    if "touch_zones" not in persona_data:
        persona_data["touch_zones"] = [dict(z) for z in DEFAULT_TOUCH_ZONES]
    if "auto_emotion" not in persona_data:
        persona_data["auto_emotion"] = True
    if "emotion_method" not in persona_data:
        persona_data["emotion_method"] = "rules"

    updated = False
    for i, p in enumerate(personas):
        if p["id"] == persona_data["id"]:
            personas[i] = persona_data
            updated = True
            break
    if not updated:
        personas.append(persona_data)
    save_personas(personas)
    return personas

def delete_persona(persona_id: str) -> List[Dict]:
    personas = load_personas()
    personas = [p for p in personas if p["id"] != persona_id]
    save_personas(personas)
    return personas

def make_image_transparent(src_path: str, out_path: str) -> bool:
    try:
        import cv2
        import numpy as np
        
        # Read with unchanged channels (BGRA if already PNG with alpha)
        src = cv2.imread(src_path, cv2.IMREAD_UNCHANGED)
        if src is None:
            return False
            
        # If image already has a valid alpha channel with transparency, preserve it!
        if src.ndim == 3 and src.shape[2] == 4:
            alpha = src[:, :, 3]
            if np.mean(alpha < 200) > 0.05:
                cv2.imwrite(out_path, src)
                return True
            src = src[:, :, :3]
            
        h, w = src.shape[:2]
        hsv = cv2.cvtColor(src, cv2.COLOR_BGR2HSV)
        
        # Check if chroma key green (H 38..82, S >= 110, V >= 90)
        is_green = (hsv[:, :, 0] >= 38) & (hsv[:, :, 0] <= 82) & (hsv[:, :, 1] >= 110) & (hsv[:, :, 2] >= 90)
        green_ratio = np.mean(is_green)
        
        if green_ratio > 0.15:
            # High-precision chroma key
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            cleaned_green = cv2.morphologyEx(is_green.astype(np.uint8), cv2.MORPH_CLOSE, kernel)
            alpha = np.where(cleaned_green > 0, 0, 255).astype(np.uint8)
            
            # Green spill suppression on boundary
            dilated_green = cv2.dilate(cleaned_green, kernel, iterations=1)
            boundary = (dilated_green > 0) & (cleaned_green == 0)
            b, g, r = cv2.split(src)
            g[boundary] = np.minimum(g[boundary], np.maximum(b[boundary], r[boundary]))
            
            alpha_smooth = cv2.GaussianBlur(alpha, (3, 3), 0)
            rgba = cv2.merge([b, g, r, alpha_smooth])
            cv2.imwrite(out_path, rgba)
            return True
        else:
            # Safe white background removal: flood fill from outer borders only
            # Inner white clothing/hair is completely protected
            is_white = (src[:, :, 0] >= 240) & (src[:, :, 1] >= 240) & (src[:, :, 2] >= 240)
            flood_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
            corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2), (w - 1, h // 2)]
            for cx, cy in corners:
                if is_white[cy, cx]:
                    cv2.floodFill(src.copy(), flood_mask, (cx, cy), (0, 0, 0),
                                  loDiff=(20, 20, 20), upDiff=(20, 20, 20),
                                  flags=4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY)
            bg_mask = (flood_mask[1:-1, 1:-1] == 255)
            alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
            alpha_smooth = cv2.GaussianBlur(alpha, (3, 3), 0)
            b, g, r = cv2.split(src)
            rgba = cv2.merge([b, g, r, alpha_smooth])
            cv2.imwrite(out_path, rgba)
            return True
    except Exception as e:
        print("make_image_transparent error:", e)
        return False

def remove_persona_backgrounds(persona_id: str, avatars_dir: str) -> Dict:
    personas = load_personas()
    target = None
    for p in personas:
        if p["id"] == persona_id:
            target = p
            break
    if not target:
        return {}
        
    emotions = target.get("emotions", {})
    updated_emotions = {}
    
    main_img = target.get("image_url", "")
    if main_img and main_img.startswith("/avatars/"):
        filename = os.path.basename(main_img)
        src_path = os.path.join(avatars_dir, filename)
        base_name, _ = os.path.splitext(filename)
        out_filename = f"{base_name}.png"
        out_path = os.path.join(avatars_dir, out_filename)
        if make_image_transparent(src_path, out_path):
            target["image_url"] = f"/avatars/{out_filename}"
            
    for emo_key, img_url in emotions.items():
        if img_url and img_url.startswith("/avatars/"):
            filename = os.path.basename(img_url)
            src_path = os.path.join(avatars_dir, filename)
            base_name, _ = os.path.splitext(filename)
            out_filename = f"{base_name}.png"
            out_path = os.path.join(avatars_dir, out_filename)
            if make_image_transparent(src_path, out_path):
                updated_emotions[emo_key] = f"/avatars/{out_filename}"
            else:
                updated_emotions[emo_key] = img_url
        else:
            updated_emotions[emo_key] = img_url
            
    target["emotions"] = updated_emotions
    save_personas(personas)
    return target



