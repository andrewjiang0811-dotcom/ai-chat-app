"""
全角色獨立重繪產圖核心腳本 (Full Persona Sprite Redraw & Auto Chroma-Key Pipeline)
嚴格執行：每張情緒均為獨立完整立繪（全圖重繪），絕不使用表情差分或拼貼！
支援：
1. 萬能助理 (assistant) - 960x1515
2. 傲嬌貓娘 (tsundere_cat) - 1280x757
3. 英文口說老師 (english_tutor) - 680x1530
"""

import os
import sys
import json
import asyncio
import argparse
import cv2
import numpy as np

import enum
if not hasattr(enum, "StrEnum"):
    class StrEnum(str, enum.Enum):
        pass
    enum.StrEnum = StrEnum

from gemini_webapi import GeminiClient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from core.cookie_extractor import get_or_sync_gemini_cookies

sys.stdout.reconfigure(encoding="utf-8")

PERSONA_PROMPTS = {
    "assistant": {
        "base": (
            "Full body anime character sprite: stunning gentle female personal assistant. "
            "Slender elegant figure, silky long dark chestnut brown hair tied into a neat low half-ponytail with a dark ribbon, "
            "warm gentle hazel amber anime eyes, intelligent kind friendly smile. "
            "Wearing a tailored smart cream-beige blazer over an elegant soft white collared blouse, "
            "matching fitted beige skirt, dark sheer pantyhose, modest black heels. "
            "Standing full body view, head to feet completely visible, 2D Japanese visual novel character key art, "
            "solid pure bright green background #00FF00, flat chroma key green screen, clean crisp anime linework, studio lighting."
        ),
        "canvas_w": 960,
        "canvas_h": 1515,
        "body_h": 1470,
        "top_y": 30,
        "axis_x": 480.0,
        "flip": False,
        "emotions": {
            "default": "Standing poised and graceful, holding a digital tablet or organizer at waist level, warm welcoming polite smile, attentive gaze.",
            "happy": "Delightful cheering pose, holding tablet with one hand while giving an encouraging gentle hand wave, bright happy smiling eyes, cheerful sweet expression.",
            "thinking": "Thoughtful analytical posture, one hand lightly tapping chin with index finger, head tilted slightly, contemplative gentle gaze looking slightly up.",
            "surprised": "Pleasantly startled posture, hands softly raised near chest, wide astonished amber eyes, lips softly parted in surprise 'Oh!', lively reaction.",
            "shy": "Charming flustered pose, holding tablet close to chest, head slightly bowed, rosy pink blush across cheeks, bashful cute averted gaze.",
            "angry": "Cute serious scowl, hands on hips or holding tablet firmly, small pouting mouth, focused determined gaze, adorably strict expression.",
            "sad": "Comforting sympathetic posture, shoulders slightly lowered, gentle concerned eyebrows, soft empathetic eyes, reassuring warm demeanor."
        }
    },
    "tsundere_cat": {
        "base": (
            "Full anime character sprite: adorable anime catgirl named Kuro / Nya, petite slender figure, "
            "fluffy black/silver feline cat ears on head with inner pink fur, twitching cat tail behind her, "
            "long twin-tail silver platinum hair with red ribbons, glowing big golden amber feline eyes. "
            "Outfit: Cute Gothic Lolita / casual cat maid hybrid dress with black and white frills, crimson ribbon collar with a small golden bell, "
            "white knee-high socks. 2D Japanese visual novel sprite art, vibrant coloring, "
            "solid pure bright green background #00FF00, flat chroma key green screen, full character visible within frame."
        ),
        "canvas_w": 960,
        "canvas_h": 1515,
        "body_h": 1450,
        "top_y": 35,
        "axis_x": 480.0,
        "flip": False,
        "emotions": {
            "default": "Sitting or standing pose, arms crossed under chest, classic tsundere pout looking slightly away but peeking at viewer with sharp golden eyes.",
            "happy": "Joyful cat pose, hands curled like cat paws 'nya~', sparkling beaming golden eyes, cat mouth smile, tail wagging excitedly.",
            "thinking": "Curious cat pose, head tilted sideways, one finger pressed against lip, tail curled in question mark shape, inquisitive focused gaze.",
            "surprised": "Startled jump pose, cat ears pinned back in shock, huge round surprised eyes, flustered parted mouth, bushy tail standing up.",
            "shy": "Intensely flustered tsundere blushing, red face, looking away hiding face behind hands, 'B-Baka!', ears folded down, tail twitching nervously.",
            "angry": "Classic tsundere wrath, puffed up cheeks, adorable fangs bared in a fierce pout, clenched small fists, ears flat, 'Don't underestimate me!'.",
            "sad": "Droopy sad cat pose, ears lowered flat against head, teary puppy-dog eyes, downcast expression, tail drooping to floor, seeking comfort."
        }
    },
    "english_tutor": {
        "base": (
            "Full length full-body anime character sprite: gorgeous mature female English teacher named Elena. "
            "Slender graceful figure, beautiful elegant face, intelligent styling. "
            "Hairstyle: Lustrous long wavy golden-blonde hair flowing over shoulders gracefully. "
            "Eyes: Sparkling deep azure blue anime eyes. "
            "Glasses: Fashionable stylish thin gold wire-frame glasses resting on bridge of nose. "
            "Outfit: Tailored dark navy blue teacher blazer jacket over a neat white collared blouse, "
            "matching dark navy pencil skirt, dark stockings, glossy black high-heel pumps. "
            "Standing full body shot, entire character from head to toes visible within frame, no cropping. "
            "Solid pure bright green background #00FF00, flat chroma key green screen, clean crisp lines, 2D visual novel key art."
        ),
        "canvas_w": 680,
        "canvas_h": 1530,
        "body_h": 1470,
        "top_y": 35,
        "axis_x": 326.0,
        "flip": True,
        "emotions": {
            "default": "Standing gracefully, holding an educational clipboard in one hand at waist level, gentle welcoming teacher smile, poised and confident.",
            "happy": "Cheerful praising pose, holding clipboard with one hand while giving an enthusiastic thumbs-up 'Great job!'. Radiant delighted beaming smile.",
            "thinking": "Thoughtful listening stance, one index finger gently resting against chin, analytical contemplative gaze.",
            "surprised": "Stepping back slightly in pleasant surprise, one delicate hand raised to lightly touch cheek, wide astonished blue eyes, softly parted lips.",
            "shy": "Bashful charming pose, one hand gently tucking a strand of golden hair behind ear, sweet blush across cheeks, shy flustered averted gaze.",
            "angry": "Strict instructor pose, hands placed on hips, commanding teacher stance, cute serious pouting scowl, focused teaching gaze.",
            "sad": "Sympathetic comforted posture, hands gently clasped together over chest holding clipboard close, soft empathetic gentle eyes."
        }
    }
}


def chroma_key_and_standardize(raw_path: str, out_path: str, cfg: dict):
    img = cv2.imread(raw_path)
    if img is None:
        raise ValueError(f"無法讀取圖片：{raw_path}")

    h, w = img.shape[:2]
    b = img[:, :, 0].astype(np.float32)
    g = img[:, :, 1].astype(np.float32)
    r = img[:, :, 2].astype(np.float32)

    diff = g - np.maximum(r, b)
    is_green = (g > 130) & (diff > 45)

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
        skin_pixels = (ring_r > 185) & (ring_g > 135) & (ring_b > 115) & (ring_r - ring_b > 15)
        skin_ratio = np.mean(skin_pixels) if len(skin_pixels) > 0 else 0

        is_face = (cy < 0.45 * h) and (area < 4000) and (skin_ratio > 0.04)
        if not is_face:
            is_bg[labels == i] = True

    alpha = np.ones((h, w), dtype=np.float32)
    alpha[is_bg] = 0.0
    alpha = cv2.GaussianBlur(alpha, (5, 5), 0)
    alpha = np.clip((alpha - 0.2) / 0.7, 0.0, 1.0)

    # 去綠幕溢色 (Despill)
    despill_mask = (g > np.maximum(r, b)) & (alpha > 0.05) & (b < 160)
    clamped_g = np.minimum(g, np.maximum(r, b) * 1.05)
    result_bgr = img.copy().astype(np.float32)
    result_bgr[:, :, 1] = np.where(despill_mask, clamped_g, g)

    bgra = np.zeros((h, w, 4), dtype=np.uint8)
    bgra[:, :, :3] = np.clip(result_bgr, 0, 255).astype(np.uint8)
    bgra[:, :, 3] = (alpha * 255).astype(np.uint8)

    # 裁切透明邊界
    ys, xs = np.where(bgra[:, :, 3] > 15)
    if len(ys) > 0:
        top_y, bot_y = np.min(ys), np.max(ys)
        left_x, right_x = np.min(xs), np.max(xs)
        bgra = bgra[top_y:bot_y, left_x:right_x]

    if cfg.get("flip", False):
        bgra = cv2.flip(bgra, 1)

    # 規格化至角色畫布尺寸
    cw = cfg["canvas_w"]
    ch = cfg["canvas_h"]
    target_body_h = cfg["body_h"]
    target_top_y = cfg["top_y"]
    target_axis_x = cfg["axis_x"]

    cur_h, cur_w = bgra.shape[:2]
    scale = target_body_h / float(cur_h)
    new_w = int(round(cur_w * scale))
    new_h = int(round(cur_h * scale))
    resized = cv2.resize(bgra, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    t_alpha = resized[:, :, 3]
    torso_ys, torso_xs = np.where(t_alpha[int(new_h * 0.15):int(new_h * 0.55), :] > 50)
    resized_axis_x = np.median(torso_xs) if len(torso_xs) > 0 else new_w / 2.0

    offset_y = target_top_y
    offset_x = int(round(target_axis_x - resized_axis_x))

    canvas = np.zeros((ch, cw, 4), dtype=np.uint8)
    src_x1 = max(0, -offset_x)
    src_y1 = max(0, -offset_y)
    src_x2 = min(new_w, cw - offset_x)
    src_y2 = min(new_h, ch - offset_y)

    dst_x1 = max(0, offset_x)
    dst_y1 = max(0, offset_y)
    dst_x2 = dst_x1 + (src_x2 - src_x1)
    dst_y2 = dst_y1 + (src_y2 - src_y1)

    canvas[dst_y1:dst_y2, dst_x1:dst_x2] = resized[src_y1:src_y2, src_x1:src_x2]

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cv2.imwrite(out_path, canvas)
    print(f"  [儲存成功] {out_path} ({cw}x{ch})")


async def generate_persona(client: GeminiClient, persona_id: str, selected_emotions: list = None):
    if persona_id not in PERSONA_PROMPTS:
        print(f"未知角色：{persona_id}")
        return

    cfg = PERSONA_PROMPTS[persona_id]
    base_prompt = cfg["base"]
    raw_dir = os.path.join(BASE_DIR, "data", "raw_sprites", persona_id)
    avatar_dir = os.path.join(BASE_DIR, "data", "avatars", persona_id)
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(avatar_dir, exist_ok=True)

    print(f"\n=======================================================")
    print(f"🎨 開始為 [{persona_id}] 生成立繪（全圖重繪，非表情差分）...")
    print(f"=======================================================")

    emotions = selected_emotions if selected_emotions else ["default", "happy", "thinking", "surprised", "shy", "angry", "sad"]
    for emo in emotions:
        emo_desc = cfg["emotions"][emo]
        full_prompt = f"Please generate an image of: {base_prompt} Pose & Emotion for {emo}: {emo_desc}"
        raw_path = os.path.join(raw_dir, f"{emo}.png")
        out_path = os.path.join(avatar_dir, f"{emo}.png")

        success = False
        for attempt in range(1, 3):
            print(f"\n[{persona_id} -> {emo}] 正在發送產圖請求 (第 {attempt} 次)...")
            try:
                reply = await client.generate_content(full_prompt)
                if reply.images:
                    await reply.images[0].save(path=raw_dir, filename=f"{emo}.png")
                    print(f"  [原圖儲存] {raw_path}")
                    chroma_key_and_standardize(raw_path, out_path, cfg)
                    success = True
                    break
                else:
                    print(f"  [警告] 未返回圖片，文字: {reply.text[:100]}")
            except Exception as e:
                print(f"  [產圖異常] {e}")
            await asyncio.sleep(4)

        if not success:
            print(f"  [失敗] {persona_id} -> {emo} 未能順利產出圖片。")

        await asyncio.sleep(4)


async def main():
    parser = argparse.ArgumentParser(description="全角色獨立重繪立繪產圖工具")
    parser.add_argument("--persona", type=str, choices=["all", "assistant", "tsundere_cat", "english_tutor"], default="all")
    parser.add_argument("--emotions", nargs="+", default=None, help="指定生成的情緒清單")
    args = parser.parse_args()

    cookies = get_or_sync_gemini_cookies(BASE_DIR)
    if not cookies or not cookies.get("__Secure-1PSID"):
        print("\n[Error] 未找到有效 Google Gemini 登入 Cookie！")
        print("請點擊執行 tools/launch_gemini_inprivate.bat 並登入 Google 帳號，再重新執行此腳本。")
        sys.exit(1)

    client = GeminiClient(cookies["__Secure-1PSID"], cookies.get("__Secure-1PSIDTS", ""))
    if cookies.get("__Secure-1PSIDCC"):
        client._cookies.set("__Secure-1PSIDCC", cookies["__Secure-1PSIDCC"], domain=".google.com", secure=True)

    await client.init(timeout=120)
    print("\n✅ Gemini 連線初始化成功，開始獨立全圖立繪生成！")

    targets = ["assistant", "tsundere_cat", "english_tutor"] if args.persona == "all" else [args.persona]
    for p in targets:
        await generate_persona(client, p, args.emotions)

    await client.close()
    print("\n🎉 所有指定角色之獨立全圖立繪產出完成！")


if __name__ == "__main__":
    asyncio.run(main())
