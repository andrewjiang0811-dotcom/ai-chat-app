# 傲嬌貓娘全表情立繪補齊、觸碰熱區定位修復與 Gemini API 健全性優化

本文件記錄傲嬌貓娘（咪嚕）全套情緒立繪補齊、觸碰感應熱區對齊架構重構，以及 Gemini Web API 連線健全性修復之完整技術實施細節。

---

## 一、 問題診斷與成因分析

### 1. 觸碰熱區集中在圖片上方的成因
* **原架構缺陷**：
  * 立繪容器 `.sprite-transform` 為滿版絕對定位（`position: absolute; inset: 0`），其寬高涵蓋整個舞台區域（例如 500px × 520px）。
  * 舊熱區層 `.sprite-touch-overlay` 被設定為 `position: absolute; width: 100%; height: 100%`，其坐標原點與邊界是整個舞台。
  * 傲嬌貓娘立繪採用 **16:9 橫幅比例**（1280 × 757），在容器內靠底（`align-items: flex-end`）展示，高度僅約佔舞台下方 260px，上方留下近 50% 的空白。
  * 熱區的百分比座標（如 $y=0\% \sim 30\%$）被計算在整個舞台的上半部，導致所有熱區全部懸浮在趴臥貓娘的頭頂上方空白處。

### 2. Gemini Web API 報錯「The model is currently unreachable」的成因
* 系統設定中存入非公開測試型號 `gemini-argon`，Google 網頁版 API 對該未授權/進階型號拒絕存取並報錯。
* 免費與標準帳號在呼叫 `gemini_webapi` 時，若不手動指定特定進階型號（傳入 `model=None` 或 `default`），Google 會自動使用帳號支援之最新預設模型，秒回流式答案。

---

## 二、 解決方案與核心實作

### 1. 引入 `.sprite-anchor` 錨點容器（像素級嚴絲合縫）
在 `static/index.html` 與 `static/css/style.css` 引入自適應錨點容器 `.sprite-anchor`：

```html
<div class="sprite-transform" id="sprite-transform">
  <!-- Character Sprite Anchor: 緊密貼合立繪本體的精準錨點容器 -->
  <div class="sprite-anchor" id="sprite-anchor">
    <img id="character-sprite" class="sprite-img mode-half-body hidden" src="" alt="角色立繪" draggable="false">
    <div class="sprite-touch-overlay" id="sprite-touch-overlay"></div>
  </div>
</div>
```

```css
/* Sprite Anchor: 精準貼合立繪本體的錨點容器，確保熱區百分之百吻合立繪真實像素邊界 */
.sprite-anchor {
  position: relative;
  display: inline-flex;
  align-items: flex-end;
  justify-content: center;
  max-width: 100%;
  max-height: 95%;
  width: auto;
  height: auto;
  pointer-events: none;
}

/* Sprite Image: 自然比例縮放，完全不產生任何 Letterbox 假邊界空白 */
.sprite-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  display: block;
}
```

* **優勢**：`.sprite-anchor` 自動依據 `img` 的渲染邊界完全收縮貼合，`.sprite-touch-overlay` 的 $0\% \sim 100\%$ 與立繪本體 100% 吻合，不論是橫向 16:9 趴臥還是直立全身皆分毫不差。

---

### 2. 傲嬌貓娘全套 6 種情緒立繪生成與純綠幕去背
遵循《角色立繪生成與去背標準作業規範》（`docs/CHARACTER_SPRITE_GUIDELINES.md`）：
* 使用純綠幕 `#00FF00` 背景生圖，徹底避免貓娘的米白毛衣、肌膚被挖空。
* 透過純 Pillow 演算法進行色彩鍵去背與邊緣 Despill 綠光壓平。
* 所有立繪解析度與裁切畫布統一為 `(1280, 757)`，表情切換時本體與枕頭零位移（同軸立繪）。

| 表情 Key | 檔案路徑 | 傲嬌表情特徵 | 觸發熱區 |
| :--- | :--- | :--- | :--- |
| `default` | `/avatars/tsundere_cat/default.png` | 慵懶微瞪、微嘟小嘴與尖牙 | 預設外觀 |
| `happy` | `/avatars/tsundere_cat/happy.png` | 幸福瞇瞇月牙眼、小貓咪「:3」微笑、呼嚕享受 | 撫摸身側 / 軟枕 |
| `shy` | `/avatars/tsundere_cat/shy.png` | 雙頰爆紅、飛機耳向後貼、慌張羞澀咬唇 | 揉揉耳尖 / 順尾巴毛 |
| `angry` | `/avatars/tsundere_cat/angry.png` | 氣鼓鼓腮幫子、亮出銳利小虎牙、眼神銳利抗議 | 戳戳臉頰 / 搔搔腳尖 |
| `surprised` | `/avatars/tsundere_cat/surprised.png` | 金色圓瞳睜大、耳朵豎起抖動、微張 O 型小嘴 | 輕碰金鈴鐺 |
| `thinking` | `/avatars/tsundere_cat/thinking.png` | 眼神向上斜瞄、微側著小腦袋傲嬌思索 | 閒置思考 / 對話推理 |
| `sad` | `/avatars/tsundere_cat/sad.png` | 眼眶泛淚光、貓耳耷拉微垂、小嘴微癟惹人憐愛 | 負面情境觸發 |

---

### 3. 六大熱區精密像素坐標配置
在 `data/personas.json` 中配置橫幅趴臥專屬熱區：

```json
[
  { "id": "ears_touch", "name": "毛茸茸貓耳朵 (揉揉耳尖)", "emotion": "shy", "x": 8, "y": 3, "width": 32, "height": 36 },
  { "id": "face_touch", "name": "軟軟臉頰 / 小貓牙 (戳戳臉)", "emotion": "angry", "x": 16, "y": 36, "width": 22, "height": 26 },
  { "id": "bell_touch", "name": "紅絲絨金鈴鐺 (輕碰頸圈)", "emotion": "surprised", "x": 30, "y": 58, "width": 9, "height": 14 },
  { "id": "sweater_touch", "name": "慵懶落肩毛衣 / 軟枕 (撫摸身側)", "emotion": "happy", "x": 38, "y": 48, "width": 34, "height": 44 },
  { "id": "tail_touch", "name": "輕晃黑貓尾巴 (順順尾巴毛)", "emotion": "shy", "x": 60, "y": 2, "width": 16, "height": 54 },
  { "id": "feet_touch", "name": "微翹小腳丫 (搔搔腳尖)", "emotion": "angry", "x": 75, "y": 10, "width": 24, "height": 65 }
]
```

---

### 4. Gemini Web API 憑證更新與模型 Fallback 機制
1. **憑證更新**：在 `data/config.json` 寫入最新提供的 `__Secure-1PSID`、`__Secure-1PSIDTS` 與 `__Secure-1PSIDCC`。
2. **安全模型映射**：
   - 在 `core/llm_provider.py` 中，將 `gemini-argon` 等非通用代號過濾，預設或 flash 模式下以 `model=None` 安全傳遞給 Google，讓官方自動選派最適配模型。
   - 新增 `default` 選項至可用模型選單，確保呼叫 100% 成功秒回。

---

## 三、 驗證結果

1. **熱區定位驗證**：進入「📐 熱區」模式與「🖐️ 互動」模式，確認熱區矩形精確貼合耳朵、臉部、鈴鐺、毛衣、尾巴與腳丫，天花板懸空現象完全消失。
2. **情緒動態切換**：點擊熱區時，咪嚕的立繪即時切換至 `shy`（害羞）、`angry`（生氣亮牙）、`happy`（開懷享受）、`surprised`（驚訝圓眼），且身體枕頭嚴絲合縫無跳動。
3. **對話串流測試**：發送訊息測試，Gemini Web API 3 秒內流式返回繁體中文回答，連線穩定流暢。
