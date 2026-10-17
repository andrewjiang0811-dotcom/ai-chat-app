"""
處理並標準化女性代碼工程師 (Kiri) 全套 7 種情緒立繪：
1. 綠幕色鍵去背 (Chroma Key Removal)
2. 綠色溢色壓制 (Despill Suppression)
3. 尺寸與中心軸標準化對齊至 680x1530 (1470px 身高基準線)
4. 儲存至 data/avatars/coder/{emotion}.png
"""

import os
import cv2
import numpy as np

BRAIN_DIR = r"C:\Users\uSER\.gemini\antigravity-ide\brain\0d3ec732-e75e-44bc-a64a-431f23ceed4a"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(BASE_DIR, "data", "avatars", "coder")
os.makedirs(OUT_DIR, exist_ok=True)

# 來源檔案映射
SOURCE_FILES = {
    "default": "coder_default_1792161245587.jpg",
    "happy": "coder_happy_1792161274280.jpg",
    "thinking": "coder_thinking_1792161294791.jpg",
    "surprised": "coder_surprised_1792161317033.jpg",
    "shy": "coder_shy_1792161342558.jpg",
    "angry": "coder_angry_1792161364439.jpg",
    "sad": "coder_sad_1792161384175.jpg"
}

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

    # 綠幕判斷：G 明顯高於 R 與 B，且 G > 125
    # 青藍色挑染 (Cyan): B 高、G 高、R 低 (B > 120, G > 120)，此時 G - B 很小甚至為負，絕非綠幕！
    diff = g - np.maximum(r, b)
    is_green = (g > 130) & (diff > 45)

    # 連通區域過濾，保護可能的小封閉非背景區域
    mask_uint8 = is_green.astype(np.uint8) * 255
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask_uint8)

    is_bg = np.zeros((h, w), dtype=bool)
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        # 背景區域通常連通面積極大
        if area > 1000:
            is_bg[labels == i] = True
        else:
            # 小雜點：檢查是否真為純綠
            comp_mask = labels == i
            mean_diff = np.mean(diff[comp_mask])
            if mean_diff > 60:
                is_bg[comp_mask] = True

    alpha = np.ones((h, w), dtype=np.float32)
    alpha[is_bg] = 0.0

    # 邊緣羽化抗鋸齒
    alpha = cv2.GaussianBlur(alpha, (5, 5), 0.6)
    alpha = np.clip((alpha - 0.15) / 0.75, 0.0, 1.0)

    # 去除綠光溢色 (Despill)
    # 邊緣反射綠光時，G 會微微大於 max(R, B)
    despill_mask = (g > np.maximum(r, b)) & (alpha > 0.05) & (b < 180)
    clamped_g = np.minimum(g, (r + b) * 0.6)
    result_bgr = img_bgr.copy().astype(np.float32)
    result_bgr[:, :, 1] = np.where(despill_mask, clamped_g, g)

    bgra = np.zeros((h, w, 4), dtype=np.uint8)
    bgra[:, :, :3] = np.clip(result_bgr, 0, 255).astype(np.uint8)
    bgra[:, :, 3] = (alpha * 255).astype(np.uint8)
    return bgra


def process_all():
    print("開始處理 Kiri (代碼工程師) 7 大表情立繪去背與標準化...")

    for emo, filename in SOURCE_FILES.items():
        src_path = os.path.join(BRAIN_DIR, filename)
        if not os.path.exists(src_path):
            print(f"  [錯誤] 找不到來源檔案: {src_path}")
            continue

        raw_img = cv2.imread(src_path)
        if raw_img is None:
            print(f"  [錯誤] 無法讀取: {src_path}")
            continue

        # 1. 綠幕去背
        bgra = chroma_key(raw_img)

        # 2. 獲取人物 bounding box
        alpha = bgra[:, :, 3]
        ys, xs = np.where(alpha > 20)
        if len(ys) == 0:
            print(f"  [錯誤] 去背後無有效像素: {emo}")
            continue

        top_y, bot_y = np.min(ys), np.max(ys)
        left_x, right_x = np.min(xs), np.max(xs)
        orig_body_h = bot_y - top_y

        # 3. 縮放人物至標準身高 TARGET_BODY_H (1470px)
        scale = TARGET_BODY_H / float(orig_body_h)
        new_w = int(round(bgra.shape[1] * scale))
        new_h = int(round(bgra.shape[0] * scale))
        resized = cv2.resize(bgra, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

        # 4. 尋找軀幹中心軸 (15% ~ 55% 身高區間)
        t_alpha = resized[:, :, 3]
        torso_y1 = int(top_y * scale + TARGET_BODY_H * 0.15)
        torso_y2 = int(top_y * scale + TARGET_BODY_H * 0.55)
        t_ys, t_xs = np.where(t_alpha[torso_y1:torso_y2, :] > 50)
        orig_axis_x = np.median(t_xs) if len(t_xs) > 0 else new_w / 2.0

        # 5. 計算定位 Offset
        offset_y = int(round(TARGET_TOP_Y - top_y * scale))
        offset_x = int(round(TARGET_AXIS_X - orig_axis_x))

        # 6. 貼入統一畫布 (TARGET_W x TARGET_H)
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

        out_path = os.path.join(OUT_DIR, f"{emo}.png")
        cv2.imwrite(out_path, canvas)

        # 驗證
        c_alpha = canvas[:, :, 3]
        c_ys, c_xs = np.where(c_alpha > 20)
        c_top, c_bot = np.min(c_ys), np.max(c_ys)
        c_left, c_right = np.min(c_xs), np.max(c_xs)

        print(f"  [完成] {emo:12}: {TARGET_W}x{TARGET_H} | 人物範圍: x=[{c_left}, {c_right}], y=[{c_top}, {c_bot}] (身高: {c_bot-c_top}px)")

    print("\nKiri 7 種全情緒立繪處理與標準化完畢！")


if __name__ == "__main__":
    process_all()
