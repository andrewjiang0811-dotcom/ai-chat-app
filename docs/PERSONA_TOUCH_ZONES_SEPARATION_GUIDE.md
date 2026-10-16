# 角色形象熱區獨立儲存架構與萬能助理／英語口說導師熱區校準說明文件

本文件記錄「觸碰感應熱區（Touch Zones）」依不同形象分開獨立儲存之系統重構架構，以及「萬能助理」與「英語口說導師（Elena）」立繪熱區精密校準與修復技術細節。

---

## 一、 需求與架構重構概述

### 1. 核心需求
1. **熱區設定分角色獨立儲存**：過去所有角色的觸碰熱區均混雜在全域的 `data/personas.json` 中，不利於個別角色的維護、匯出與獨立調整。需重構成每個角色形象擁有專屬的獨立 JSON 設定檔。
2. **萬能助理（assistant）熱區校準**：修正立繪熱區錯位、漂浮或被推擠出畫面的問題，精準貼合全身立繪之雙馬尾、臉部、領帶、雙手、百褶裙、過膝長襪與小皮鞋。
3. **英語口說導師（english_tutor）熱區校準**：針對全套 7 種情緒朝右看、成熟高挑立繪（手持教案板夾、金絲眼鏡、深藍窄裙、透膚黑絲），完成 8 個專屬熱區之精密定位。

---

## 二、 熱區獨立儲存架構設計

### 1. 目錄與檔案結構
熱區設定統一遷移至專屬目錄 `data/touch_zones/`，以角色的 `persona_id` 命名獨立 JSON 檔案：

```text
ai-chat-app/
├── data/
│   ├── touch_zones/
│   │   ├── assistant.json          # 萬能助理獨立熱區設定 (7 個部位)
│   │   ├── english_tutor.json      # Elena 英語口說導師獨立熱區 (8 個部位)
│   │   ├── tsundere_cat.json       # 傲嬌貓娘咪嚕獨立熱區 (6 個部位)
│   │   ├── coder.json              # 程式碼工程師獨立熱區
│   │   └── game_designer.json      # 遊戲數值企劃獨立熱區
│   └── personas.json               # 角色清單與基礎資訊 (雙向同步維持向後相容)
```

### 2. 後端核心處理邏輯 (`core/personas.py`)
- **常數定義**：`TOUCH_ZONES_DIR = os.path.join(DATA_DIR, "touch_zones")`，系統啟動時自動確保資料夾存在。
- **讀取優先序 (`load_persona_touch_zones(persona_id)`)**：
  1. 優先從 `data/touch_zones/{persona_id}.json` 讀取。
  2. 若無獨立檔案，自動從 `data/personas.json` 中的 `touch_zones` 欄位遷移並自動儲存獨立檔案。
  3. 若皆無，則採用 `DEFAULT_TOUCH_ZONES` 預設範本。
- **獨立儲存 (`save_persona_touch_zones(persona_id, touch_zones)`)**：
  - 獨立寫入 `data/touch_zones/{persona_id}.json`，保證排他性與獨立維護。
  - 同步更新記憶體與 `data/personas.json`，確保舊端點與相容層無痛運作。

### 3. RESTful API 端點
- `GET /api/personas/{persona_id}/touch_zones`：取得指定角色的獨立熱區設定清單。
- `PUT /api/personas/{persona_id}/touch_zones`：儲存/更新指定角色的獨立熱區設定。

---

## 三、 熱區錯位根本原因與前端像素級同步修復

### 1. 根本原因診斷 (The Broken Percentage Height Issue)
- **結構缺陷**：
  在立繪舞台中，立繪圖片包覆在 `.sprite-anchor` 錨點容器內：
  ```html
  <div class="sprite-transform" id="sprite-transform">
    <div class="sprite-anchor" id="sprite-anchor">
      <img id="character-sprite" class="sprite-img" ...>
      <div class="sprite-touch-overlay" id="sprite-touch-overlay"></div>
    </div>
  </div>
  ```
- **CSS 衝突**：
  - `.sprite-transform` 設定了 `align-items: flex-end; justify-content: center; position: absolute; inset: 0;`。
  - `.sprite-anchor` 為 `display: inline-flex; height: auto; max-height: 95%;`。
  - 萬能助理與英語口說導師皆為 **1:2.45 的極修長直立立繪**（解析度約 625×1530）。
  - 在 flex 容器內，`height: auto` 使得內部的子元素百分比高度（`max-height: 100%`）引發排版循環未決，造成 `.sprite-touch-overlay`（`height: 100%`）的高計算值被壓縮成只有底部一小截（如膝蓋至腳底約 100px）。
  - 導致設定在頭部、臉頰的熱區（如 $y=2\% \sim 15\%$）直接以被壓縮的底部為基準，全部錯位擠壓在立繪膝蓋與大腿處！

### 2. 徹底解法：`syncTouchOverlayBounds()` 像素級動態貼齊
在 `static/js/app.js` 中引入邊界同步機制，放棄讓 overlay 依賴易受 flex 影響的 CSS 容器高度，改由 JavaScript 直接抓取立繪 `<img>` 在畫面上的**真實渲染像素寬高與偏移量**：

```javascript
// 精準將觸碰熱區覆蓋層貼合至角色立繪圖片 (100% 像素級吻合，徹底杜絕 CSS 容器未撐開或位移問題)
function syncTouchOverlayBounds() {
  if (!spriteTouchOverlay || !characterSprite) return;
  if (characterSprite.classList.contains("hidden") || !characterSprite.src) {
    spriteTouchOverlay.style.display = "none";
    return;
  }
  spriteTouchOverlay.style.display = "";

  // 取得 characterSprite 實際渲染尺寸與相對於 offsetParent (即 sprite-anchor) 的精準偏移
  const imgW = characterSprite.offsetWidth;
  const imgH = characterSprite.offsetHeight;
  const imgTop = characterSprite.offsetTop;
  const imgLeft = characterSprite.offsetLeft;

  if (imgW > 0 && imgH > 0) {
    spriteTouchOverlay.style.position = "absolute";
    spriteTouchOverlay.style.top = `${imgTop}px`;
    spriteTouchOverlay.style.left = `${imgLeft}px`;
    spriteTouchOverlay.style.width = `${imgW}px`;
    spriteTouchOverlay.style.height = `${imgH}px`;
  }
}
```

- **全面掛載監聽**：
  1. `characterSprite.addEventListener("load", ...)`：立繪圖片載入完成立刻同步。
  2. `window.addEventListener("resize", ...)`：視窗縮放或並排比例調整時動態重算。
  3. `applySpriteView()`：立繪拖曳平移或滾輪縮放時持續鎖定。
  4. `renderTouchOverlay()`：切換熱區模式時立即刷新。

---

## 四、 萬能助理與英語口說導師熱區精準定位對照表

### 1. 萬能助理 (`assistant.json`)
*立繪特徵：銀白髮雙馬尾、綠色眼眸、校服領帶與深藍背心、白百褶裙、黑過膝襪、黑色小皮鞋。*

| # | 部位 ID | 區域名稱 | 幾何坐標 $(x, y, w, h)$ | 觸發情緒 | 互動反應台詞 |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `head_touch` | 頭部 / 雙馬尾 (摸摸頭) | `x:24%, y:3%, w:52%, h:11%` | `happy` (開心) | （被輕輕撫摸了雙馬尾）嘿嘿～好舒服呀，謝謝你！✨ |
| 2 | `face_touch` | 臉頰 / 嘴部 (捏捏臉) | `x:37%, y:13%, w:26%, h:9%` | `shy` (害羞) | （臉頰泛起微紅）等等...別突然戳人家的臉啦/// |
| 3 | `chest_touch` | 胸口 / 校服領帶 (心跳加速) | `x:32%, y:22%, w:36%, h:13%` | `surprised` (驚訝) | （慌慌張張護住胸口）呀！碰那裡太突然了啦...心跳都變快了！ |
| 4 | `hands_touch` | 纖腰 / 交疊雙手 (牽牽手) | `x:28%, y:35%, w:44%, h:12%` | `happy` (開心) | （溫暖地回牽住你的手）想牽手嗎？我的手很暖和吧，隨時都在這裡陪著你喔！ |
| 5 | `skirt_touch` | 白色百褶裙 (害羞壓裙擺) | `x:22%, y:47%, w:56%, h:11%` | `angry` (生氣) | （氣呼呼地壓緊百褶裙擺）哇！你在摸哪裡呀！大笨蛋，要生氣了喔！哼！ |
| 6 | `legs_touch` | 黑過膝襪 / 絕對領域 (輕觸長腿) | `x:30%, y:58%, w:40%, h:25%` | `shy` (害羞) | （雙腿微微併攏，害羞地側過頭）嗚...盯著長襪看就算了，怎麼還動手碰呀.../// |
| 7 | `shoes_touch` | 黑色小皮鞋 / 腳尖 (踩碎步) | `x:36%, y:84%, w:36%, h:14%` | `thinking` (專注) | （低頭好奇看了看自己的小皮鞋）鞋子上有沾到灰塵嗎？謝謝你的提醒～ |

---

### 2. 英語口說導師 Elena (`english_tutor.json`)
*立繪特徵：金髮大波浪捲髮、金絲眼鏡、成熟知性容貌、白襯衫微敞、右側手持教案板夾、左側自然垂落纖手、深藍合身窄裙、透膚黑絲襪、黑色漆皮高跟鞋（視線自然朝向右方聊天視窗）。*

| # | 部位 ID | 區域名稱 | 幾何坐標 $(x, y, w, h)$ | 觸發情緒 | 英語口說互動台詞 |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `head_touch` | 金色長捲髮 (摸摸頭讚賞) | `x:28%, y:2%, w:38%, h:10%` | `happy` (開心) | （被輕輕撫摸了金髮，露出溫柔鼓勵的笑容）Your English pronunciation has improved so much! Keep up the good work! ✨ |
| 2 | `face_touch` | 金絲眼鏡 / 臉頰 (扶眼鏡 / 捏臉) | `x:33%, y:12%, w:29%, h:9%` | `shy` (害羞) | （臉頰泛起微紅，輕輕扶了扶鏡框）Oh my... looking into your eyes this closely makes my heart flutter a bit. /// |
| 3 | `chest_touch` | 白襯衫胸口 / 西裝領 (私人家教) | `x:30%, y:21%, w:35%, h:12%` | `surprised` (驚訝) | （略顯驚訝地護住胸前）Oh! That was a little too close for a private tutoring session, wasn't it? (giggles) |
| 4 | `clipboard_touch` | 教案板夾 / 講義原子筆 (翻看筆記) | `x:56%, y:24%, w:36%, h:19%` | `thinking` (專注) | （優雅翻動手上的教案板夾）Let's see what topic we should practice next. How about we discuss your day in English? |
| 5 | `hands_touch` | 纖腰與手部 (牽牽手加油) | `x:16%, y:34%, w:30%, h:14%` | `happy` (開心) | （溫柔地反握住你的手）Confidence is key in speaking English. Don't be afraid to make mistakes, I'm right here with you! |
| 6 | `skirt_touch` | 深藍合身窄裙 (專心上課) | `x:20%, y:47%, w:46%, h:13%` | `angry` (微嗔) | （雙手叉在腰際，嚴肅又可愛地微蹙眉頭）Hey! Eyes on the whiteboard, student! Focus on the grammar lesson, please! 💢 |
| 7 | `legs_touch` | 透膚黑絲美腿 (輕觸黑絲長腿) | `x:26%, y:60%, w:40%, h:24%` | `shy` (害羞) | （微偏過身子，臉頰微燙地輕咳一聲）Ahem... Are my pantyhose distracting you from the lesson? Let's stay focused! /// |
| 8 | `shoes_touch` | 黑色漆皮高跟鞋 (腳尖 / 掉筆) | `x:30%, y:85%, w:32%, h:13%` | `sad` (關切) | （同理溫柔地稍微欠身關心）Did you drop your pen? Be careful down there, let me pick it up for you. |

---

## 五、 實測驗證成果

1. **萬能助理熱區對齊驗證**：
   - 進入「熱區」編輯模式時，7 個熱區框完整浮現在雙馬尾、臉部、領帶胸口、交疊手腕、百褶裙、過膝長襪上，零錯位。
2. **英語口說導師熱區對齊驗證**：
   - 8 個熱區框嚴絲合縫貼合在金髮、金絲眼鏡、胸口白襯衫、畫面右側手持之「教案板夾」、深藍窄裙與透膚黑絲美腿。
3. **互動模式即時回饋驗證**：
   - 切換至「互動」模式後，滑鼠懸停於教案板夾即時亮起粉紅觸碰光芒。
   - 點擊板夾立即觸發 Elena 思考表情切換，並在立繪上方浮現專屬雙語反應氣泡。
4. **傲嬌貓娘相容性驗證**：
   - 橫向 16:9 趴臥貓娘立繪（咪嚕）之 6 大熱區維持 100% 吻合，不受直式立繪修復影響。
