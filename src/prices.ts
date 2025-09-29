import yf from "yahoo-finance2";

function fmtChange(curr: number, prev: number): string {
  if (!prev) return "(n/a)";
  const pct = ((curr - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export async function buildEodSummary(tickers: string[]): Promise<string> {
  const lines: string[] = [];
  lines.push("EOD Prices Summary");
  for (const t of tickers) {
    try {
      const q = await yf.quoteSummary(t, { modules: ["price"] });
      const price = q?.price;
      const close = Number(price?.regularMarketPreviousClose ?? price?.regularMarketPrice ?? 0);
      const last = Number(price?.regularMarketPrice ?? 0);
      const post = Number(price?.postMarketPrice ?? 0);
      const prevClose = Number(price?.regularMarketPreviousClose ?? last);
      const postText = post && Math.abs(post - last) >= 0.005 ? ` | Post: ${post.toFixed(2)} (${fmtChange(post, last)})` : "";
      lines.push(`- ${t}: Close ${last.toFixed(2)} (${fmtChange(last, prevClose)})${postText}`);
    } catch {
      lines.push(`- ${t}: error fetching prices`);
    }
  }
  return lines.join("\n");
}

export async function buildRealtimePrices(tickers: string[]): Promise<string> {
  const lines: string[] = [];
  lines.push("Realtime Prices");
  for (const t of tickers) {
    try {
      const q: any = await yf.quote(t);
      const last = Number(q?.regularMarketPrice ?? 0);
      const prevClose = Number(q?.regularMarketPreviousClose ?? last);
      const post = Number(q?.postMarketPrice ?? 0);
      const changePct = q?.regularMarketChangePercent != null
        ? Number(q.regularMarketChangePercent)
        : ((last && prevClose) ? ((last - prevClose) / prevClose) * 100 : 0);
      const sign = changePct >= 0 ? "+" : "";
      const postText = post && Math.abs(post - last) >= 0.005 ? ` | Post: ${post.toFixed(2)} (${fmtChange(post, last)})` : "";
      lines.push(`- ${t}: ${last.toFixed(2)} (${sign}${changePct.toFixed(2)}%)${postText}`);
    } catch {
      lines.push(`- ${t}: error fetching quote`);
    }
  }
  return lines.join("\n");
}


