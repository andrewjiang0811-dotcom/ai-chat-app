# 立繪互動對話框版面與貼邊優化 (Touch Reaction Bubble Layout)

## 1. 需求與優化目標 (Overview)
當使用者在立繪舞台上點擊角色觸碰感應熱區（例如頭部、臉頰、胸口、裙擺等）時，畫面會彈出角色即時台詞互動對話框（`.sprite-reaction-bubble`）。
原版設計將對話框固定於立繪上方中央小區塊（`top: 22px; max-width: min(92%, 460px)`），當台詞較長或舞台寬度不同時，容易在正中間折行壓縮，且與上邊框距離較遠。

依使用者需求，本次進行以下版面配置優化：
1. **貼近上邊框**：將垂直位置上移至接近容器頂端，釋放下方立繪視野。
2. **寬度貼近左右邊框**：讓對話框橫跨整片立繪舞台寬度，呈現如視覺小說全幅對話橫幅（Full-width Dialogue Banner）的視覺效果。

---

## 2. 具體修改內容 (CSS Changes)

修改檔案：`static/css/style.css`（定位於 `.sprite-reaction-bubble` 區段）

```css
/* Floating Reaction Bubble: 貼近立繪區域上邊框與兩側邊框，寬幅展開呈現 */
.sprite-reaction-bubble {
  position: absolute;
  top: 8px;           /* 從 22px 改為 8px，緊貼上邊框 */
  bottom: auto;
  left: 8px;          /* 左右貼邊，留 8px 安全呼吸邊距 */
  right: 8px;
  width: auto;        /* 自動伸展填滿左右邊距 */
  max-width: none;    /* 解除 460px 限制 */
  background: rgba(15, 23, 42, 0.95);
  border: 1.5px solid rgba(244, 114, 182, 0.7);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(244, 114, 182, 0.35);
  border-radius: 14px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 35;
  pointer-events: auto;
  cursor: pointer;
  box-sizing: border-box;
  backdrop-filter: blur(12px);
  animation: reactionPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  transition: opacity 0.2s, transform 0.2s;
}

/* 彈出微動畫：配合 full-width 調整 translateY，移除水平位移 */
@keyframes reactionPop {
  0% { opacity: 0; transform: translateY(-8px) scale(0.98); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
```

---

## 3. 效益與特色 (Benefits)
1. **閱讀體驗大幅提升**：全幅寬度讓台詞文字（如「（臉頰泛起微紅）等等...別突然戳人家的臉啦///」）一氣呵成，文字不再過度折行。
2. **立繪頭頂空間最大化**：向上貼緊邊框（`top: 8px`）能避免對話框直接壓在角色雙馬尾或頭頂髮飾上，人物神態一覽無遺。
3. **保持中央指示小指針**：對話框底部的對話小箭頭（`::after`）依舊保持水平置中，指向中央立繪頭部，保留說話者所屬感。
