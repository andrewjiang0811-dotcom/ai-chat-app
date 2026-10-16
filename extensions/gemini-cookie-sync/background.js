// Gemini Cookie Auto-Sync Background Worker
const TARGET_COOKIES = ["__Secure-1PSID", "__Secure-1PSIDTS", "__Secure-1PSIDCC"];
const SYNC_URL = "http://127.0.0.1:8000/api/config/cookies/sync";

let syncDebounceTimer = null;

async function getGeminiCookies() {
  const cookies = await chrome.cookies.getAll({ domain: "google.com" });
  const result = {};
  
  for (const c of cookies) {
    if (TARGET_COOKIES.includes(c.name)) {
      result[c.name] = c.value;
    }
  }
  return result;
}

async function syncCookiesToApp(triggerSource = "auto") {
  try {
    const cookies = await getGeminiCookies();
    if (!cookies["__Secure-1PSID"]) {
      console.log("[Gemini Sync] 未找到登入中的 __Secure-1PSID Cookie。");
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#eab308" });
      return { success: false, message: "尚未在瀏覽器中登入 Google/Gemini 帳號" };
    }

    const payload = {
      secure_1psid: cookies["__Secure-1PSID"] || "",
      secure_1psidts: cookies["__Secure-1PSIDTS"] || "",
      secure_1psidcc: cookies["__Secure-1PSIDCC"] || "",
      source: triggerSource
    };

    const res = await fetch(SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      console.log("[Gemini Sync] 同步成功：", data);
      chrome.action.setBadgeText({ text: "✓" });
      chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
      return { success: true, data };
    } else {
      const err = await res.text();
      console.warn("[Gemini Sync] 本地伺服器回傳錯誤：", err);
      chrome.action.setBadgeText({ text: "ERR" });
      chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
      return { success: false, message: `伺服器回應錯誤: ${res.status}` };
    }
  } catch (err) {
    console.warn("[Gemini Sync] 連線本機伺服器失敗（伺服器可能未啟動）：", err);
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#6b7280" });
    return { success: false, message: "無法連線至本機伺服器 (http://127.0.0.1:8000)" };
  }
}

// 監聽分頁變化：若使用者開啟或刷新了 gemini.google.com
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && tab.url.includes("gemini.google.com")) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      syncCookiesToApp("tab_updated");
    }, 2000);
  }
});

// 監聽 Cookie 變更：若 Google 刷新了 1PSIDTS
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cookie.domain.includes("google.com") && TARGET_COOKIES.includes(changeInfo.cookie.name)) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      syncCookiesToApp("cookie_changed");
    }, 3000);
  }
});

// 接收來自 popup.js 的請求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_status") {
    getGeminiCookies().then(cookies => {
      sendResponse({ cookies });
    });
    return true;
  } else if (request.action === "sync_now") {
    syncCookiesToApp("manual_popup").then(res => {
      sendResponse(res);
    });
    return true;
  }
});
