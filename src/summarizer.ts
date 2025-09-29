import { GoogleGenerativeAI } from "@google/generative-ai";

export interface SummaryItem {
  ticker: string;
  label: "Good" | "Bad" | "Neutral";
  why: string; // <= 140 chars
  priority: "P1" | "P2";
  title: string;
  source: string;
  url: string;
}

export interface TickerDecision {
  ticker: string;
  action: "Buy" | "Sell" | "Hold";
  confidence: number; // 0..100
  rationale: string; // <= 140 chars
}

function coerceItem(obj: any): SummaryItem {
  const ticker = String(obj?.ticker || "").toUpperCase();
  const labelRaw = String(obj?.label || "Neutral");
  const label = (labelRaw === "Good" || labelRaw === "Bad" || labelRaw === "Neutral") ? labelRaw : "Neutral";
  const whyRaw = String(obj?.why || "");
  const why = whyRaw.length > 140 ? whyRaw.slice(0, 140) : whyRaw;
  const priorRaw = String(obj?.priority || "P2").toUpperCase();
  const priority = (priorRaw === "P1" || priorRaw === "P2") ? priorRaw as "P1" | "P2" : "P2";
  const title = String(obj?.title || "");
  const source = String(obj?.source || "");
  const url = String(obj?.url || "");
  return { ticker, label, why, priority, title, source, url };
}

function fallbackSummaries(items: any[]): SummaryItem[] {
  return items.map((it) => coerceItem({
    ticker: String(it?.ticker || "").toUpperCase(),
    label: "Neutral",
    why: String(it?.title || "").slice(0, 140),
    priority: "P2",
    title: String(it?.title || ""),
    source: String(it?.source || ""),
    url: String(it?.url || ""),
  }));
}

export async function summarizeNews(items: any[], geminiApiKey?: string, geminiModel = "gemini-1.5-flash"): Promise<SummaryItem[]> {
  if (!items?.length) return [];
  if (!geminiApiKey) return fallbackSummaries(items);

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    const newsPayload = items.map((it) => ({
      ticker: String(it?.ticker || "").toUpperCase(),
      title: String(it?.title || ""),
      source: String(it?.source || ""),
      url: String(it?.url || ""),
    }));

    const instructions = [
      "You are an equity news triage assistant.",
      "Only use the provided fields. No external knowledge.",
      "Return ONLY a JSON array. No extra text.",
      "Schema keys: ticker, label (Good/Bad/Neutral), why (<=140 chars), priority (P1/P2), title, source, url.",
      "P1 if earnings beat/miss, guidance change, recall, investigation, M&A, or explicit >5% price move. Otherwise P2.",
    ].join("\n");

    const prompt = JSON.stringify({ instructions, items: newsPayload });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "Task: Summarize and classify each headline. Output only JSON array." }, { text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    } as any);

    const text = (result.response.text?.() as string) || (result.response.text as any) || "";
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : (Array.isArray((data as any).results) ? (data as any).results : []);
    if (!arr.length) return fallbackSummaries(items);
    return arr.map(coerceItem);
  } catch {
    return fallbackSummaries(items);
  }
}

export async function analyzeTickers(
  items: any[],
  geminiApiKey?: string,
  geminiModel = "gemini-2.0-flash"
): Promise<TickerDecision[]> {
  if (!items?.length) return [];

  // Group titles by ticker
  const grouped: Record<string, { title: string; source: string; url: string }[]> = {};
  for (const it of items) {
    const t = String(it?.ticker || "").toUpperCase();
    if (!t) continue;
    (grouped[t] ||= []).push({
      title: String(it?.title || ""),
      source: String(it?.source || ""),
      url: String(it?.url || ""),
    });
  }
  const tickers = Object.keys(grouped);
  if (!tickers.length) return [];

  if (geminiApiKey) {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: geminiModel });

      const payload = tickers.map((tk) => ({
        ticker: tk,
        headlines: grouped[tk].map((h) => ({ title: h.title, source: h.source })),
      }));
      const instructions = [
        "You are an equity news analyst.",
        "Deeply analyze the directional signal implied by the provided headlines ONLY (no external knowledge).",
        "Weigh P1-style events (earnings beat/miss, guidance changes, recalls, investigations, M&A, explicit >5% move) more heavily.",
        "Consider recency and repeated themes. If signals conflict, prefer Hold with lower confidence.",
        "rationale MUST be a concrete critical reason for WHY the chosen action makes sense AND WHY the confidence level is appropriate (e.g., 'beat and raised FY25 guide; multiple bullish P1 items in last week → higher confidence'). Keep it concise (<=140 chars).",
        "Output ONLY JSON array: {ticker, action, confidence, rationale} with action ∈ {Buy,Sell,Hold}, confidence 0..100 integer, rationale <= 140 chars.",
        "Think step-by-step internally, but do not expose chain-of-thought."
      ].join("\n");
      const prompt = JSON.stringify({ instructions, items: payload });

      const result: any = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: "Task: Recommend Buy/Sell/Hold with confidence per ticker. Output JSON only." }, { text: prompt }] },
        ],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" } as any,
      } as any);

      const text = (result.response.text?.() as string) || (result.response.text as any) || "";
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [];
      const coerce = (o: any): TickerDecision => {
        const ticker = String(o?.ticker || "").toUpperCase();
        let action = String(o?.action || "Hold");
        action = action === "Buy" || action === "Sell" ? action : "Hold";
        let confidence = Number(o?.confidence);
        if (!Number.isFinite(confidence)) confidence = 50;
        confidence = Math.max(0, Math.min(100, Math.round(confidence)));
        let rationale = String(o?.rationale || "").trim();
        if (!rationale || /generic|no significant|unclear|mixed headlines/i.test(rationale)) {
          // Build a concrete fallback from the most salient headline
          const top = (grouped[ticker] && grouped[ticker][0]?.title) || "news mix";
          rationale = `Key: ${top}`;
        }
        if (rationale.length > 140) rationale = rationale.slice(0, 140);
        return { ticker, action: action as TickerDecision["action"], confidence, rationale };
      };
      const out = arr.filter((x: any) => x && x.ticker).map(coerce);
      if (out.length) return out;
    } catch {
      // fall through to heuristic
    }
  }

  // Heuristic fallback: reuse summarizeNews and score per ticker
  const summaries = await summarizeNews(items, undefined, geminiModel);
  const byTicker: Record<string, SummaryItem[]> = {};
  for (const s of summaries) {
    (byTicker[s.ticker] ||= []).push(s);
  }
  const decisions: TickerDecision[] = [];
  for (const tk of Object.keys(byTicker)) {
    const arr = byTicker[tk];
    let score = 0;
    let good = 0;
    let bad = 0;
    for (const s of arr) {
      if (s.label === "Good") {
        score += s.priority === "P1" ? 2 : 1;
        good += 1;
      } else if (s.label === "Bad") {
        score -= s.priority === "P1" ? 2 : 1;
        bad += 1;
      }
    }
    let action: "Buy" | "Sell" | "Hold" = "Hold";
    if (score > 0) action = "Buy";
    else if (score < 0) action = "Sell";
    const n = arr.length;
    const absScore = Math.abs(score);
    let confidence = Math.min(90, 40 + 10 * Math.log10(Math.max(1, n))) + Math.min(10, absScore * 3);
    confidence = Math.round(Math.max(10, Math.min(95, confidence)));
    const rationale = (good === 0 && bad === 0)
      ? "Mixed/low-signal headlines in window"
      : `Net ${good} good vs ${bad} bad (P1 weighted)`;
    decisions.push({ ticker: tk, action, confidence, rationale });
  }
  return decisions;
}


