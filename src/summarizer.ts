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


