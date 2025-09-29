import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadConfig } from "./config.js";
import { fetchNews } from "./news.js";
import { Storage } from "./storage.js";
import { summarizeNews } from "./summarizer.js";
import { sendMessage } from "./telegramClient.js";
import { buildEodSummary } from "./prices.js";

function formatIntradayDigest(results: any[], hours: number): string {
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

function getTickersFromDbOrEnv(storage: Storage, envTickers: string[], chatId: string): string[] {
  const dbTickers = storage.listTickers(chatId);
  return dbTickers.length ? dbTickers : envTickers;
}

async function runIntraday() {
  const cfg = loadConfig();
  const storage = new Storage(cfg.sqlitePath);
  const tickers = getTickersFromDbOrEnv(storage, cfg.tickers, cfg.telegramChatId);
  const allItems = await fetchNews(tickers, cfg.lookbackHours, cfg.newsapiApiKey);
  const fresh = allItems.filter((it) => !storage.hasSent(it.url));
  if (!fresh.length) {
    await sendMessage(cfg.telegramBotToken, cfg.telegramChatId, `No notable new items in the last ${cfg.lookbackHours}h.`);
    return;
  }
  const results = await summarizeNews(fresh, cfg.geminiApiKey, cfg.geminiModel);
  const msg = formatIntradayDigest(results, cfg.lookbackHours);
  await sendMessage(cfg.telegramBotToken, cfg.telegramChatId, msg);
  for (const r of results) storage.markSent(r.ticker, r.url, r.title);
}

async function runEod() {
  const cfg = loadConfig();
  const storage = new Storage(cfg.sqlitePath);
  const tickers = getTickersFromDbOrEnv(storage, cfg.tickers, cfg.telegramChatId);
  const msg = await buildEodSummary(tickers);
  await sendMessage(cfg.telegramBotToken, cfg.telegramChatId, msg);
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("mode", { choices: ["intraday", "eod"], demandOption: true })
    .strict()
    .parse();
  if (argv.mode === "intraday") await runIntraday();
  else await runEod();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


