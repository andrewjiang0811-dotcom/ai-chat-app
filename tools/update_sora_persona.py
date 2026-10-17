import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERSONAS_FILE = os.path.join(BASE_DIR, "data", "personas.json")
TOUCH_ZONES_FILE = os.path.join(BASE_DIR, "data", "touch_zones", "game_designer.json")

with open(TOUCH_ZONES_FILE, "r", encoding="utf-8") as f:
    sora_touch_zones = json.load(f)

with open(PERSONAS_FILE, "r", encoding="utf-8") as f:
    personas = json.load(f)

sora_system_prompt = (
    "你是一位名叫「Sora（空）」的女性資深獨立遊戲企劃師與創意總監。\n"
    "【外型形象】：高束日落珊瑚橘（Sunset Coral）高馬尾帶有靈動呆毛，一雙閃亮的琥珀金瞳；"
    "身著深酒紅短版冒險者外套（別滿像素與獨立遊戲徽章）、掛著開發者識別證（SORA）、工裝百褶短裙與復古繫帶馬靴，"
    "一手拿著魔導掌機，另一手能召喚出懸浮的立體全息遊戲卡牌，腰間繫著二十面骰袋。\n"
    "【性格說話風格】：\n"
    "1. 充滿熱忱與創造力：熱愛各類遊戲（特別是卡牌構築、Rogue-lite、RPG 數值平衡與戰鬥 Combo 連攜機制），"
    "說話充滿活力與冒險感，經常使用「心流體驗（Flow）」、「正反饋循環」、「數值協同（Synergy）」等專業且生動的詞彙。\n"
    "2. 數值與機制專家：擅長用條理分明、數值公式與具體案例拆解遊戲核心迴圈（Core Loop）、經濟系統平衡與打擊反饋感。\n"
    "3. 玩家導向：堅決反對無腦課金與傷害玩家體驗的惡意設計，永遠站在「如何讓遊戲變得極致好玩、讓人欲罷不能」的角度為使用者提供建議。\n"
    "4. 語言要求：一律使用流暢、自然且富有感染力的繁體中文回答。"
)

emotions_dict = {
    "default": "/avatars/game_designer/default.png",
    "happy": "/avatars/game_designer/happy.png",
    "thinking": "/avatars/game_designer/thinking.png",
    "surprised": "/avatars/game_designer/surprised.png",
    "shy": "/avatars/game_designer/shy.png",
    "angry": "/avatars/game_designer/angry.png",
    "sad": "/avatars/game_designer/sad.png"
}

updated = False
for p in personas:
    if p.get("id") == "game_designer":
        p["name"] = "Sora 遊戲創意總監"
        p["avatar"] = "🎲"
        p["description"] = "奇幻冒險家兼鬼才遊戲製作人，專攻卡牌構築、Rogue-lite 與數值心流"
        p["image_url"] = "/avatars/game_designer/default.png"
        p["display_mode"] = "full_body"
        p["system_prompt"] = sora_system_prompt
        p["emotions"] = emotions_dict
        p["touch_zones"] = sora_touch_zones
        p["auto_emotion"] = True
        p["emotion_method"] = "rules"
        updated = True
        break

if not updated:
    personas.append({
        "id": "game_designer",
        "name": "Sora 遊戲創意總監",
        "avatar": "🎲",
        "description": "奇幻冒險家兼鬼才遊戲製作人，專攻卡牌構築、Rogue-lite 與數值心流",
        "image_url": "/avatars/game_designer/default.png",
        "display_mode": "full_body",
        "system_prompt": sora_system_prompt,
        "emotions": emotions_dict,
        "touch_zones": sora_touch_zones,
        "auto_emotion": True,
        "emotion_method": "rules"
    })

with open(PERSONAS_FILE, "w", encoding="utf-8") as f:
    json.dump(personas, f, ensure_ascii=False, indent=2)

print("personas.json updated successfully with Sora (game_designer)!")
