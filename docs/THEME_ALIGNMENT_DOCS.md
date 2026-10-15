# 聊天室主題排版與對話對齊規範說明文件

本文件詳細說明聊天室三大主題模式（**LINE 通訊**、**典藏羊皮紙**、**古典書籍**）在使用者內容與 AI 角色發言的排版對齊邏輯、視覺層次規範與實作細節。

---

## 📌 一、各主題對話對齊規則總覽

| 主題名稱 | 核心情境與外觀 | 使用者發言對齊 | 角色發言對齊 | 文字底端行線 (Ruled Lines) | 氣泡 / 外觀特徵 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **📱 LINE 通訊** (`theme-line`) | 現代智慧手機通訊軟體 | **堅定靠右** (Right) | **靠左** (Left) | ❌ 無行線 | 招牌鮮綠氣泡、已讀標記與發送時間靠右貼合邊緣；AI 角色為純白氣泡 |
| **📜 典藏羊皮紙** (`theme-parchment`) | 中世紀羊皮紙手抄對話錄 | **一致靠左** (Left) | **靠左** (Left) | **✔️ 有行線** (緊貼文字底端) | 消除現代氣泡，標題帶有「我：」底線標記與古草書墨跡字體，外置黑胡桃木寫作案 |
| **📖 古典書籍** (`theme-book`) | 珍本古典精裝雙頁開本 | **一致靠左** (Left) | **靠左** (Left) | **❌ 嚴格無行線** | 典籍朱砂墨標題，左右古籍中縫深邃陰影，純淨空白手抄古書印刷段落排版 |

---

## 🛠️ 二、樣式實作細節解析

### 1. 📱 LINE 通訊模式 (`.theme-line` / `.frame-phone`)
- **排版目標**：確保使用者發送的氣泡與時間中繼資訊完全靠右貼齊，消除使用者頭像以符合 LINE 真實互動規範。
- **CSS 關鍵實作** ([static/css/style.css](file:///c:/WorkFolder/MyProject/ai-chat-app/static/css/style.css#L1586-L1625))：
  ```css
  /* 使用者發言氣泡 (LINE 招牌鮮綠色 + 內容堅定靠右) */
  .theme-line .message-row.user,
  .chat-dialogue-panel.frame-phone .message-row.user {
    display: flex !important;
    flex-direction: row !important;
    justify-content: flex-end !important;
    align-items: flex-end !important;
    width: 100% !important;
    margin-left: auto !important;
    margin-right: 0 !important;
    position: relative;
    gap: 6px;
  }

  /* LINE 中自己發言不顯示頭像，確保氣泡貼近右邊界 */
  .theme-line .message-row.user .msg-avatar,
  .chat-dialogue-panel.frame-phone .message-row.user .msg-avatar {
    display: none !important;
  }

  /* 氣泡本體與文字靠右對齊 */
  .theme-line .message-row.user .msg-bubble,
  .chat-dialogue-panel.frame-phone.theme-line .message-row.user .msg-bubble {
    background: #85e242 !important;
    border-radius: 18px !important;
    border-top-right-radius: 4px !important;
    text-align: right !important;
  }
  .theme-line .message-row.user .bubble-text p {
    text-align: right !important;
  }
  ```

- **外框寬度與自適應填滿規範** ([static/css/style.css](file:///c:/WorkFolder/MyProject/ai-chat-app/static/css/style.css#L1730-L1770))：
  - **解除 440px 窄屏鎖死**：將手機外框 `.device-frame-container` 的 `max-width` 調整為 `100%`，讓左右邊界填滿右側對話面板，大幅擴增可視與閱讀空間。
  - **自適應 Resizer 連動**：使用者可隨時拖曳立繪區與對話視窗中間的分隔條（`#stage-resizer`）；若偏好經典手機修長手感，只需向右拖曳縮減對話區寬度；若需要寬螢幕閱讀，向左拖曳即可自動展開滿版。
  - **極窄旗艦邊框工藝**：精修邊框為 `8px solid #1a1e24` 搭配 `border-radius: 36px`，頂部動態島居中，狀態列與底部 Home Indicator 自然貼合。

---

### 2. 📜 典藏羊皮紙模式 (`.theme-parchment` / `.frame-parchment`)
- **排版目標**：呈現中世紀手抄羊皮紙故事，使用者與角色發言皆**一律靠左排版**，每行文字底部緊貼手稿橫向格線。
- **CSS 關鍵實作** ([static/css/style.css](file:///c:/WorkFolder/MyProject/ai-chat-app/static/css/style.css#L2233-L2285))：
  ```css
  /* 使用者發言 (羊皮紙手稿：依指示一致靠左排版) */
  .theme-parchment .message-row.user,
  .theme-kraft .message-row.user {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start !important;
    text-align: left !important;
    margin-bottom: 22px;
  }

  /* 使用者開頭「我：」左側標題帶有手繪底線 */
  .theme-parchment .message-row.user .msg-bubble::before {
    content: "我：";
    display: block;
    font-size: 21px;
    font-weight: 800;
    color: #3b2111;
    text-align: left !important;
    width: 100%;
    border-bottom: 2px solid #3b2111;
    margin-bottom: 8px;
    padding-bottom: 2px;
  }

  /* 內文文字貼合手稿行線 (Ruled Lines) */
  .theme-parchment .bubble-text {
    line-height: 2.2em;
    background-image: repeating-linear-gradient(
      transparent,
      transparent calc(2.2em - 1.5px),
      rgba(139, 90, 43, 0.42) calc(2.2em - 1.5px),
      rgba(139, 90, 43, 0.42) 2.2em
    );
  }
  ```

---

### 3. 📖 古典書籍模式 (`.theme-book` / `.frame-book`)
- **排版目標**：呈現古典精裝古籍雙頁展開視覺，文字段落排版與羊皮紙相同**一律靠左對齊**，但**嚴格不要有行線**。
- **CSS 關鍵實作** ([static/css/style.css](file:///c:/WorkFolder/MyProject/ai-chat-app/static/css/style.css#L2570-L2615))：
  ```css
  /* 使用者發言 (古籍典藏書本：依指示一致靠左排版，純淨無行線) */
  .theme-book .message-row.user {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start !important;
    text-align: left !important;
    margin-bottom: 24px;
  }

  .theme-book .message-row.user .msg-bubble::before {
    content: "我：";
    display: block;
    font-size: 21px;
    font-weight: 800;
    color: #2c1b10;
    text-align: left !important;
    width: 100%;
    border: none !important; /* 嚴格無行線！ */
    margin-bottom: 8px;
    font-family: 'Noto Serif TC', 'Songti TC', Georgia, serif;
    letter-spacing: 1px;
  }

  /* 內文段落一致靠左，且完全移除底線背景 */
  .theme-book .message-row.user .bubble-text,
  .theme-book .message-row.user .bubble-text p {
    text-align: left !important;
    border: none !important;
    background-image: none !important;
  }
  ```

- **雙頁展開排版模型 (Open Book System)** ([static/css/style.css](file:///c:/WorkFolder/MyProject/ai-chat-app/static/css/style.css#L2430-L2550))：
  - **沉浸式黑胡桃木書桌底座**：工作區外圍為深度漸層暗棕色書桌光澤，兩側緊密貼合。
  - **左頁 (Left Folio)**：立繪區化身為古籍全幅手繪插畫頁，泛黃羊皮古紙質感、外包邊與右側中縫深邃立體陰影。
  - **中央裝訂脊線 (Book Gutter)**：中線拖曳分隔條化身為古籍書脊凹槽，無縫銜接左右兩頁並支援滑鼠拖動調節比例。
  - **右頁 (Right Folio)**：對話區化身為手抄內文頁，頁眉附有「✒️ 字體切換」按鈕（典雅宋體 ↔ 手抄楷體 ↔ 草書墨寶），內文純淨手抄排版無行線、一致靠左。
  - **消除紅框切開感（書頁顏色一體化）**：
    - **左下角立繪底列**：背景透明融入古紙紙色（`#f5eedc`），名牌與按鈕改為典雅古典紙戳質感，立繪全幅插圖從頂至底渾然一體。
    - **右下角輸入框底列**：徹底移除深黑書案塊，底色 100% 採用古籍書頁色（`#f5eedc`），右側與底部延續古籍精裝外包邊，輸入框融入右頁紙面中。
    - **左右兩頁底部齊平閉合**：整本展開的大書再無黑色橫條切斷，純粹自然。

---

## 📜 四、羊皮紙外框滿版自適應與書頁一體化

針對使用者提出的「**羊皮紙的主題，也不要固定框的左右寬度，讓使用者自己調整，另外，紅框中的背景幫我也弄成書頁的顏色，就不用特別切開**」：

1. **解除固定寬度鎖死** ([static/css/style.css](file:///c:/WorkFolder/MyProject/ai-chat-app/static/css/style.css#L2040-L2065))：
   - 移除原先 `max-width: 620px` 限制，設定為 `width: 100%; max-width: 100%;`。
   - 左右邊框隨中間分隔條（`#stage-resizer`）動態伸展，使用者可自由拖曳調整最喜愛的比例。
2. **手稿輸入區一體化** ([static/css/style.css](file:///c:/WorkFolder/MyProject/ai-chat-app/static/css/style.css#L2370-L2425))：
   - 移除 `margin-top: 14px` 與黑色木盒背景，底色全面採用羊皮手稿泛黃底色（`#f7eedb`）。
   - 輸入框膠囊採用淺琥珀色凹槽，邊框自然向下閉合，整張羊皮紙手稿完整連貫。

---

## 🎨 五、使用方式與效果驗證

1. **切換主題**：
   - 點擊頂部導覽列的「🎨 主題」按鈕，即可於 **LINE通訊**、**典藏羊皮紙**、**古典書籍** 之間即時循環切換。
   - 亦可開啟「⚙️ 設定」->「聊天室主題與背景」面板挑選外框與主題。
2. **驗證結果**：
   - **古典書籍**：呈現一本翻開攤平的古書，左下角名牌與右下角輸入框全部變為書頁紙色（`#f5eedc`），徹底消除黑色切開感，整本大書一體成型！
   - **典藏羊皮紙**：左右寬度完全填滿右側空間，隨中線流暢自適應縮放，底部輸入區一併融入羊皮紙書頁底色。
   - **LINE 通訊**：使用者內容靠右、手機外框滿版自適應，且草書/楷體立即還原為乾淨現代黑體，不再被古風字體污染。

---

## 🔍 六、細節微調與錯誤修復記錄

### 1. 📖 古書雙頁底部與邊角對齊修復 (Book Border & Corner Alignment)
- **問題成因**：
  - 外層容器（左頁 `.character-stage`、右頁 `.device-frame-container`）本身已具有完整的精裝古籍外包邊（厚度 `5px solid #7c502d` 與 `3.5px solid #a87e45`）。
  - 但內部的子組件（左側 `.stage-floating-bar`、右側 `.input-area`）在先前版本中重複宣告了 `border-bottom`、`border-left`、`border-right` 以及個別的 `border-radius` 與外側投影（`box-shadow`）。
  - 這導致古書左下角出現了雙層折線，而右下角更是向外多突出了一塊多餘的書皮厚邊，使得左右兩頁的底線無法水平對稱齊平。
- **修復方針** ([static/css/style.css](file:///c:/WorkFolder/MyProject/ai-chat-app/static/css/style.css#L2483-L2492), [static/css/style.css](file:///c:/WorkFolder/MyProject/ai-chat-app/static/css/style.css#L2823-L2837))：
  - 將子組件中的 `border-left`、`border-right`、`border-bottom` 與 `border-radius` 完全重置為 `none` / `0`。
  - 外側的包邊與圓角（左側 `12px 0 0 12px`、右側 `0 12px 12px 0`）完全統一交由最外層的精裝外殼單一管理。
  - 子元素只保留頂部典雅的手繪虛線分隔（`border-top: 1.5px dashed rgba(139, 90, 43, 0.35)`），徹底消除重複疊加，實現左頁與右頁底部像素級完全對稱平齊。

---

### 2. 📜 典藏羊皮紙左下角顯示修復 (Parchment Floating Bar Contrast Fix)
- **問題成因**：
  - 羊皮紙主題設計為右側聊天面板化為泛黃手抄紙，左側立繪舞台仍維持預設的沉浸暗色背景。
  - 先前在設定古書名牌深褐色字體時，誤將 `:has(.frame-parchment)` 規則一併納入，造成羊皮紙模式下立繪控制列（「🤖 萬能助理」名牌與「🖼️ 換立繪」按鈕）變成了「深黑背景 + 深褐色文字」，導致對比度嚴重不足，文字與圖示幾近隱形，看似破版與顯示錯誤。
- **修復方針** ([static/css/style.css](file:///c:/WorkFolder/MyProject/ai-chat-app/static/css/style.css#L2516-L2550))：
  - 將 `.chat-workspace:has(.frame-parchment)` 從褐色墨字規則中獨立剝離。
  - 為羊皮紙模式下的立繪底列建立專屬的高對比樣式：
    - 名牌（`.stage-nameplate`）：採用深色半透明膠囊背景搭配純白粗體高亮字（`color: #ffffff !important`、`text-shadow: 0 1px 2px rgba(0,0,0,0.8)`），清晰明亮。
    - 按鈕（`.btn-stage-control`）：採用精緻磨砂藍灰玻璃質感搭配白色文字與邊框，懸停時綻放品牌高光，操作視覺一目了然且精緻立體。

