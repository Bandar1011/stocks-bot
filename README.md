# Stocks Telegram Bot

This TypeScript bot:
 - Watches a list of stock tickers
 - Fetches news via NewsAPI (if API key present) or Yahoo Finance RSS fallback
 - Summarizes headlines with Gemini (if `GEMINI_API_KEY` present)
 - Sends digests to Telegram, deduplicated via SQLite
 - Sends end-of-day price summaries via yahoo-finance2

## Setup

Install Node deps and set environment variables:
```bash
npm i
export WATCHLIST="TSLA,AAPL,NVDA"
export TELEGRAM_BOT_TOKEN="<your_bot_token>"
export TELEGRAM_CHAT_ID="<your_chat_id>"
# Optional
export NEWSAPI_API_KEY="<newsapi_key>"
export GEMINI_API_KEY="<gemini_api_key>"
 export GEMINI_MODEL="gemini-2.0-flash"   # default
export LOOKBACK_HOURS=12                  # default
export SQLITE_PATH="news.db"             # default
```
Run intraday/eod:
```bash
# run intraday digest
npm run dev:intraday

# run end-of-day prices
npm run dev:eod

# or build & run
npm run build
npm run start:intraday
npm run start:eod

# run Telegram command handler (add/remove/list/news/price)
npm run dev:commands
```

Notes
- Deduplication: URLs recorded in SQLite (`sent_news`) after sending.
- If no new items, bot sends: "No notable new items in the last Xh."
- P1 criteria: earnings beat/miss, guidance changes, recalls, investigations, M&A, or explicit >5% move.
- `/news` supports optional lookback: `h` hours, `d` days, `w` weeks, `m` months, `y` years. Range: 1d–1y. Examples:
  - `/news` (uses default LOOKBACK_HOURS)
  - `/news 48h` (DB watchlist, 48 hours)
  - `/news TSLA,AAPL 7d` (specific tickers, 7 days)
  - `/news 2w TSLA` (order-independent)
 - `/price` returns realtime quotes (watchlist by default, or pass tickers: `/price TSLA,AAPL`).
 - `/news` now returns a per-ticker Buy/Sell/Hold with confidence based on recent headlines (Gemini if configured, otherwise heuristic). This is informational only, not investment advice.

Scheduling
- EOD prices: `npm run start:eod`
- EOD news signals: `npm run start:eod-news`
