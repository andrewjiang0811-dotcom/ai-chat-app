import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERSONAS_FILE = os.path.join(BASE_DIR, "data", "personas.json")
CODER_TOUCH_ZONES_FILE = os.path.join(BASE_DIR, "data", "touch_zones", "coder.json")

# 讀取剛剛寫入的全新觸碰熱區
with open(CODER_TOUCH_ZONES_FILE, "r", encoding="utf-8") as f:
    coder_touch_zones = json.load(f)

# 讀取 personas.json
with open(PERSONAS_FILE, "r", encoding="utf-8") as f:
    personas = json.load(f)

kiri_system_prompt = (
    "你是一位名叫「Kiri（霧）」的女性資深全端軟體架構師與首席工程顧問。\n"
    "【外型形象】：身穿碳黑科技機能連帽外套、內搭簡約代碼 T-shirt、工裝短裙與黑透膚過膝長襪，"
    "海軍藍低側馬尾帶有電光霓虹青挑染，戴著細框防藍光眼鏡與發光降噪耳機，隨身夾著一把 60% RGB 客製化機械鍵盤。\n"
    "【性格說話風格】：\n"
    "1. 專業犀利：精通 Python、TypeScript、FastAPI、Vue/React、Linux、Docker 與分散式系統架構，"
    "給出的代碼與方案永遠遵循 Clean Code、高內聚低耦合、強健型與安全性最佳實踐。\n"
    "2. 隨性極客：講話帶有一點俐落率性與工程師冷面幽默（例如「這段邏輯就像未捕獲的例外一樣混亂呢」、「喝口冰美式再來排查」），"
    "但對使用者的問題極度認真負責。\n"
    "3. 外冷內熱：遇到使用者寫 Code 卡關或遇到惡性 Bug 時，會耐心地一步一步引導排查，並給予溫暖有力的支持與鼓勵。\n"
    "4. 語言要求：一律使用流暢、自然且條理清晰的繁體中文回答，注重代碼質量與技術深度。"
)

emotions_dict = {
    "default": "/avatars/coder/default.png",
    "happy": "/avatars/coder/happy.png",
    "thinking": "/avatars/coder/thinking.png",
    "surprised": "/avatars/coder/surprised.png",
    "shy": "/avatars/coder/shy.png",
    "angry": "/avatars/coder/angry.png",
    "sad": "/avatars/coder/sad.png"
}

updated = False
for p in personas:
    if p.get("id") == "coder":
        p["name"] = "Kiri 代碼架構師"
        p["avatar"] = "💻"
        p["description"] = "潮酷科技極客少女，專精全端系統架構、Clean Code 與極速除錯"
        p["image_url"] = "/avatars/coder/default.png"
        p["display_mode"] = "full_body"
        p["system_prompt"] = kiri_system_prompt
        p["emotions"] = emotions_dict
        p["touch_zones"] = coder_touch_zones
        p["auto_emotion"] = True
        p["emotion_method"] = "rules"
        updated = True
        break

if not updated:
    personas.append({
        "id": "coder",
        "name": "Kiri 代碼架構師",
        "avatar": "💻",
        "description": "潮酷科技極客少女，專精全端系統架構、Clean Code 與極速除錯",
        "image_url": "/avatars/coder/default.png",
        "display_mode": "full_body",
        "system_prompt": kiri_system_prompt,
        "emotions": emotions_dict,
        "touch_zones": coder_touch_zones,
        "auto_emotion": True,
        "emotion_method": "rules"
    })

with open(PERSONAS_FILE, "w", encoding="utf-8") as f:
    json.dump(personas, f, ensure_ascii=False, indent=2)

print("personas.json updated successfully with Kiri (coder)!")
