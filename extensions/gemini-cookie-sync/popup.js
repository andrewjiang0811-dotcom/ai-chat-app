// popup.js logic
document.addEventListener("DOMContentLoaded", () => {
  const badgePsid = document.getElementById("badge-psid");
  const badgePsidts = document.getElementById("badge-psidts");
  const badgePsidcc = document.getElementById("badge-psidcc");
  const btnSync = document.getElementById("btn-sync");
  const msgBox = document.getElementById("msg-box");
  const linkGemini = document.getElementById("link-gemini");
  const linkApp = document.getElementById("link-app");

  function showMsg(text, isError = false) {
    msgBox.style.display = "block";
    msgBox.className = `message-box ${isError ? "msg-error" : "msg-success"}`;
    msgBox.textContent = text;
  }

  function updateStatus() {
    chrome.runtime.sendMessage({ action: "get_status" }, (res) => {
      if (!res || !res.cookies) return;
      const c = res.cookies;

      if (c["__Secure-1PSID"]) {
        badgePsid.textContent = "已就緒";
        badgePsid.className = "badge badge-ok";
      } else {
        badgePsid.textContent = "未找到";
        badgePsid.className = "badge badge-missing";
      }

      if (c["__Secure-1PSIDTS"]) {
        badgePsidts.textContent = "已就緒";
        badgePsidts.className = "badge badge-ok";
      } else {
        badgePsidts.textContent = "未找到";
        badgePsidts.className = "badge badge-missing";
      }

      if (c["__Secure-1PSIDCC"]) {
        badgePsidcc.textContent = "已就緒";
        badgePsidcc.className = "badge badge-ok";
      } else {
        badgePsidcc.textContent = "選填 (可無)";
        badgePsidcc.className = "badge badge-ok";
      }
    });
  }

  updateStatus();

  btnSync.addEventListener("click", () => {
    btnSync.disabled = true;
    btnSync.innerHTML = "<span>⏳</span><span>同步中...</span>";
    msgBox.style.display = "none";

    chrome.runtime.sendMessage({ action: "sync_now" }, (res) => {
      btnSync.disabled = false;
      btnSync.innerHTML = "<span>⚡</span><span>立即同步到本機 AI 助手</span>";

      if (res && res.success) {
        showMsg("🎉 Cookie 同步成功！後端連線驗證通過。");
        updateStatus();
      } else {
        showMsg(res?.message || "同步失敗，請確認本地後端伺服器 (127.0.0.1:8000) 是否啟動。", true);
      }
    });
  });

  linkGemini.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "https://gemini.google.com" });
  });

  linkApp.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "http://127.0.0.1:8000" });
  });
});
