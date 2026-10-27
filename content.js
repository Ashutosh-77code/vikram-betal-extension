(() => {
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    *{box-sizing:border-box}
    .bar{position:absolute;display:flex;gap:2px;padding:4px;background:#1a1d2b;border:1px solid #d8a94a;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.35)}
    .bar button{all:unset;cursor:pointer;padding:6px 10px;border-radius:5px;font:600 12px/1 system-ui,sans-serif;color:#f0e6d0}
    .bar button:hover{background:#d8a94a;color:#1a1d2b}
    .card{position:absolute;width:360px;max-width:calc(100vw - 16px);background:#14161f;color:#ece6d8;border:1px solid #d8a94a;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.45);font:14px/1.5 system-ui,sans-serif}
    .head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #2b3046}
    .head b{font:700 15px Georgia,serif;color:#d8a94a}
    .head span{color:#9aa0b8;font-size:12px;margin-left:8px}
    .x,.copy{all:unset;cursor:pointer;color:#9aa0b8;font:600 12px system-ui}
    .x{font-size:18px;line-height:1;padding:0 4px}.x:hover,.copy:hover{color:#d8a94a}
    .body{padding:10px 12px;max-height:300px;overflow-y:auto;white-space:pre-wrap;word-wrap:break-word;font-family:Georgia,serif;font-size:14.5px}
    .body.err{color:#ff9d8a;font-family:system-ui;font-size:13px}
    .body code{background:#0f111a;padding:1px 4px;border-radius:3px;font-size:.9em}
    .foot{display:flex;justify-content:flex-end;padding:0 12px 8px}
    .betal{margin:0 12px 12px;padding:6px 10px;background:#23264a;color:#c9c3ea;border:1px dashed #50558c;border-radius:8px;font-style:italic;font-size:13px}
  </style>`;
  const sp = (el, ...a) => el.append(...a);
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lite = (t) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/^\* /gm, "• ");

  let bar = null, card = null, port = null;
  const clear = () => { bar?.remove(); card?.remove(); bar = card = null; try { port?.disconnect(); } catch {} port = null; };
  const place = (el, r, below) => {
    const left = Math.min(Math.max(8, window.scrollX + r.left), window.scrollX + document.documentElement.clientWidth - 372);
    el.style.left = left + "px";
    el.style.top = (below ? window.scrollY + r.bottom + 8 : Math.max(window.scrollY + 4, window.scrollY + r.top - 44)) + "px";
  };

  function showCard(mode, text, r) {
    bar?.remove(); bar = null;
    card = mk("div", "card");
    const head = mk("div", "head"), title = mk("div"), x = mk("button", "x", "×");
    sp(title, mk("b", "", "Vikram"), mk("span", "", mode));
    x.onclick = clear; sp(head, title, x);
    const body = mk("div", "body", "Thinking…");
    const foot = mk("div", "foot"), copy = mk("button", "copy", "Copy");
    copy.onclick = () => { navigator.clipboard?.writeText(body.textContent); copy.textContent = "Copied"; };
    sp(foot, copy);
    sp(card, head, body, foot);
    place(card, r, true);
    root.appendChild(card);

    try {
      port = chrome.runtime.connect({ name: "vb" });
      port.onMessage.addListener((m) => {
        if (m.t === "chunk") body.innerHTML = lite(m.text);
        else if (m.t === "error") { body.className = "body err"; body.textContent = m.text; }
        else if (m.t === "betal") card.insertBefore(mk("div", "betal", m.text), foot);
      });
      port.postMessage({ mode, text });
    } catch {
      body.className = "body err";
      body.textContent = "The extension was updated. Reload this page and try again.";
    }
  }

  function showBar(text, r) {
    clear();
    bar = mk("div", "bar");
    [["ask", "Ask Vikram"], ["explain", "Explain"], ["translate", "Translate"], ["summarize", "Summarize"]].forEach(([mode, label]) => {
      const b = mk("button", "", label);
      b.onclick = () => showCard(mode, text, r);
      sp(bar, b);
    });
    bar.addEventListener("mousedown", (e) => e.preventDefault());
    place(bar, r, false);
    root.appendChild(bar);
    if (!host.isConnected) document.documentElement.appendChild(host);
  }

  document.addEventListener("mouseup", (e) => {
    if (e.composedPath().includes(host)) return;
    setTimeout(() => {
      const sel = getSelection();
      const text = sel.toString().trim();
      if (text.length < 2 || !sel.rangeCount) return;
      showBar(text.slice(0, 6000), sel.getRangeAt(0).getBoundingClientRect());
    }, 10);
  });
  document.addEventListener("mousedown", (e) => { if (!e.composedPath().includes(host)) clear(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") clear(); });
})();
