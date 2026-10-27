const $ = (id) => document.getElementById(id);
const log = $("log"), input = $("input");
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");


const history = []; // Vikram's memory. Betal's lines never go in here.
let busy = false, lastT = 0;

/* ---------- rendering ---------- */
function md(s) {
  const keep = [];
  const hold = (h) => `\u0000${keep.push(h) - 1}\u0000`;
  s = s.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, c) => hold(`<pre><code>${esc(c)}</code></pre>`));
  s = s.replace(/\[\[open:(https?:\/\/[^\]\s]+)\]\]/g, (_, u) => {
    let host = u; try { host = new URL(u).hostname; } catch {}
    return hold(`<button class="open" data-url="${esc(u)}">Open ${esc(host)}</button>`);
  });
  let h = esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  return h.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[i]);
}
function add(cls, html) {
  log.querySelector(".empty")?.remove();
  const el = document.createElement("div");
  el.className = cls === "note" ? "note" : `msg ${cls}`;
  el.innerHTML = html;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}
log.addEventListener("click", (e) => {
  const b = e.target.closest(".open");
  if (b) chrome.tabs.create({ url: b.dataset.url });
});

/* ---------- Claude API (streaming) ---------- */
/* ---------- chat ---------- */
async function ask(userText, shown) {
  if (busy) return add("note", "Vikram is still answering. Give him a moment.");
  if (!cfg.apiKey) return $("settings").showModal();
  busy = true;
  add("user", esc(shown ?? userText));
  history.push({ role: "user", content: userText });
  const el = add("vikram", "…");
  try {
    const full = await stream({
      model: cfg.model, system: VIKRAM, messages: history.slice(-20),
      onText: (t) => { el.innerHTML = md(t); log.scrollTop = log.scrollHeight; },
    });
    if (!full.trim()) {
      history.pop();
      el.innerHTML = "Vikram came back empty. The model may have used its whole budget thinking. Try another model in Settings.";
      return;
    }
    history.push({ role: "assistant", content: full });
    if (cfg.betal) heckle(userText, full);
  } catch (e) {
    history.pop();
    el.innerHTML = e.name === "AbortError" ? "Timed out after 60 seconds. Try again." : "Couldn't reach the API: " + esc(e.message);
  } finally { busy = false; }
}

async function heckle(q, a) {
  const el = add("betal", "…");
  const line = await heckleLine(q, a);
  if (line) el.textContent = line; else el.remove();
}

/* ---------- actions ---------- */
const run = ({ mode, text }) =>
  ask(PROMPTS[mode](text), `${mode}: “${text.slice(0, 140)}${text.length > 140 ? "…" : ""}”`);

const activeTab = async () =>
  (await chrome.tabs.query({ active: true, currentWindow: true }))[0] ||
  (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
const fromPage = async (type) => {
  const tab = await activeTab();
  if (!tab?.id) return null;
  const func = type === "getPage"
    ? () => ({ title: document.title, url: location.href, text: document.body.innerText.slice(0, 15000) })
    : () => ({ text: String(getSelection()) });
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func });
    return r?.result ?? null;
  } catch { return null; } // chrome:// pages, the Web Store, PDFs
};

async function decodeQR(dataUrl) {
  const img = await createImageBitmap(await (await fetch(dataUrl)).blob());
  if ("BarcodeDetector" in window) {
    try {
      const found = await new BarcodeDetector({ formats: ["qr_code"] }).detect(img);
      if (found.length) return found.map((f) => f.rawValue);
    } catch {}
  }
  if (window.jsQR) {
    const c = new OffscreenCanvas(img.width, img.height), x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height);
    const q = jsQR(d.data, d.width, d.height);
    if (q) return [q.data];
  }
  return [];
}

const actions = {
  async page() {
    const p = await fromPage("getPage");
    if (!p) return add("note", "Can't read this page. Try a normal website tab.");
    ask(`Summarize this page in a few bullets.\nTitle: ${p.title}\nURL: ${p.url}\n\n${p.text}`, `Summarize page: ${p.title}`);
  },
  async sel() {
    const s = await fromPage("getSelection");
    if (!s?.text.trim()) return add("note", "Nothing is highlighted on the page.");
    run({ mode: "ask", text: s.text.trim() });
  },
  async qr() {
    const res = await chrome.runtime.sendMessage({ type: "capture" });
    if (!res?.dataUrl) return add("note", "Couldn't capture this tab. Try a normal website tab.");
    const codes = await decodeQR(res.dataUrl);
    if (!codes.length) {
      return add("note", "No QR code found in view. Bring it fully on screen. On Windows/Linux, add lib/jsQR.js (see README).");
    }
    for (const c of codes) {
      add("note", `QR found: ${esc(c)}` + (/^https?:\/\//.test(c) ? `<br><button class="open" data-url="${esc(c)}">Open link</button>` : ""));
      ask(`I scanned a QR code. Its content is:\n${c}\n\nTell me what it is and whether it looks safe. Don't open anything unless I ask.`, "Check this QR code");
    }
  },
  clear() { history.length = 0; log.innerHTML = '<div class="empty">Fresh start.</div>'; },
};
document.querySelector(".chips").addEventListener("click", async (e) => {
  const a = e.target.closest("button")?.dataset.act;
  if (!a) return;
  try { await actions[a](); }
  catch (err) { add("note", "Something broke: " + esc(String(err.message || err))); }
});

/* ---------- handoff from page selection / context menu ---------- */
let ready;
async function takePending() {
  await ready;
  const { pending } = await chrome.storage.session.get("pending");
  if (!pending || pending.t === lastT) return;
  lastT = pending.t;
  await chrome.storage.session.remove("pending");
  run(pending);
}
chrome.storage.onChanged.addListener((c, area) => { if (area === "session" && c.pending?.newValue) takePending(); });

/* ---------- input + settings ---------- */
$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = input.value.trim();
  if (!t) return;
  input.value = ""; input.style.height = "auto";
  ask(t);
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("form").requestSubmit(); }
});
input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = input.scrollHeight + "px"; });

$("provider").onchange = () => {
  const p = PRESETS[$("provider").value];
  $("model").value = p.model; $("betalModel").value = p.betalModel;
};
$("gear").onclick = () => {
  $("provider").value = cfg.provider; $("apiKey").value = cfg.apiKey;
  $("model").value = cfg.model; $("betalModel").value = cfg.betalModel; $("betal").checked = cfg.betal;
  $("settings").showModal();
};
$("cancel").onclick = () => $("settings").close();
$("save").onclick = async () => {
  cfg = { provider: $("provider").value, apiKey: $("apiKey").value.trim(),
          model: $("model").value.trim(), betalModel: $("betalModel").value.trim(), betal: $("betal").checked };
  await chrome.storage.local.set(cfg);
  $("settings").close();
};

ready = (async () => {
  await loadCfg();
  if (!cfg.apiKey) $("gear").click();
  takePending();
})();
