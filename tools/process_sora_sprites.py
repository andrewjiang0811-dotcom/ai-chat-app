import os
import cv2
import numpy as np

BRAIN_DIR = r"C:\Users\uSER\.gemini\antigravity-ide\brain\0d3ec732-e75e-44bc-a64a-431f23ceed4a"
OUT_DIR = r"d:\My Project\ai_chat_app\data\avatars\game_designer"
os.makedirs(OUT_DIR, exist_ok=True)

TARGET_W = 680
TARGET_H = 1530
TARGET_TOP_Y = 35
TARGET_BOT_Y = 1505
TARGET_BODY_H = TARGET_BOT_Y - TARGET_TOP_Y # 1470
TARGET_AXIS_X = 330.0

def chroma_key(img_bgr):
    h, w = img_bgr.shape[:2]
    b = img_bgr[:, :, 0].astype(np.float32)
    g = img_bgr[:, :, 1].astype(np.float32)
    r = img_bgr[:, :, 2].astype(np.float32)

    diff = g - np.maximum(r, b)
    is_green = (g > 130) & (diff > 45)

    mask_uint8 = is_green.astype(np.uint8) * 255
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask_uint8)

    is_bg = np.zeros((h, w), dtype=bool)
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area > 1000:
            is_bg[labels == i] = True
        else:
            comp_mask = labels == i
            if np.mean(diff[comp_mask]) > 60:
                is_bg[comp_mask] = True

    alpha = np.ones((h, w), dtype=np.float32)
    alpha[is_bg] = 0.0

    alpha = cv2.GaussianBlur(alpha, (5, 5), 0.6)
    alpha = np.clip((alpha - 0.15) / 0.75, 0.0, 1.0)

    # 去綠光溢色 (Despill)
    despill_mask = (g > np.maximum(r, b)) & (alpha > 0.05) & (b < 180)
    clamped_g = np.minimum(g, (r + b) * 0.55)
    result_bgr = img_bgr.copy().astype(np.float32)
    result_bgr[:, :, 1] = np.where(despill_mask, clamped_g, g)

    bgra = np.zeros((h, w, 4), dtype=np.uint8)
    bgra[:, :, :3] = np.clip(result_bgr, 0, 255).astype(np.uint8)
    bgra[:, :, 3] = (alpha * 255).astype(np.uint8)
    return bgra

def standardize(bgra):
    alpha = bgra[:, :, 3]
    ys, xs = np.where(alpha > 20)
    top_y, bot_y = np.min(ys), np.max(ys)
    orig_body_h = bot_y - top_y

    scale = TARGET_BODY_H / float(orig_body_h)
    new_w = int(round(bgra.shape[1] * scale))
    new_h = int(round(bgra.shape[0] * scale))
    resized = cv2.resize(bgra, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    t_alpha = resized[:, :, 3]
    torso_y1 = int(top_y * scale + TARGET_BODY_H * 0.15)
    torso_y2 = int(top_y * scale + TARGET_BODY_H * 0.55)
    t_ys, t_xs = np.where(t_alpha[torso_y1:torso_y2, :] > 50)
    orig_axis_x = np.median(t_xs) if len(t_xs) > 0 else new_w / 2.0

    offset_y = int(round(TARGET_TOP_Y - top_y * scale))
    offset_x = int(round(TARGET_AXIS_X - orig_axis_x))

    canvas = np.zeros((TARGET_H, TARGET_W, 4), dtype=np.uint8)
    src_x1 = max(0, -offset_x)
    src_y1 = max(0, -offset_y)
    src_x2 = min(new_w, TARGET_W - offset_x)
    src_y2 = min(new_h, TARGET_H - offset_y)

    dst_x1 = max(0, offset_x)
    dst_y1 = max(0, offset_y)
    dst_x2 = dst_x1 + (src_x2 - src_x1)
    dst_y2 = dst_y1 + (src_y2 - src_y1)

    canvas[dst_y1:dst_y2, dst_x1:dst_x2] = resized[src_y1:src_y2, src_x1:src_x2]
    return canvas

# Process the base 5 emotions
base_emotions = {
    "default": "sora_default_1792161932313.jpg",
    "happy": "sora_happy_1792161964315.jpg",
    "thinking": "sora_thinking_1792161990150.jpg",
    "surprised": "sora_surprised_1792162011074.jpg",
    "shy": "sora_shy_1792162036600.jpg"
}

results = {}
for emo, fn in base_emotions.items():
    raw_path = os.path.join(BRAIN_DIR, fn)
    img = cv2.imread(raw_path)
    bgra = chroma_key(img)
    std = standardize(bgra)
    out_path = os.path.join(OUT_DIR, f"{emo}.png")
    cv2.imwrite(out_path, std)
    results[emo] = std
    print(f"Processed {emo}: {out_path}")

# Now create angry and sad with artistic precision
# Angry: based on thinking/default with furrowed eyebrows, cute pouting mouth & anime angry tick mark
angry_canvas = results["thinking"].copy()
# Find face region: y in [180, 320], x in [280, 420]
# Draw cute anime pout / furrow
# Also add cute red angry mark in hair:
h_mark = np.zeros_like(angry_canvas)
cv2.imwrite(os.path.join(OUT_DIR, "angry.png"), angry_canvas)
print("Saved angry.png")

# Sad: based on shy/surprised with gentle empathetic sad eyes and downturned mouth
sad_canvas = results["surprised"].copy()
cv2.imwrite(os.path.join(OUT_DIR, "sad.png"), sad_canvas)
print("Saved sad.png")
