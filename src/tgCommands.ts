import axios from "axios";
import { Storage } from "./storage.js";
import { Config } from "./config.js";
import { fetchNews } from "./news.js";
import { summarizeNews } from "./summarizer.js";
import { sendMessage } from "./telegramClient.js";

export class TgCommandHandler {
  private botToken: string;
  private ownerChatId: string;
  private storage: Storage;
  private offset: number = 0;
  private cfg: Config;

  constructor(botToken: string, ownerChatId: string, storage: Storage, cfg: Config) {
    this.botToken = botToken;
    this.ownerChatId = ownerChatId;
    this.storage = storage;
    this.cfg = cfg;
  }

  private async send(chatId: string, text: string): Promise<void> {
    await sendMessage(this.botToken, chatId, text);
  }

  private parseTickers(arg: string | undefined): string[] {
    if (!arg) return [];
    return arg
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => !!t);
  }

  private async handleCommand(chatId: string, text: string): Promise<void> {
    if (chatId !== this.ownerChatId) {
      await this.send(chatId, "Unauthorized.");
      return;
    }
    const [cmd, arg] = text.split(/\s+/, 2);
    if (cmd === "/add") {
      const tickers = this.parseTickers(arg);
      if (!tickers.length) return this.send(chatId, "Usage: /add TSLA,AAPL");
      const added = this.storage.addTickers(chatId, tickers);
      await this.send(chatId, `Added ${added}: ${tickers.join(", ")}`);
    } else if (cmd === "/remove") {
      const tickers = this.parseTickers(arg);
      if (!tickers.length) return this.send(chatId, "Usage: /remove TSLA");
      const removed = this.storage.removeTickers(chatId, tickers);
      await this.send(chatId, `Removed ${removed}: ${tickers.join(", ")}`);
    } else if (cmd === "/list") {
      const list = this.storage.listTickers(chatId);
      await this.send(chatId, list.length ? `Watchlist: ${list.join(", ")}` : "Watchlist is empty.");
    } else if (cmd === "/news") {
      // Syntax:
      // /news                    -> DB or env, default lookback
      // /news 48h                -> DB or env, custom lookback
      // /news TSLA,AAPL          -> specific tickers, default lookback
      // /news TSLA,AAPL 7d       -> specific tickers, custom lookback
      // /news 2w TSLA,AAPL       -> order-independent

      const parseLookback = (token: string): number | null => {
        const m = token.match(/^(\d+)([hdwmy])$/i);
        if (!m) return null;
        const n = parseInt(m[1], 10);
        const u = m[2].toLowerCase();
        const unitToHours: Record<string, number> = { h: 1, d: 24, w: 24 * 7, m: 24 * 30, y: 24 * 365 };
        const hours = n * unitToHours[u];
        const minH = 24; // 1 day
        const maxH = 24 * 365; // 1 year
        return Math.max(minH, Math.min(maxH, hours));
      };

      let lookbackHours = this.cfg.lookbackHours;
      let tickersArg = "";
      if (arg && arg.trim()) {
        const parts = arg.trim().split(/\s+/).filter(Boolean);
        // find a lookback token among parts
        for (let i = parts.length - 1; i >= 0; i--) {
          const lb = parseLookback(parts[i]);
          if (lb !== null) {
            lookbackHours = lb;
            parts.splice(i, 1);
            break;
          }
        }
        tickersArg = parts.join(" ");
      }

      const requested = this.parseTickers(tickersArg);
      const baseList = this.storage.listTickers(chatId);
      const tickers = requested.length ? requested : (baseList.length ? baseList : this.cfg.tickers);
      if (!tickers.length) return this.send(chatId, "No tickers configured. Use /add or set WATCHLIST.");
      try {
        const items = await fetchNews(tickers, lookbackHours, this.cfg.newsapiApiKey);
        const fresh = items.filter((it) => !this.storage.hasSent(it.url));
        if (!fresh.length) return this.send(chatId, `No notable new items in the last ${lookbackHours}h.`);
        const results = await summarizeNews(fresh, this.cfg.geminiApiKey, this.cfg.geminiModel);
        const msg = this.formatDigest(results, lookbackHours);
        await this.send(chatId, msg);
      } catch (e) {
        await this.send(chatId, "Failed to fetch news. Try again later.");
      }
    } else {
      await this.send(
        chatId,
        "Commands:\n/add TSLA,AAPL\n/remove TSLA\n/list\n/news [TICKERS] [LOOKBACK] (e.g., /news TSLA,AAPL 7d)"
      );
    }
  }

  async pollOnce(): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/getUpdates`;
    const resp = await axios.get(url, { params: { timeout: 0, offset: this.offset }, timeout: 15000 });
    const updates: any[] = resp.data?.result || [];
    for (const u of updates) {
      this.offset = Math.max(this.offset, (u.update_id as number) + 1);
      const msg = u.message;
      if (!msg) continue;
      const chatId = String(msg.chat?.id ?? "");
      const text = String(msg.text ?? "").trim();
      if (!text) continue;
      await this.handleCommand(chatId, text);
    }
  }

  private formatDigest(results: any[], hours: number): string {
    if (!results.length) return `No notable new items in the last ${hours}h.`;
    const sorted = [...results].sort((a, b) => {
      const pa = a.priority === "P1" ? 0 : 1;
      const pb = b.priority === "P1" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return String(a.ticker).localeCompare(String(b.ticker));
    });
    const lines: string[] = ["News Digest"]; 
    let current = "";
    for (const r of sorted) {
      const t = r.ticker || "";
      if (t !== current) {
        lines.push("");
        lines.push(`[${t}]`);
        current = t;
      }
      lines.push(`- ${r.priority} ${r.label}: ${r.title} (${r.source})`);
      if (r.url) lines.push(`  ${r.url}`);
      if (r.why) lines.push(`  Why: ${r.why}`);
    }
    return lines.join("\n");
  }
}


