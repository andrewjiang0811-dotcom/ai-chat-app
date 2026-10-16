"""
英文口說導師 (English Speaking Tutor) 全表情立繪生成與自動去背腳本
"""

import os
import sys
import json
import asyncio
import cv2
import numpy as np
from gemini_webapi import GeminiClient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from core.cookie_extractor import get_or_sync_gemini_cookies

PERSONA_ID = "english_tutor"
RAW_DIR = os.path.join(BASE_DIR, "data", "raw_sprites", PERSONA_ID)
AVATAR_DIR = os.path.join(BASE_DIR, "data", "avatars", PERSONA_ID)
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(AVATAR_DIR, exist_ok=True)

# 共享角色特徵 Prompt（確保每張情緒的長相、髮型、體態與服裝一致）
BASE_CHARACTER_PROMPT = (
    "Full length full-body anime character sprite: gorgeous mature female English speaking tutor named Elena. "
    "Voluptuous curvy hourglass figure, beautiful mature face, elegant styling. "
    "Hairstyle: Lustrous long wavy golden-blonde hair flowing over shoulders gracefully. "
    "Eyes: Sparkling deep azure blue anime eyes. "
    "Glasses: Fashionable stylish thin gold wire-frame glasses resting on bridge of nose. "
    "Outfit: Tailored form-fitting dark navy blue teacher blazer jacket over a neat white collared blouse, "
    "matching dark navy pencil skirt, sheer black pantyhose stockings, glossy black high-heel pumps. "
    "Standing full body shot, entire character from head to toes visible within frame, no cropping. "
    "Background requirement: Solid pure bright green screen background #00FF00, flat even chroma key green, "
    "no background details, 2D visual novel character sprite key art, clean crisp lines."
)

EMOTION_PROMPTS = {
    "default": (
        f"{BASE_CHARACTER_PROMPT} "
        "Pose: Standing gracefully, holding a stylish lesson clipboard in one hand at waist level. "
        "Expression: Gentle welcoming teacher smile, poised, intelligent, confident and warm aura."
    ),
    "happy": (
        f"{BASE_CHARACTER_PROMPT} "
        "Pose: Cheerful praising pose, one hand holding clipboard while the other gives an enthusiastic thumbs-up 'Great job!'. "
        "Expression: Radiant delighted beaming smile, bright sparkling eyes, deeply pleased and encouraging."
    ),
    "thinking": (
        f"{BASE_CHARACTER_PROMPT} "
        "Pose: Thoughtful listening stance, weight shifted slightly to one hip, one index finger gently resting against chin. "
        "Expression: Analytical focused gaze looking slightly upward in contemplation, pondering deeply."
    ),
    "surprised": (
        f"{BASE_CHARACTER_PROMPT} "
        "Pose: Stepping back slightly in pleasant surprise, one delicate hand raised to lightly touch cheek. "
        "Expression: Wide astonished blue eyes, softly parted lips in 'Oh!' expression, pleasantly surprised."
    ),
    "shy": (
        f"{BASE_CHARACTER_PROMPT} "
        "Pose: Bashful charming pose, one hand gently tucking a strand of golden hair behind ear, blushing warmly. "
        "Expression: Sweet blush spreading across cheeks, shy flustered averted gaze, mature yet adorable embarrassment."
    ),
    "angry": (
        f"{BASE_CHARACTER_PROMPT} "
        "Pose: Strict instructor pose, hands placed firmly on curvy hips, commanding teacher stance. "
        "Expression: Adorable stern pouting scowl, furrowed brows, focused intense gaze 'Listen carefully, repeat after me!'."
    ),
    "sad": (
        f"{BASE_CHARACTER_PROMPT} "
        "Pose: Sympathetic comforted posture, hands gently clasped together over chest holding clipboard close. "
        "Expression: Soft comforting frown, empathetic gentle eyes, reassuring 'Don't worry, let's practice again together'."
    ),
}


def chroma_key(raw_path: str, out_path: str, flip_horizontal: bool = True):
    """
    自適應綠幕去背，並保護金髮、白襯衫、黑絲襪與皮膚眼睛，並預設水平鏡像翻轉（朝右看）
    """
    img = cv2.imread(raw_path)
    if img is None:
        raise ValueError(f"無法讀取圖片：{raw_path}")

    h, w = img.shape[:2]
    b = img[:, :, 0].astype(np.float32)
    g = img[:, :, 1].astype(np.float32)
    r = img[:, :, 2].astype(np.float32)

    # 綠幕檢測：G 通道顯著高於 R 與 B
    diff = g - np.maximum(r, b)
    is_green = (g > 135) & (diff > 50)

    mask_uint8 = is_green.astype(np.uint8) * 255
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask_uint8)

    is_bg = np.zeros((h, w), dtype=bool)

    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        cy = centroids[i, 1]

        comp_mask = (labels == i).astype(np.uint8)
        dilated = cv2.dilate(comp_mask, np.ones((7, 7), np.uint8))
        ring = (dilated > 0) & (comp_mask == 0)

        ring_r = r[ring]
        ring_g = g[ring]
        ring_b = b[ring]
        skin_pixels = (
            (ring_r > 185) & (ring_g > 135) & (ring_b > 115) & (ring_r - ring_b > 15)
        )
        skin_ratio = np.mean(skin_pixels) if len(skin_pixels) > 0 else 0

        # 保護臉部、眼睛部位免受誤刪
        is_face = (cy < 0.40 * h) and (area < 3500) and (skin_ratio > 0.04)

        if is_face:
            pass
        else:
            is_bg[labels == i] = True

    alpha = np.ones((h, w), dtype=np.float32)
    alpha[is_bg] = 0.0

    # 邊緣羽化平滑
    alpha = cv2.GaussianBlur(alpha, (5, 5), 0)
    alpha = np.clip((alpha - 0.2) / 0.7, 0.0, 1.0)

    # 去綠幕溢色 (Despill)
    despill_mask = (g > np.maximum(r, b)) & (alpha > 0.05) & (b < 150)
    clamped_g = np.minimum(g, np.maximum(r, b) * 1.05)
    result_bgr = img.copy().astype(np.float32)
    result_bgr[:, :, 1] = np.where(despill_mask, clamped_g, g)

    bgra = np.zeros((h, w, 4), dtype=np.uint8)
    bgra[:, :, :3] = np.clip(result_bgr, 0, 255).astype(np.uint8)
    bgra[:, :, 3] = (alpha * 255).astype(np.uint8)

    # 裁切人物透明外圍並保留適度 padding
    ys, xs = np.where(bgra[:, :, 3] > 10)
    if len(ys) > 0:
        pad = 35
        min_y = max(0, np.min(ys) - pad)
        max_y = min(h, np.max(ys) + pad)
        min_x = max(0, np.min(xs) - pad)
        max_x = min(w, np.max(xs) + pad)
        bgra = bgra[min_y:max_y, min_x:max_x]

    # 水平翻轉（讓角色朝右看，注視右側聊天視窗）
    if flip_horizontal:
        bgra = cv2.flip(bgra, 1)

    cv2.imwrite(out_path, bgra)
    print(f"  [去背成功 (朝右看)] {out_path} (尺寸: {bgra.shape[1]}x{bgra.shape[0]})")


async def generate_all_tutor_sprites():
    print("[1/3] 正在同步 Gemini Cookie (從 Chrome 無痕 / 本機)...")
    cookies = get_or_sync_gemini_cookies(BASE_DIR)
    if not cookies or not cookies.get("__Secure-1PSID"):
        print("[Error] 未找到有效的 Gemini Cookie！請先開啟 tools/launch_gemini_inprivate.bat 並登入。")
        return False

    client = GeminiClient(cookies["__Secure-1PSID"], cookies.get("__Secure-1PSIDTS", ""))
    if cookies.get("__Secure-1PSIDCC"):
        client._cookies.set("__Secure-1PSIDCC", cookies["__Secure-1PSIDCC"], domain=".google.com", secure=True)

    await client.init(timeout=120)
    print("[Gemini] Client 初始化成功，準備開始產圖！")

    emotions = ["default", "happy", "thinking", "surprised", "shy", "angry", "sad"]
    success_count = 0

    for emo in emotions:
        raw_path = os.path.join(RAW_DIR, f"{emo}.png")
        out_path = os.path.join(AVATAR_DIR, f"{emo}.png")

        if os.path.exists(raw_path):
            print(f"\n[{emo}] 發現已存在原圖，直接重新色鍵去背...")
        else:
            print(f"\n[{emo}] 正在調用 Gemini 生成立繪...")
            prompt = EMOTION_PROMPTS[emo]
            try:
                reply = await client.generate_content(prompt)
                if reply.images:
                    await reply.images[0].save(path=RAW_DIR, filename=f"{emo}.png")
                    print(f"  [原圖保存] {raw_path}")
                else:
                    print(f"  [警告] 未返回圖片，文字回應: {reply.text[:150]}")
                    continue
            except Exception as e:
                print(f"  [生圖失敗] {e}")
                continue

            # 短暫休眠避免速率限制
            await asyncio.sleep(4)

        try:
            chroma_key(raw_path, out_path)
            success_count += 1
        except Exception as e:
            print(f"  [去背失敗] {e}")

    await client.close()
    print(f"\n[完成] 成功產生 {success_count}/{len(emotions)} 張立繪！")
    return success_count > 0


if __name__ == "__main__":
    asyncio.run(generate_all_tutor_sprites())
