"""
角色立繪產圖工具 (Character Sprite Generator)
具備自動同步 Gemini Cookie、自動避開角色配色背景、精準去背與分類儲存功能。
"""

import os
import sys
import json
import asyncio
import argparse
from typing import Dict, Any, Optional

import cv2
import numpy as np
import enum
if not hasattr(enum, "StrEnum"):
    class StrEnum(str, enum.Enum):
        pass
    enum.StrEnum = StrEnum

from gemini_webapi import GeminiClient

# 確保引用本機 core 模組
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from core.cookie_extractor import get_or_sync_gemini_cookies

sys.stdout.reconfigure(encoding="utf-8")


def chroma_key_remove_bg(
    raw_path: str,
    out_path: str,
    bg_color_type: str = "green",
    protect_skin: bool = True
):
    """
    自適應綠幕/洋紅色彩度去背處理，並保留皮膚與眼睛顏色
    """
    img = cv2.imread(raw_path)
    if img is None:
        raise ValueError(f"無法讀取圖片：{raw_path}")

    h, w = img.shape[:2]
    b = img[:, :, 0].astype(np.float32)
    g = img[:, :, 1].astype(np.float32)
    r = img[:, :, 2].astype(np.float32)

    if bg_color_type == "magenta":
        # 洋紅背景：高紅高藍，低綠
        diff = np.minimum(r, b) - g
        is_bg_color = (r > 130) & (b > 130) & (diff > 50)
    else:
        # 預設純綠背景：高綠，低紅藍
        diff = g - np.maximum(r, b)
        is_bg_color = (g > 135) & (diff > 55)

    mask_uint8 = is_bg_color.astype(np.uint8) * 255
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
            (ring_r > 190) & (ring_g > 140) & (ring_b > 120) & (ring_r - ring_b > 15)
        )
        skin_ratio = np.mean(skin_pixels) if len(skin_pixels) > 0 else 0

        # 臉部與眼睛保護
        is_face_part = (cy < 0.45 * h) and (area < 4000) and (skin_ratio > 0.04)

        if protect_skin and is_face_part:
            pass
        else:
            is_bg[labels == i] = True

    alpha = np.ones((h, w), dtype=np.float32)
    alpha[is_bg] = 0.0

    alpha = cv2.GaussianBlur(alpha, (5, 5), 0)
    alpha = np.clip((alpha - 0.2) / 0.7, 0.0, 1.0)

    # 抑制邊緣溢色
    result_bgr = img.copy().astype(np.float32)
    if bg_color_type == "green":
        despill_mask = (g > np.maximum(r, b)) & (alpha > 0.05) & (b < 140)
        result_bgr[:, :, 1] = np.where(despill_mask, np.minimum(g, np.maximum(r, b) * 1.05), g)

    bgra = np.zeros((h, w, 4), dtype=np.uint8)
    bgra[:, :, :3] = np.clip(result_bgr, 0, 255).astype(np.uint8)
    bgra[:, :, 3] = (alpha * 255).astype(np.uint8)

    # 裁切透明邊界
    ys, xs = np.where(bgra[:, :, 3] > 10)
    if len(ys) > 0:
        pad = 30
        min_y = max(0, np.min(ys) - pad)
        max_y = min(h, np.max(ys) + pad)
        min_x = max(0, np.min(xs) - pad)
        max_x = min(w, np.max(xs) + pad)
        bgra = bgra[min_y:max_y, min_x:max_x]

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cv2.imwrite(out_path, bgra)
    print(f"  [去背成功] 已儲存透明立繪：{out_path}")


async def generate_single_sprite(
    persona_id: str,
    emotion: str,
    prompt: str,
    bg_color_type: str = "green",
    client: Optional[GeminiClient] = None
):
    """
    執行單張情緒立繪產圖
    """
    raw_dir = os.path.join(BASE_DIR, "data", "raw_sprites", persona_id)
    avatar_dir = os.path.join(BASE_DIR, "data", "avatars", persona_id)
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(avatar_dir, exist_ok=True)

    raw_path = os.path.join(raw_dir, f"{emotion}.png")
    out_path = os.path.join(avatar_dir, f"{emotion}.png")

    print(f"\n🎨 開始為 [{persona_id}] 生成 [{emotion}] 情緒立繪...")

    if not client:
        # 自動同步 Cookie
        cookies = get_or_sync_gemini_cookies(BASE_DIR)
        if not cookies or not cookies.get("__Secure-1PSID"):
            raise RuntimeError("找不到有效的 Gemini Cookie，請確認本機 Edge/Chrome 是否已登入 Google 帳號。")

        client = GeminiClient(cookies["__Secure-1PSID"], cookies.get("__Secure-1PSIDTS", ""))
        if cookies.get("__Secure-1PSIDCC"):
            client._cookies.set("__Secure-1PSIDCC", cookies["__Secure-1PSIDCC"], domain=".google.com", secure=True)
        await client.init(timeout=120)

    try:
        reply = await client.generate_content(prompt)
        if reply.images:
            await reply.images[0].save(path=raw_dir, filename=f"{emotion}.png")
            print(f"  [原圖儲存] {raw_path}")
            chroma_key_remove_bg(raw_path, out_path, bg_color_type=bg_color_type)
            return out_path
        else:
            print(f"  [警告] Gemini 未返回圖片，文字回應: {reply.text[:150]}")
            return None
    except Exception as e:
        print(f"  [產圖失敗] {e}")
        raise e


async def main():
    parser = argparse.ArgumentParser(description="Gemini 角色立繪產圖工具（自動同步 Cookie）")
    parser.add_argument("--persona", type=str, default="tsundere_cat", help="角色 ID")
    parser.add_argument("--emotion", type=str, default="default", help="情緒名稱")
    parser.add_argument("--prompt", type=str, required=True, help="英文產圖 Prompt")
    parser.add_argument("--bg", type=str, default="green", choices=["green", "magenta"], help="去背背景色")

    args = parser.parse_args()

    # 自動同步並執行
    cookies = get_or_sync_gemini_cookies(BASE_DIR)
    if not cookies or not cookies.get("__Secure-1PSID"):
        print("[Error] 無法取得有效 Cookie，請確認已登入 Google 帳號。")
        sys.exit(1)

    client = GeminiClient(cookies["__Secure-1PSID"], cookies.get("__Secure-1PSIDTS", ""))
    if cookies.get("__Secure-1PSIDCC"):
        client._cookies.set("__Secure-1PSIDCC", cookies["__Secure-1PSIDCC"], domain=".google.com", secure=True)
    await client.init(timeout=120)

    try:
        await generate_single_sprite(
            persona_id=args.persona,
            emotion=args.emotion,
            prompt=args.prompt,
            bg_color_type=args.bg,
            client=client
        )
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
