# 角色立繪生成與去背標準作業規範 (Character Sprite Guidelines)

本規範記錄了 AI 助理（以及日後所有對話角色）在進行圖像生成、背景選色、綠幕色鍵去背與特徵對齊時的**核心原則與注意事項**，已納入版本控制以作為後續角色資產維護的標準基準。

---

## 1. 背景選色核心法則（黃金禁忌原則）

### 1.1 嚴禁使用角色身上已有之配色作為生圖背景
- **核心痛點**：
  若角色的服飾或頭髮包含白色（如萬能助理的白襯衫、白百褶裙、銀白雙馬尾），**絕對嚴禁在生圖 Prompt 中使用「白色背景（White background）」**！
  - 白色背景會導致任何去背演算法（無論是門檻值法、邊界泛洪法或一般去背工具）在處理服飾褶皺、衣角與半透明接縫時，把白襯衫與百褶裙當作背景一併消除，造成**衣服穿透、破洞或半透明瑕疵**。
- **標準解法（色鍵 Chroma Key 原則）**：
  生圖時**必須選擇角色身上完全沒有使用到的高對比純色背景**：
  - **首選配色**：純亮綠幕 `Solid pure bright green screen background #00FF00`（Chroma Key Green）。
  - **備選配色**：純洋紅/高飽和亮粉 `Solid magenta background #FF00FF`（當角色全身有大面積綠色時適用）。

---

## 2. 綠幕色鍵去背四大防護原則

### 2.1 白色服飾 100% 飽滿保護
- 純綠幕（$R \approx 0, G \approx 255, B \approx 0$）與白襯衫/百褶裙（$R \approx 255, G \approx 255, B \approx 255$）在色相與色彩差異上有極大邊界：
  - 綠幕判斷條件：$G > 120$ 且 $G - \max(R, B) > 30$。
  - 白色服飾的 $\max(R, B)$ 幾乎等於 $G$（$G - \max(R, B) \approx 0$），因此**白襯衫與百褶裙絕不會被色鍵誤刪**，能 100% 保持實心不透明與立體陰影。

### 2.2 敏感部位精準防護（Eyes & Necktie Protection）
當角色身上有與背景相似之微量色系時（例如助理的「翡翠綠眼眸」與「青綠色領帶」），必須施加區域與色彩保護：
1. **翡翠綠眼睛保護**：
   - 限制眼睛矩形區域（寬度約 $0.42W \sim 0.58W$，高度約 $0.14H \sim 0.185H$）。
   - 眼睛周圍被皮膚與眼眶包圍，在該區域內保護綠色像素不被去背。
2. **青藍色領帶保護 (Teal Necktie)**：
   - 青藍色領帶含有顯著的藍色通道（$B \ge 90$），且綠色差值遠小於純綠幕。
   - 透過顏色條件（$B \ge 90$）或區域限制排除在去背條件外。

### 2.3 邊緣去綠光溢色 (Despill / Spill Suppression)
- AI 生成綠幕圖片時，邊緣像素（如銀髮、肩膀）會反射綠幕環境光，產生一圈微淡綠色的毛邊。
- **消色處理（Despill）**：
  對所有非背景像素檢查，若非眼睛或領帶且 $G > \max(R, B)$，強制將綠色通道壓制為 $\max(R, B)$ 或 $\frac{R+B}{2}$，徹底去除綠色雜光光暈。

### 2.4 邊緣羽化與抗鋸齒 (Edge Anti-Aliasing)
- 生成二值遮罩（Alpha Mask）後，使用輕微高斯模糊（$\text{radius} \approx 0.5 \sim 0.6$）進行邊緣羽化，消除鋸齒狀階梯，使人物邊緣平滑融合於任何介面背景。

---

## 3. 萬能助理 (Assistant) Prompt 撰寫標準

為了確保助理更換任何表情時髮型與五官特徵 100% 連貫，Prompt 必須包含以下強制字句：

```text
Full length full-body anime character standing sprite: cute anime girl identical to reference image.
HAIRSTYLE REQUIREMENT: Keep the exact same clean high silver twin-tails tied with dark blue ribbons, exact same natural soft bangs (NOT blunt cut, NOT straight bangs, NO loose hair hanging down in the back, clean nape and pure twin-tails only).
Eyes: Sparkling emerald green anime eyes (same as reference).
Outfit: Identical white collared long-sleeve shirt, navy school uniform vest, teal necktie, white pleated skirt, black thigh-high stockings, black school loafers.
Pose & Expression: [依據表情指定動作與神態]
CRITICAL BACKGROUND REQUIREMENT: Solid pure bright green screen background #00FF00, flat even chroma key green, no gradients, no shadows on background, clean sharp lines, 2D visual novel character sprite. Entire body from top of head to bottom of shoes completely visible inside frame, full body shot.
```

### 關鍵排除詞（Negative Checklist）：
- ❌ **禁止披散長髮**：嚴禁「loose hair hanging down back」、「half updo」，必須指定「clean nape」。
- ❌ **禁止厚重齊瀏海**：指定「natural soft bangs」，禁止「straight blunt bangs」。
- ❌ **禁止變更眼色**：指定「emerald green eyes」，嚴禁藍眼、紫眼或黑眼。

---

## 4. 尺寸與基準線統一標準 (Canvas & Alignment)

- **基準高度**：所有角色立繪最終輸出高度一律對齊為 **`1515px`**。
- **腳底基準線**：鞋底須貼齊畫布底部邊緣（保留約 10px 安全邊距），防止在表情切換時角色上下浮動。
- **觸碰熱區相容性**：高度與身形比例嚴格對齊後，`data/personas.json` 中配置的頭部（y=5%）、臉部（y=15%）、胸口領帶（y=24%）、百褶裙（y=50%）與皮鞋（y=86%）互動熱區皆能完美契合。

---

## 5. 產圖前自動同步 Cookie 機制 (Automated Gemini Cookie Sync)

為解決調用 Gemini Web API 產圖時 Cookie（`__Secure-1PSIDTS`）頻繁過期的問題，已在產圖工具鏈中整合自動同步模組：

### 5.1 運作架構
1. **呼叫產圖前自動提取**：
   - 當使用者指示「請產圖」或執行產圖腳本時，系統會先呼叫 `core.cookie_extractor.get_or_sync_gemini_cookies()`。
   - 自動掃描本機 Edge / Chrome 儲存的 `.google.com` Cookie 資料庫，使用 Windows DPAPI 解密得到最新的 `__Secure-1PSID`、`__Secure-1PSIDTS` 與 `__Secure-1PSIDCC`。
   - 自動寫入 `data/gemini_cookies.json` 與 `data/config.json`，隨後立即發起生圖請求。
2. **檔案被鎖定時的備用機制**：
   - 若瀏覽器運行中且開啟獨佔鎖定，系統優先讀取既有快取 Cookie；若快取已失效，可使用開發專用擴充功能 `extensions/gemini-cookie-sync/` 傳送更新。

### 5.2 產圖工具使用指令
```bash
# 生成單張指定表情與角色立繪（自動檢測並同步最新 Cookie）
python tools/generate_character_sprite.py --persona tsundere_cat --emotion happy --prompt "..." --bg green

# 批次生成萬能助理全表情立繪
python batch_generate_sprites.py
```

---

## 6. 專案參考代碼
- 產圖與色鍵去背整合工具：[tools/generate_character_sprite.py](file:///c:/WorkFolder/MyProject/ai-chat-app/tools/generate_character_sprite.py)
- 批次生成腳本：[batch_generate_sprites.py](file:///c:/WorkFolder/MyProject/ai-chat-app/batch_generate_sprites.py)
- Cookie 自動提取模組：[core/cookie_extractor.py](file:///c:/WorkFolder/MyProject/ai-chat-app/core/cookie_extractor.py)
- 表情修正歷史記錄：[docs/PERSONA_SPRITES_REFINEMENT.md](file:///c:/WorkFolder/MyProject/ai-chat-app/docs/PERSONA_SPRITES_REFINEMENT.md)

