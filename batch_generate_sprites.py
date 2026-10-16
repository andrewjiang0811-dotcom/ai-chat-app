import asyncio
import json
import os
import sys

import cv2
import numpy as np
from gemini_webapi import GeminiClient

sys.stdout.reconfigure(encoding="utf-8")

RAW_DIR = r"D:\My Project\raw_sprites"
AVATAR_DIR = r"D:\My Project\ai_chat_app\data\avatars"
ARTIFACT_DIR = r"C:\Users\uSER\.gemini\antigravity-ide\brain\f2afb745-ac5e-4bff-b36f-1e78d8087fdb"
COOKIE_FILE = r"D:\My Project\gemini_cookies.json"

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(AVATAR_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)

PROMPTS = {
    "default": (
        "Full length full-body anime character standing sprite: cute anime girl with silver twin-tails with dark blue ribbons, "
        "smiling gently, wearing navy school uniform vest over white collared long-sleeve shirt, teal necktie, "
        "white pleated skirt, black thigh-high stockings, black school loafers. "
        "Standing straight and gracefully with hands neatly clasped at waist. "
        "Entire body from top of head to bottom of shoes completely visible inside frame, full body shot. "
        "Solid pure bright green screen background #00FF00, 2D visual novel key art, clean lines, no background details."
    ),
    "happy": (
        "Full length full-body anime character standing sprite: cute anime girl with silver twin-tails with dark blue ribbons, "
        "wearing navy school uniform vest over white collared long-sleeve shirt, teal necktie, "
        "white pleated skirt, black thigh-high stockings, black school loafers. "
        "Cheerful joyful standing pose, one knee bent playfully with foot popped. "
        "Radiant happy beaming smile with open mouth, blushing cheeks, sparkling joyful eyes. "
        "Both hands held up near cheeks making cute double peace V-signs with clear distinct fingers. "
        "Entire body from top of head to bottom of shoes completely visible inside frame, full body shot. "
        "Solid pure bright green screen background #00FF00, 2D visual novel key art, clean lines, no background details."
    ),
    "shy": (
        "Full length full-body anime character standing sprite: cute anime girl with silver twin-tails with dark blue ribbons, "
        "wearing navy school uniform vest over white collared long-sleeve shirt, teal necktie, "
        "white pleated skirt, black thigh-high stockings, black school loafers. "
        "Timid bashful standing pose with inward-pointing knees and hesitant stance. "
        "Deep red blush covering cheeks and nose, shy bashful averted gaze, flustered nervous sweet expression. "
        "Both hands clutching the sides of her pleated skirt nervously. "
        "Entire body from top of head to bottom of shoes completely visible inside frame, full body shot. "
        "Solid pure bright green screen background #00FF00, 2D visual novel key art, clean lines, no background details."
    ),
    "angry": (
        "Full length full-body anime character standing sprite: cute anime girl with silver twin-tails with dark blue ribbons, "
        "wearing navy school uniform vest over white collared long-sleeve shirt, teal necktie, "
        "white pleated skirt, black thigh-high stockings, black school loafers. "
        "Tsundere defiant standing pose, feet planted firmly apart. "
        "Both hands placed firmly on her hips. "
        "Adorable angry pouting face with puffed-out cheeks, furrowed eyebrows, pouting mouth, sharp determined glare at viewer. "
        "Entire body from top of head to bottom of shoes completely visible inside frame, full body shot. "
        "Solid pure bright green screen background #00FF00, 2D visual novel key art, clean lines, no background details."
    ),
    "sad": (
        "Full length full-body anime character standing sprite: cute anime girl with silver twin-tails with dark blue ribbons, "
        "wearing navy school uniform vest over white collared long-sleeve shirt, teal necktie, "
        "white pleated skirt, black thigh-high stockings, black school loafers. "
        "Vulnerable melancholic standing pose, feet close together, slightly slouched shoulders. "
        "Glistening tearful eyes looking down, trembling sad frown, sorrowful emotional expression. "
        "Both hands held together tightly against her chest anxiously. "
        "Entire body from top of head to bottom of shoes completely visible inside frame, full body shot. "
        "Solid pure bright green screen background #00FF00, 2D visual novel key art, clean lines, no background details."
    ),
    "surprised": (
        "Full length full-body anime character standing sprite: cute anime girl with silver twin-tails with dark blue ribbons, "
        "wearing navy school uniform vest over white collared long-sleeve shirt, teal necktie, "
        "white pleated skirt, black thigh-high stockings, black school loafers. "
        "Startled shocked standing pose, stepping back with body leaning back in surprise. "
        "Wide round shocked eyes with tiny pupils, open gasping mouth, raised eyebrows. "
        "Both hands raised open in front of her chest with splayed open fingers in surprise. "
        "Entire body from top of head to bottom of shoes completely visible inside frame, full body shot. "
        "Solid pure bright green screen background #00FF00, 2D visual novel key art, clean lines, no background details."
    ),
    "thinking": (
        "Full length full-body anime character standing sprite: cute anime girl with silver twin-tails with dark blue ribbons, "
        "wearing navy school uniform vest over white collared long-sleeve shirt, teal necktie, "
        "white pleated skirt, black thigh-high stockings, black school loafers. "
        "Thoughtful analytical standing pose, weight shifted to one hip, head tilted thoughtfully. "
        "One arm folded across waist while the other hand rests its index finger against her chin in deep thought. "
        "Looking upward pensively, curious analytical expression. "
        "Entire body from top of head to bottom of shoes completely visible inside frame, full body shot. "
        "Solid pure bright green screen background #00FF00, 2D visual novel key art, clean lines, no background details."
    ),
}


def chroma_key(raw_image_path, out_transparent_path):
    img = cv2.imread(raw_image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {raw_image_path}")

    h, w = img.shape[:2]
    b, g, r = (
        img[:, :, 0].astype(np.float32),
        img[:, :, 1].astype(np.float32),
        img[:, :, 2].astype(np.float32),
    )

    diff = g - np.maximum(r, b)
    is_green = (g > 140) & (diff > 60)

    mask_uint8 = is_green.astype(np.uint8) * 255
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        mask_uint8
    )

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
            (ring_r > 195)
            & (ring_g > 145)
            & (ring_b > 125)
            & (ring_r - ring_b > 20)
        )
        skin_ratio = np.mean(skin_pixels) if len(skin_pixels) > 0 else 0

        # Eye protection
        is_eye = (cy < 0.40 * h) and (area < 3500) and (skin_ratio > 0.04)

        if is_eye:
            print(
                f"  [ChromaKey] Eye detected at y={cy:.1f}, area={area}, skin={skin_ratio:.2f} -> Preserved"
            )
        else:
            is_bg[labels == i] = True

    alpha = np.ones((h, w), dtype=np.float32)
    alpha[is_bg] = 0.0

    alpha = cv2.GaussianBlur(alpha, (5, 5), 0)
    alpha = np.clip((alpha - 0.2) / 0.7, 0.0, 1.0)

    # Despill green bleed around edges without affecting teal necktie
    despill_mask = (g > np.maximum(r, b)) & (alpha > 0.05) & (b < 130)
    clamped_g = np.minimum(g, np.maximum(r, b) * 1.05)
    result_bgr = img.copy().astype(np.float32)
    result_bgr[:, :, 1] = np.where(despill_mask, clamped_g, g)

    bgra = np.zeros((h, w, 4), dtype=np.uint8)
    bgra[:, :, :3] = np.clip(result_bgr, 0, 255).astype(np.uint8)
    bgra[:, :, 3] = (alpha * 255).astype(np.uint8)

    # Crop to character bounding box with padding
    ys, xs = np.where(bgra[:, :, 3] > 10)
    if len(ys) == 0:
        cv2.imwrite(out_transparent_path, bgra)
        return

    pad = 40
    min_y = max(0, np.min(ys) - pad)
    max_y = min(h, np.max(ys) + pad)
    min_x = max(0, np.min(xs) - pad)
    max_x = min(w, np.max(xs) + pad)

    cropped = bgra[min_y:max_y, min_x:max_x]
    cv2.imwrite(out_transparent_path, cropped)
    print(
        f"  [ChromaKey] Saved transparent PNG: {out_transparent_path} (shape: {cropped.shape})"
    )


async def main():
    with open(COOKIE_FILE, encoding="utf-8") as f:
        cookies = json.load(f)

    client = GeminiClient(cookies["__Secure-1PSID"], cookies["__Secure-1PSIDTS"])
    client._cookies.set(
        "__Secure-1PSIDCC",
        cookies["__Secure-1PSIDCC"],
        domain=".google.com",
        secure=True,
    )
    await client.init(timeout=120)
    print("[Gemini] Client initialized successfully.")

    # List of emotions to generate
    emotions = ["default", "happy", "shy", "angry", "sad", "surprised", "thinking"]

    for emo in emotions:
        raw_target = os.path.join(RAW_DIR, f"sprite_{emo}.png")
        # Check if we already have a valid raw image for default from our test
        if (
            emo == "default"
            and os.path.exists(
                os.path.join(RAW_DIR, "test_full_body_0.png")
            )
            and not os.path.exists(raw_target)
        ):
            import shutil

            shutil.copyfile(
                os.path.join(RAW_DIR, "test_full_body_0.png"), raw_target
            )
            print(f"[{emo}] Reused existing test_full_body_0.png for default.")

        if not os.path.exists(raw_target):
            print(f"\n[{emo}] Generating image via Gemini...")
            prompt = PROMPTS[emo]
            try:
                reply = await client.generate_content(prompt)
                if reply.images:
                    await reply.images[0].save(
                        path=RAW_DIR, filename=f"sprite_{emo}.png"
                    )
                    print(f"[{emo}] Raw image saved: {raw_target}")
                else:
                    print(
                        f"[{emo}] Warning: No images returned. Reply text: {reply.text[:200]}"
                    )
            except Exception as e:
                print(f"[{emo}] Error generating: {e}")
                continue
            # Short sleep between generations to avoid rate limiting
            await asyncio.sleep(4)
        else:
            print(f"\n[{emo}] Raw image already exists: {raw_target}")

        # Now chroma key and save
        assistant_dir = os.path.join(AVATAR_DIR, "assistant")
        os.makedirs(assistant_dir, exist_ok=True)
        avatar_path = os.path.join(assistant_dir, f"{emo}.png")
        artifact_path = os.path.join(ARTIFACT_DIR, f"assistant_{emo}.png")
        try:
            chroma_key(raw_target, avatar_path)
            # Copy to artifact dir for preview
            import shutil

            shutil.copyfile(avatar_path, artifact_path)
        except Exception as e:
            print(f"[{emo}] Error in chroma keying: {e}")

    await client.close()
    print("\n[Done] All emotions processed!")


if __name__ == "__main__":
    asyncio.run(main())
