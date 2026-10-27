importScripts('llm.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.contextMenus.create({
    id: "ask-vikram",
    title: "Ask Vikram about “%s”",
    contexts: ["selection"],
  });
});

function handoff(tabId, payload) {
  // open() must run inside the user gesture, so call it before anything async.
  const opened = chrome.sidePanel.open({ tabId });
  chrome.storage.session.set({ pending: { ...payload, t: Date.now() } });
  opened.catch(() => {
    // Gesture lost: leave a badge; clicking the icon opens the panel and picks up the request.
    chrome.action.setBadgeText({ text: "1" });
    chrome.action.setBadgeBackgroundColor({ color: "#d8a94a" });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ask-vikram") {
    handoff(tab.id, { mode: "ask", text: info.selectionText });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === "selection" && sender.tab) {
    handoff(sender.tab.id, { mode: msg.mode, text: msg.text });
  }
  if (msg.type === "capture") {
    chrome.tabs.captureVisibleTab({ format: "png" }).then(
      (dataUrl) => reply({ dataUrl }),
      (err) => reply({ error: String(err) })
    );
    return true; // async reply
  }
});

// Inline popup on the page: the content script opens a port and gets Vikram's answer, then Betal's line.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "vb") return;
  let open = true;
  port.onDisconnect.addListener(() => (open = false));
  const send = (m) => { if (open) try { port.postMessage(m); } catch {} };

  port.onMessage.addListener(async ({ mode, text }) => {
    await loadCfg();
    if (!cfg.apiKey) return send({ t: "error", text: "No API key yet. Click the Vikram & Betal icon in the toolbar, open Settings and paste your key." });
    const q = PROMPTS[mode](text);
    let full = "";
    try {
      full = await stream({
        model: cfg.model,
        system: VIKRAM + " Your answer appears in a small popup on the page, so keep it under about 120 words.",
        messages: [{ role: "user", content: q }],
        onText: (t) => send({ t: "chunk", text: t }),
      });
    } catch (e) {
      return send({ t: "error", text: e.name === "AbortError" ? "Timed out. Try again." : "Couldn't reach the API: " + e.message });
    }
    if (!full.trim()) return send({ t: "error", text: "Vikram came back empty. Try another model in Settings." });
    send({ t: "done" });
    if (cfg.betal) {
      const line = await heckleLine(q, full);
      if (line) send({ t: "betal", text: line });
    }
  });
});
