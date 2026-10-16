# 聊天視窗助理大頭像與角色名牌動態同步更新說明

本文件記錄聊天視窗中 AI 助理大頭像（`.msg-avatar`）與發言人名稱（`.speaker-name`）隨對話角色（Persona）即時動態同步之技術修復細節。

---

## 一、 問題現象與成因分析

### 1. 問題現象
使用者在介面切換對話角色（例如由「萬能助理 🤖」切換至「傲嬌貓娘 🐱」或「代碼工程師 💻」）時，左側立繪與頂部導航列雖已更新，但右側聊天視窗中已有的 AI 助理訊息氣泡，其圓形大頭像依然固定為 `🤖`，發言人名牌亦仍顯示為「萬能助理」，未跟隨最新選定的角色同步更新。

### 2. 成因診斷
1. **缺少即時響應式遍歷**：
   原先 `setPersona(personaId)` 函式僅更新了頂部導航列、左側立繪舞台與設定彈窗中的元素，並未遍歷已存在於 DOM 中的 `.message-row.assistant` 訊息元素。
2. **歷史訊息載入時參數缺失**：
   在 `switchSession(sessionId)` 載入訊息歷史紀錄時，呼叫 `appendMessageBubble(msg.role, msg.content)` 未傳遞當前角色的頭像與名稱參數。
3. **Fallback 硬編碼缺陷**：
   在 `appendMessageBubble` 中原本使用了 `(customAvatar || "🤖")`，只要未明確指定自訂頭像，便會一律退回機器人符號，無法動態繼承當前角色的專屬 Emoji 或頭像圖檔。
4. **Session 角色關聯未持久化**：
   在同一個對話中切換角色時，未向伺服器發送 `PATCH /api/sessions/{session_id}`，導致重新整理頁面後角色被還原為對話建立初期的舊角色。

---

## 二、 解決方案與程式碼實作

### 1. 新增角色頭像渲染輔助函式 (`getPersonaAvatarHtml`)
動態偵測角色之 `avatar` 屬性，若為圖片路徑則渲染圓形頭貼 `<img>`，若為 Emoji 或文字則安全輸出：

```javascript
function getPersonaAvatarHtml(persona, role = "assistant") {
  if (role === "user") return "👤";
  if (!persona) return "🤖";
  if (persona.avatar && (persona.avatar.startsWith("/") || persona.avatar.startsWith("http"))) {
    return `<img src="${persona.avatar}" alt="${escapeHtml(persona.name)}" class="avatar-img">`;
  }
  return persona.avatar || "🤖";
}
```

---

### 2. 即時動態同步聊天視窗訊息 (`updateChatAssistantAvatars`)
在 `setPersona` 中注入聊天室訊息全量即時更新邏輯：

```javascript
function updateChatAssistantAvatars(persona) {
  if (!persona) return;
  const avatarHtml = getPersonaAvatarHtml(persona, "assistant");
  const assistantRows = document.querySelectorAll(".message-row.assistant");
  assistantRows.forEach(row => {
    const avatarEl = row.querySelector(".msg-avatar");
    const nameEl = row.querySelector(".speaker-name");
    if (avatarEl) {
      avatarEl.innerHTML = avatarHtml;
    }
    if (nameEl) {
      nameEl.textContent = persona.name;
    }
  });
}
```

---

### 3. 持久化同步 Session 之 `character_id`
當使用者在當前進行中的對話切換角色時，非同步呼叫後端 API 儲存至 SQLite 資料庫，確保重整後維持該角色：

```javascript
function setPersona(personaId, syncSession = true) {
  // ... 更新 Navbar、立繪舞台與相關標籤 ...

  // 1. 即時同步更新聊天面板中所有 AI 助理訊息的大頭像與角色名稱
  updateChatAssistantAvatars(p);

  // 2. 同步更新當前 Session 的 character_id 到伺服器資料庫
  if (syncSession && state.currentSessionId) {
    fetch(`/api/sessions/${state.currentSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_id: personaId })
    }).catch(err => console.warn("Failed to sync session persona:", err));
  }

  renderCharacterSprite(p);
}
```

---

### 4. 歷史訊息載入與 Fallback 邏輯優化
* 在 `switchSession` 遍歷 `data.messages` 時，依據當前 Session 所屬角色的專屬頭像與名稱產生氣泡。
* 在 `appendMessageBubble` 內，將 fallback 機制修復為 `customAvatar || getPersonaAvatarHtml(p, role)`。
* 頂部導航列之 `active-persona-badge` 加入點擊監聽器，支援點擊直接循環輪替下一個對話角色。

---

## 三、 驗證結果

透過端到端瀏覽器測試確認：
1. **萬能助理 🤖** ↔ **傲嬌貓娘 🐱** ↔ **代碼工程師 💻** ↔ **遊戲設計顧問 ⚔️** 之間任意切換，聊天面板中所有助理訊息之圓形大頭像與名牌皆**零延遲即時同步切換**。
2. 重新整理頁面或切換歷史對話紀錄時，訊息頭像與名牌皆維持該對話綁定之角色屬性，不再退化回預設機器人。
