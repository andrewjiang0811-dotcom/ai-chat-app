"""
標準化萬能助理 (Assistant) 全套立繪尺寸與錨點對齊腳本
將 7 種情緒立繪統一至相同的畫布規格 (960x1515)，
消除 surprised (2333px) 等超大尺寸造成的情緒切換抖動與忽大忽小問題。
"""

import os
import cv2
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AVATAR_DIR = os.path.join(BASE_DIR, "data", "avatars", "assistant")

TARGET_W = 960
TARGET_H = 1515
TARGET_TOP_Y = 25
TARGET_BOT_Y = 1495
TARGET_BODY_H = TARGET_BOT_Y - TARGET_TOP_Y  # 1470
TARGET_AXIS_X = 480.0

EMOTIONS = ["default", "happy", "thinking", "surprised", "shy", "angry", "sad"]


def standardize_sprites():
    print(f"開始標準化萬能助理立繪 (目標尺寸: {TARGET_W}x{TARGET_H})...")

    for emo in EMOTIONS:
        file_path = os.path.join(AVATAR_DIR, f"{emo}.png")
        if not os.path.exists(file_path):
            continue

        im = cv2.imread(file_path, cv2.IMREAD_UNCHANGED)
        if im is None or im.shape[2] < 4:
            continue

        alpha = im[:, :, 3]
        ys, xs = np.where(alpha > 20)
        if len(ys) == 0:
            continue

        top_y, bot_y = np.min(ys), np.max(ys)
        orig_body_h = bot_y - top_y

        scale = TARGET_BODY_H / float(orig_body_h)

        torso_y1 = int(top_y + orig_body_h * 0.15)
        torso_y2 = int(top_y + orig_body_h * 0.55)
        t_ys, t_xs = np.where(alpha[torso_y1:torso_y2, :] > 50)
        orig_axis_x = np.median(t_xs) if len(t_xs) > 0 else (np.min(xs) + np.max(xs)) / 2.0

        new_w = int(round(im.shape[1] * scale))
        new_h = int(round(im.shape[0] * scale))
        resized = cv2.resize(im, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

        offset_y = int(round(TARGET_TOP_Y - top_y * scale))
        offset_x = int(round(TARGET_AXIS_X - orig_axis_x * scale))

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

        cv2.imwrite(file_path, canvas)

        c_alpha = canvas[:, :, 3]
        c_ys, c_xs = np.where(c_alpha > 20)
        c_top, c_bot = np.min(c_ys), np.max(c_ys)
        c_left, c_right = np.min(c_xs), np.max(c_xs)

        print(
            f"  [完成] {emo:12}: 原尺寸 {im.shape[1]}x{im.shape[0]} -> {TARGET_W}x{TARGET_H} | "
            f"人物 bounds: x=[{c_left}, {c_right}], y=[{c_top}, {c_bot}] (高度: {c_bot - c_top}px)"
        )

    print("\n萬能助理立繪已全數完成規格標準化！")


if __name__ == "__main__":
    standardize_sprites()
