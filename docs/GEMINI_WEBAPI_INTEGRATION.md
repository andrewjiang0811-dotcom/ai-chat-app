# Google Gemini WebAPI (免 API Key 網頁版 Cookie) 串接說明文件

本文件詳細說明本專案整合 **[gemini-webapi](https://pypi.org/project/gemini-webapi/)**（v2.1.1+）的實作架構、Cookie 取得教學、前後端串流機制以及常見問題排查指南。

---

## 🌟 一、功能核心特色

1. **零成本免 API Key**：
   - 無需申請 Google AI Studio 付費或信用卡綁定帳號，直接使用個人的 Google 帳號網頁版 Session Cookie（`__Secure-1PSID` 與 `__Secure-1PSIDTS`）進行模型串接。
2. **完整支援 Gemini 最新模型族群**：
   - 預設提供 `gemini-flash`（極速回應）、`gemini-pro`（深度理解）、`gemini-flash-lite`；若帳號具有進階訂閱亦支援 `gemini-pro-advanced`。
3. **真串流輸出與深度思維鏈 (Thinking Stream)**：
   - 原生支援 `generate_content_stream` 異步生成器，即時接收 `text_delta` 文字增量。
   - 自動解析 `thoughts_delta` 思考過程，在對話視窗中以 `> 💭 深度思考過程` 摺疊呈現。
4. **一鍵連線診斷與延遲測試**：
   - 系統設定中提供「⚡ 測試連線」按鈕，毫秒級測速並驗證 Cookie 是否有效，自動探測可用模型清單。
5. **代理伺服器 (Proxy) 支援**：
   - 針對特定無法直接存取 Google Gemini 網頁服務的網路環境，內建自訂 Proxy 代理輸入。

---

## 🔑 二、如何獲取 Google Gemini Cookie

請依下列步驟從瀏覽器取得驗證 Cookie：

1. 開啟瀏覽器並登入 [Google Gemini 官網 (https://gemini.google.com)](https://gemini.google.com)。
2. 在網頁任意處點擊右鍵選「**檢查**」，或按鍵盤快捷鍵 `F12`（Mac 請按 `Cmd + Option + I`）開啟開發者工具。
3. 切換至頂部標籤頁：
   - Chrome / Edge：**Application**（應用程式）
   - Firefox：**Storage**（儲存空間）
4. 在左側欄展開 **Cookies**，點擊 `https://gemini.google.com`。
5. 在 Cookie 清單中找到並複製以下鍵的值（Value）：
   - **`__Secure-1PSID`**（必填）：長字串，為主要的身份驗證權杖。
   - **`__Secure-1PSIDTS`**（強烈建議填寫）：時間戳簽章，大幅提升 Session 的穩定度。
   - **`__Secure-1PSIDCC`**（選填）：客戶端驗證簽章，強化連線壽命與防掉線保護。
6. 回到本應用程式，點擊右上角「**⚙️ 模型與語音設定**」→「**模型來源**」切換為「**🌐 Google Gemini 網頁版**」，將值分別貼入對應輸入框並點擊「**儲存設定**」。

---

## 🏗️ 三、技術實作架構解析

### 1. 套件依賴管理 ([requirements.txt](file:///c:/WorkFolder/MyProject/ai-chat-app/requirements.txt))
新增套件依賴項：
```text
gemini-webapi>=2.1.1
```

### 2. 模型調用與串流生成核心 ([core/llm_provider.py](file:///c:/WorkFolder/MyProject/ai-chat-app/core/llm_provider.py))
- **非同步客戶端初始化與驗證**：
  ```python
  client = GeminiClient(
      secure_1psid=secure_1psid.strip(),
      secure_1psidts=secure_1psidts.strip() if secure_1psidts else None,
      proxy=proxy.strip() if proxy else None
  )
  if secure_1psidcc:
      client._cookies.set("__Secure-1PSIDCC", secure_1psidcc.strip(), domain=".google.com", secure=True)
  await client.init()
  ```
- **狀態碼診斷與錯誤處理**：
  - `AccountStatus.AVAILABLE (1000)`：認證通過。
  - `AccountStatus.UNAUTHENTICATED (1016)`：Cookie 失效或未授權，主動提醒重新複製。
  - `AccountStatus.LOCATION_REJECTED (1060)`：地區限制，主動提醒設定 Proxy。
- **上下文組裝與串流回傳 (`stream_gemini_webapi`)**：
  - 將角色的世界觀與提示詞 (`system_prompt`) 格式化注入對話情境中。
  - 透過 `client.generate_content_stream()` 逐塊接收：
    - `chunk.thoughts_delta`：以 Markdown 引言區塊即時印出思考推論。
    - `chunk.text_delta`：即時透過 SSE 串流推送至前端氣泡。

### 3. API 路由與設定持久化 ([server.py](file:///c:/WorkFolder/MyProject/ai-chat-app/server.py))
- 支援在 `data/config.json` 中保存 `gemini_web_secure_1psid`、`gemini_web_secure_1psidts` 與 `gemini_web_proxy`。
- `/api/models/test` 支援傳遞 Cookie 進行即時診斷並回傳可用模型。
- `/api/sessions/{session_id}/chat` SSE 串流統一分發至 `stream_gemini_webapi`。

### 4. 前端介面與互動 ([static/index.html](file:///c:/WorkFolder/MyProject/ai-chat-app/static/index.html) & [static/js/app.js](file:///c:/WorkFolder/MyProject/ai-chat-app/static/js/app.js))
- 設定視窗下拉選單新增「**🌐 Google Gemini 網頁版 (免 API Key，Cookie 串接)**」。
- 動態顯示專屬的密碼欄位與詳細圖文引導提示。
- 「測試連線並取得模型列表」按鈕支援即時連動，測試成功自動填充標籤膠囊（`gemini-flash`、`gemini-pro` 等）。

---

## 🛠️ 四、常見問題與排查 (FAQ)

### Q1: 測試連線顯示「Cookie 無效或已過期」？
- **原因**：Google 的 `__Secure-1PSIDTS` 會隨網頁操作動態滾動刷新，若舊的 Session 已在瀏覽器登出便會失效。
- **解法**：重新至 `gemini.google.com` 重新整理頁面，再次按 F12 複製最新的 `__Secure-1PSID` 與 `__Secure-1PSIDTS`。

### Q2: 出現「所在地區存取受限 (代碼: 1060)」？
- **原因**：目前連線的 IP 位址不在 Google Gemini 支援的地區名單內。
- **解法**：在設定面板的「**Proxy 代理伺服器**」中填入可用的 HTTP/SOCKS 代理（例如 `http://127.0.0.1:7890`）。

### Q3: 網頁版會消耗 Google Cloud 額度嗎？
- **不會**。此整合完全模擬 Google Gemini Web 官方網頁操作，完全不走 Google Cloud 或 AI Studio 計費管道。
