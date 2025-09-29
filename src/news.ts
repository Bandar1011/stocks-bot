import axios from "axios";
import Parser from "rss-parser";
import yf from "yahoo-finance2";

export interface NewsItem {
  ticker: string;
  title: string;
  source: string;
  url: string;
  published_at?: string;
}

async function newsapiFetch(query: string, sinceISO: string, apiKey: string): Promise<NewsItem[]> {
  try {
    const resp = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        q: query,
        language: "en",
        sortBy: "publishedAt",
        pageSize: 50,
        from: sinceISO,
        apiKey,
      },
      timeout: 15000,
    });
    const articles = resp.data?.articles || [];
    return articles.slice(0, 50).map((a: any) => ({
      ticker: query,
      title: a.title || "",
      source: (a.source && a.source.name) || "",
      url: a.url || "",
      published_at: a.publishedAt || "",
    })).filter((x: NewsItem) => x.title && x.url);
  } catch {
    return [];
  }
}

async function yahooRssFetch(ticker: string): Promise<NewsItem[]> {
  const parser = new Parser();
  const urls = [
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${ticker}&region=US&lang=en-US`,
    `https://finance.yahoo.com/rss/headline?s=${ticker}`,
  ];
  for (const url of urls) {
    try {
      const feed = await parser.parseURL(url);
      const items: NewsItem[] = [];
      for (const e of (feed.items || []).slice(0, 50)) {
        const title = e.title || "";
        const link = e.link || "";
        if (!title || !link) continue;
        items.push({
          ticker,
          title,
          source: (e as any).source?.title || feed.title || "Yahoo Finance",
          url: link,
          published_at: e.pubDate,
        });
      }
      if (items.length) return items;
    } catch {
      continue;
    }
  }
  return [];
}

async function googleNewsRssFetch(query: string, ticker: string): Promise<NewsItem[]> {
  const parser = new Parser();
  const q = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const feed = await parser.parseURL(url);
    const items: NewsItem[] = [];
    for (const e of (feed.items || []).slice(0, 50)) {
      const title = e.title || "";
      const link = e.link || "";
      if (!title || !link) continue;
      items.push({
        ticker,
        title,
        source: feed.title || "Google News",
        url: link,
        published_at: e.pubDate,
      });
    }
    return items;
  } catch {
    return [];
  }
}

async function buildQueryWithSynonyms(ticker: string): Promise<{ query: string; displayTicker: string; }>{
  try {
    const q: any = await yf.quote(ticker);
    const names = new Set<string>();
    if (q?.shortName) names.add(String(q.shortName));
    if (q?.longName) names.add(String(q.longName));
    if (q?.displayName) names.add(String(q.displayName));
    // build OR query: TICKER OR "Name1" OR "Name2"
    const namePart = Array.from(names)
      .filter(Boolean)
      .map((n) => `"${n.replace(/"/g, '')}"`)
      .join(" OR ");
    const query = namePart ? `${ticker} OR ${namePart}` : ticker;
    return { query, displayTicker: ticker };
  } catch {
    return { query: ticker, displayTicker: ticker };
  }
}

export async function fetchNews(tickers: string[], lookbackHours: number, newsapiApiKey?: string): Promise<NewsItem[]> {
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();
  const all: NewsItem[] = [];
  for (const t of tickers) {
    const { query, displayTicker } = await buildQueryWithSynonyms(t);
    let items: NewsItem[] = [];
    if (newsapiApiKey) {
      items = await newsapiFetch(query, since, newsapiApiKey);
    }
    if (!items.length) {
      items = await yahooRssFetch(displayTicker);
    }
    if (!items.length) {
      items = await googleNewsRssFetch(query, displayTicker);
    }
    // normalize ticker label
    items = items.map((it) => ({ ...it, ticker: displayTicker }));
    all.push(...items);
  }
  // dedupe by URL then by title
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const it of all) {
    const urlKey = (it.url || "").trim();
    const titleKey = (it.title || "").trim().toLowerCase();
    if (urlKey && seenUrl.has(urlKey)) continue;
    if (!urlKey && titleKey && seenTitle.has(titleKey)) continue;
    if (urlKey) seenUrl.add(urlKey);
    if (titleKey) seenTitle.add(titleKey);
    deduped.push(it);
  }
  return deduped;
}


