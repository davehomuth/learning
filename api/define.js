// Homuth Learning Hub — kid-friendly word definitions via Claude.
// Vercel serverless function. The API key lives in ANTHROPIC_API_KEY (Vercel env var)
// and never reaches the browser.
//
// POST /api/define   body: { word: "perplex", grade?: 4 }
// Returns: { definition: "...", sentence: "..." }
//
// Deploy this folder to Vercel, set ANTHROPIC_API_KEY, then put the function URL
// (e.g. https://your-project.vercel.app/api/define) into APP_CONFIG.aiEndpoint.

const MODEL = process.env.AI_MODEL || "claude-opus-4-8";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Static system prompt — cached so repeat lookups are cheap and fast.
const SYSTEM = `You write dictionary entries for a children's learning app used by kids in JK through grade 8.
Given a single word, return a short, kid-friendly definition and ONE simple example sentence that uses the word naturally.
Rules:
- Definition: one clear phrase a child can understand, no more than ~12 words. Do not repeat the word inside its own definition.
- Sentence: one short, wholesome, age-appropriate sentence that shows the word's meaning.
- Keep it clean and encouraging. No violence, romance, or scary themes.
Return ONLY raw JSON: {"definition":"...","sentence":"..."} — no markdown, no commentary.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY. Set it in Vercel project settings." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const word = (body && body.word ? String(body.word) : "").trim().slice(0, 40);
  const grade = body && body.grade != null ? body.grade : "";
  if (!word) return res.status(400).json({ error: "Missing 'word'." });

  const payload = {
    model: MODEL,
    max_tokens: 300,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Word: ${word}${grade !== "" ? `\nReader grade level: ${grade}` : ""}` }],
  };

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: "AI provider error", detail: text.slice(0, 500) });
    }

    const data = await r.json();
    let raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

    let parsed = null;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0]); } catch {} }

    if (!parsed || !parsed.definition) {
      return res.status(200).json({ definition: "", sentence: "", raw });
    }
    return res.status(200).json({ definition: parsed.definition, sentence: parsed.sentence || "" });
  } catch (e) {
    return res.status(500).json({ error: "Request failed", detail: String(e).slice(0, 300) });
  }
}
