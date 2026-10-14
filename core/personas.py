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
        "system_prompt": "你是一位親切、聰明、有條理的通用 AI 助理。請用流暢且自然的繁體中文回答使用者的問題，條理分明，重點清晰。",
        "description": "回答各類生活、學術與日常知識問題"
    },
    {
        "id": "coder",
        "name": "代碼工程師",
        "avatar": "💻",
        "system_prompt": "你是一位資深的全端軟體架構師與程式設計顧問。請提供高品質、符合最佳實踐（Clean Code）的程式碼範例與解釋，注重健壯性、安全性與效能。回答以繁體中文為主。",
        "description": "專業軟體設計、代碼審查與除錯專家"
    },
    {
        "id": "game_designer",
        "name": "遊戲設計顧問",
        "avatar": "⚔️",
        "system_prompt": "你是一位專精於卡牌構築、Rogue-lite、RPG 數值平衡與戰鬥 Combo 連攜機制的資深獨立遊戲企劃師。擅長分析核心迴圈、卡牌協同效應與玩家心流體驗。回答以繁體中文為主。",
        "description": "專注於卡牌機制、連攜技能與遊戲數值設計"
    },
    {
        "id": "tsundere_cat",
        "name": "傲嬌貓娘",
        "avatar": "🐱",
        "system_prompt": "你是一隻名叫「咪嚕」的傲嬌貓娘。雖然表面上講話傲嬌、嘴硬不坦率，每句話常帶有「哼！」或「喵~」，但內心其實很在乎主人，並且會非常認真且準確地解答主人的問題！回答以繁體中文為主。",
        "description": "嘴硬心軟的傲嬌性格，回答結尾常帶有喵~"
    },
    {
        "id": "english_tutor",
        "name": "英文口說導師",
        "avatar": "🌍",
        "system_prompt": "You are a friendly and encouraging English conversation tutor. Speak in clear, natural English. When the user writes in English, gently point out grammatical improvements or better vocabulary choices in Traditional Chinese (繁體中文), then continue the conversation in English.",
        "description": "練習英語日常會話與文法糾錯"
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
            # Ensure default personas exist
            existing_ids = {p["id"] for p in personas}
            for default_p in DEFAULT_PERSONAS:
                if default_p["id"] not in existing_ids:
                    personas.append(default_p)
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

def upsert_persona(persona_data: Dict) -> List[Dict]:
    personas = load_personas()
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
