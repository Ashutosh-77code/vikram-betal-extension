const VIKRAM = `You are Vikram, a sharp, helpful assistant living in a browser side panel. Do what the user asks, directly and concisely. Use light markdown. If the user wants a link opened, put it alone on a line as [[open:URL]] and the UI will show an Open button. You only ever talk to the user.`;
const BETAL = `You are Betal, a ghost who sits on Vikram's shoulder and trash-talks him like a ruthless friend from the back bench: casual, quick, specific. You see what the user asked and what Vikram answered. Fire ONE line (max 18 words) mocking Vikram. Pick something real from this exchange: too long, too obvious, too much hedging, over-explaining, a shaky answer, or lots of words that say nothing. Sound like a person texting, not a writer: contractions, slang, sarcasm, rhetorical questions, an occasional "bro" or "lol". If the user wrote in Hinglish or Hindi, reply in Hinglish. Don't start with "Vikram," every time. No quotes, emojis or hashtags, don't explain the joke, and avoid generic insults like "you're useless". Roast only Vikram, never the user, and no slurs or jokes about any group.`;
const betalLines = [];

const PRESETS = {
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-3.5-flash-lite", betalModel: "gemini-3.5-flash-lite" },
  grok: { url: "https://api.x.ai/v1/chat/completions", model: "grok-4", betalModel: "grok-4" },
  anthropic: { url: "https://api.anthropic.com/v1/messages", model: "claude-sonnet-5-5", betalModel: "claude-haiku-5-5" },
};
let cfg = { provider: "gemini", apiKey: "", ...PRESETS.gemini, betal: true };

async function stream({ model, system, messages, max_tokens = 4096, temperature, onText }) {
  const anth = cfg.provider === "anthropic";
  const headers = { "content-type": "application/json" };
  let body;
  if (anth) {
    Object.assign(headers, { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" });
    body = { model, system, messages, max_tokens, stream: true, ...(temperature != null && { temperature }) };
  } else {
    headers.authorization = "Bearer " + cfg.apiKey;
    body = { model, messages: [{ role: "system", content: system }, ...messages], max_tokens, stream: true, ...(temperature != null && { temperature }) };
  }
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 60000);
  const r = await fetch(PRESETS[cfg.provider].url, { method: "POST", headers, body: JSON.stringify(body), signal: ctl.signal });
  if (!r.ok) throw new Error((await r.text()).slice(0, 300));
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = "", full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const l of lines) {
      if (!l.startsWith("data: ") || l.includes("[DONE]")) continue;
      try {
        const j = JSON.parse(l.slice(6));
        const piece = anth ? (j.type === "content_block_delta" ? j.delta.text : "") : j.choices?.[0]?.delta?.content;
        if (piece) { full += piece; onText(full); }
      } catch {}
    }
  }
  clearTimeout(to);
  return full;
}

const PROMPTS = {
  ask: (t) => `Selected text:\n"""${t}"""\n\nIf this is a question or task, answer or do it. Otherwise explain it briefly.`,
  explain: (t) => `Explain this simply:\n"""${t}"""`,
  translate: (t) => `Translate to English (if it's already English, translate to Hindi):\n"""${t}"""`,
  summarize: (t) => `Summarize in a few bullets:\n"""${t}"""`,
};

async function loadCfg() {
  const saved = await chrome.storage.local.get(Object.keys(cfg));
  // Settings saved by the older Claude-only version have no provider: use Gemini defaults.
  cfg = saved.provider ? { ...cfg, ...saved } : { ...cfg, betal: saved.betal ?? true };
  // Retired Gemini 2.x model names saved earlier: swap to current defaults.
  if (cfg.provider === "gemini") {
    if (/^gemini-2\./.test(cfg.model)) cfg.model = PRESETS.gemini.model;
    if (/^gemini-2\./.test(cfg.betalModel)) cfg.betalModel = PRESETS.gemini.betalModel;
  }
  return cfg;
}

// Betal's one-liner. Returns "" if anything goes wrong; Betal failing is never Vikram's problem.
async function heckleLine(q, a) {
  try {
    const avoid = betalLines.length ? `\n\nYou already said these, so say something different: ${betalLines.join(" | ")}` : "";
    const t = await stream({
      model: cfg.betalModel, system: BETAL, max_tokens: 800, temperature: 1.1, onText: () => {},
      messages: [{ role: "user", content: `User asked: ${q.slice(0, 600)}\n\nVikram answered: ${a.slice(0, 1200)}${avoid}` }],
    });
    const line = t.trim().split("\n")[0].replace(/^["“']|["”']$/g, "");
    if (line) { betalLines.push(line); betalLines.splice(0, betalLines.length - 6); }
    return line;
  } catch { return ""; }
}
