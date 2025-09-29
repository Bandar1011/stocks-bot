import dotenv from "dotenv";
dotenv.config();

export interface Config {
  tickers: string[];
  telegramBotToken: string;
  telegramChatId: string;
  newsapiApiKey?: string;
  geminiApiKey?: string;
  geminiModel: string;
  lookbackHours: number;
  sqlitePath: string;
}

export function loadConfig(): Config {
  const watchlist = (process.env.WATCHLIST || "").trim();
  const tickers = watchlist
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  const telegramBotToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const telegramChatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  const newsapiApiKey = process.env.NEWSAPI_API_KEY || undefined;
  const geminiApiKey = process.env.GEMINI_API_KEY || undefined;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const lookbackHours = parseInt(process.env.LOOKBACK_HOURS || "12", 10);
  const sqlitePath = process.env.SQLITE_PATH || "news.db";

  if (!tickers.length) {
    throw new Error("WATCHLIST is not set. e.g., WATCHLIST=TSLA,AAPL,NVDA");
  }
  if (!telegramBotToken || !telegramChatId) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.");
  }

  return {
    tickers,
    telegramBotToken,
    telegramChatId,
    newsapiApiKey,
    geminiApiKey,
    geminiModel,
    lookbackHours,
    sqlitePath,
  };
}


