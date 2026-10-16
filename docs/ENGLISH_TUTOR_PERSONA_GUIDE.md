# Elena 英文口說導師助理形象與立繪系統說明文件

本文件詳細說明全新角色「**Elena 英文口說導師**（`english_tutor`）」的形象設計規格、7 種全表情立繪生成與去背流程、朝右視角調整、互動熱區配置，以及與 Gemini 產圖管線的整合。

---

## 一、角色設定與視覺規範

- **角色識別碼 (ID)**：`english_tutor`
- **角色名稱**：Elena 英文口說導師
- **角色性格**：知性、自信、溫暖且具備專業魅力的英語私人家教。平時鼓勵學生開口說英文，遇到文法或用詞問題時，會以親切自然的繁體中文提示與指正，再回到流暢的英文會話中。
- **外觀特徵**：
  - **髮型與髮色**：閃耀質感的金色波浪長捲髮（Golden-blonde hair），自然披散於雙肩。
  - **面容與飾品**：深邃的蔚藍色眼眸，鼻樑上架著精緻纖細的金色金絲眼鏡（Gold wire-frame glasses）。
  - **體態與身材**：成熟知性、曲線曼妙豐滿的女性身形。
  - **服裝搭配**：深藍色合身教師西裝套裝（Navy blue blazer & pencil skirt）、整齊的白色翻領襯衫、性感典雅的透膚黑絲襪（Sheer black pantyhose）與黑色漆皮高跟鞋（Black high heels）。
  - **視線方向**：**面向右側（朝右看）**，目光自然注視畫面右方的對話訊息與使用者輸入區。

---

## 二、全表情立繪規格（7 種情緒）

全套立繪儲存於 `data/avatars/english_tutor/{emotion}.png`，皆為高解析度、透明背景的全身立繪：

| 表情代碼 | 情緒語意 | 姿態與神情描寫 | 視覺反饋與動作 |
| :--- | :--- | :--- | :--- |
| `default` | 預設 / 平靜 | 優雅站立，單手拿著教學文件夾與筆 | 溫婉自信的知性微笑 |
| `happy` | 開心 / 讚賞 | 一手拿文件夾，右手熱情豎起大拇指比讚 | 燦爛開懷笑容，稱讚 "Great job!" |
| `thinking` | 思考 / 分析 | 體態微側，食指輕點下巴若有所思 | 眼神認真推敲下一個練習主題 |
| `surprised` | 驚訝 / 意外 | 身子微後退，纖手輕觸臉頰微張櫻唇 | 驚喜輕呼 "Oh!"，睜大蔚藍雙眸 |
| `shy` | 害羞 / 臉紅 | 雙頰泛紅，一手輕撩耳際的一縷金髮 | 略為羞澀閃躲的可愛成熟表情 |
| `angry` | 嚴肅 / 督導 | 雙手堅定叉在豐滿腰際，嚴格教師站姿 | 可愛嚴厲嘟嘴 "Focus on the lesson!" |
| `sad` | 同理 / 擔憂 | 雙手將教案板夾緊抱於胸前，稍微欠身 | 溫柔同理關心 "Don't worry, let's practice again" |

---

## 三、產圖與自動化管線技術

1. **自動穿透讀取 Chrome 無痕 Cookie（CDP 協議）**：
   - 透過 `core/cookie_extractor.py` 的 WebSocket 協議連接至本機無痕 Chrome（Port 9225）。
   - 零延遲提取存於 RAM 中的最新 `__Secure-1PSID`、`__Secure-1PSIDTS` 與 `__Secure-1PSIDCC`，解決磁碟鎖定問題。
2. **背景色鍵避讓去背**：
   - 角色服裝為深藍西裝、白襯衫、黑絲襪與金髮，全無綠色元素。
   - 生成時指定純亮綠幕（`#00FF00`），透過自適應色鍵演算法過濾背景並保護膚色、眼睛與金絲鏡框。
3. **水平鏡像視角翻轉（朝右看）**：
   - 在 `tools/generate_english_tutor.py` 中，去背完成後自動執行 `cv2.flip(bgra, 1)`。
   - 保證整套立繪 7 張情緒百分之百一致面向畫面右側（對話窗），視線自然延伸。

---

## 四、觸碰互動熱區（Touch Zones）配置

在 `data/personas.json` 中配置了 6 個高度契合向右看人體姿態的觸碰感應區：

```json
"touch_zones": [
  {
    "id": "head_touch",
    "name": "金髮長捲髮 (摸摸頭讚美)",
    "emotion": "happy",
    "priority": 1,
    "dialogue": "（被輕輕撫摸了金髮，露出溫柔鼓勵的笑容）Your English pronunciation has improved so much! Keep up the good work! ✨",
    "x": 30, "y": 3, "width": 40, "height": 11
  },
  {
    "id": "face_touch",
    "name": "金絲眼鏡 / 臉頰 (扶眼鏡 / 捏臉)",
    "emotion": "shy",
    "priority": 2,
    "dialogue": "（臉頰泛起微紅，輕輕扶了扶鏡框）Oh my... looking into your eyes this closely makes my heart flutter a bit. ///",
    "x": 36, "y": 14, "width": 28, "height": 9
  },
  {
    "id": "chest_touch",
    "name": "白襯衫胸口 / 教案板夾 (私人家教課)",
    "emotion": "surprised",
    "priority": 3,
    "dialogue": "（略顯驚訝地護住胸前的教案）Oh! That was a little too close for a private tutoring session, wasn't it? (giggles)",
    "x": 30, "y": 24, "width": 40, "height": 12
  },
  {
    "id": "hands_touch",
    "name": "纖腰與雙手 (翻開筆記牽牽手)",
    "emotion": "thinking",
    "priority": 4,
    "dialogue": "（若有所思地翻動教案筆記）Let's see what topic we should practice next. How about we discuss your day in English?",
    "x": 26, "y": 37, "width": 48, "height": 11
  },
  {
    "id": "skirt_touch",
    "name": "合身窄裙 / 透膚黑絲長腿 (專心上課)",
    "emotion": "angry",
    "priority": 5,
    "dialogue": "（雙手叉在腰際，嚴肅又可愛地微蹙眉頭）Hey! Eyes on the whiteboard, student! Focus on the grammar lesson, please! 💢",
    "x": 28, "y": 49, "width": 44, "height": 29
  },
  {
    "id": "shoes_touch",
    "name": "黑色漆皮高跟鞋 (腳尖 / 掉筆)",
    "emotion": "sad",
    "priority": 6,
    "dialogue": "（同理溫柔地稍微欠身關心）Did you drop your pen? Be careful down there, let me pick it up for you.",
    "x": 32, "y": 85, "width": 36, "height": 13
  }
]
```

---

## 五、維護與擴充指引

- **重新產生或擴充情緒**：
  若日後欲新增其他情緒（如得意、困惑等），只需在 `tools/generate_english_tutor.py` 的 `EMOTION_PROMPTS` 字典加入對應的描述字串，直接執行：
  ```bash
  python tools/generate_english_tutor.py
  ```
  腳本將自動讀取無痕視窗的 Cookie、發送 Gemini 請求、自動綠幕去背，並預設以鏡像朝右看儲存至 `data/avatars/english_tutor/{emotion}.png`。
