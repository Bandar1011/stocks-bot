import axios from "axios";
import Parser from "rss-parser";

export interface NewsItem {
  ticker: string;
  title: string;
  source: string;
  url: string;
  published_at?: string;
}

async function newsapiFetch(ticker: string, sinceISO: string, apiKey: string): Promise<NewsItem[]> {
  try {
    const resp = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        q: ticker,
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
      ticker,
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

export async function fetchNews(tickers: string[], lookbackHours: number, newsapiApiKey?: string): Promise<NewsItem[]> {
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();
  const all: NewsItem[] = [];
  for (const t of tickers) {
    const items = newsapiApiKey
      ? await newsapiFetch(t, since, newsapiApiKey)
      : await yahooRssFetch(t);
    all.push(...items);
  }
  return all;
}


