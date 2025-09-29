import { loadConfig } from "./config.js";
import { Storage } from "./storage.js";
import { TgCommandHandler } from "./tgCommands.js";

async function main() {
  const cfg = loadConfig();
  const storage = new Storage(cfg.sqlitePath);
  const handler = new TgCommandHandler(cfg.telegramBotToken, cfg.telegramChatId, storage, cfg);
  console.log("Polling Telegram for commands... (Ctrl+C to stop)");
  while (true) {
    try {
      await handler.pollOnce();
    } catch (e) {
      // backoff on error
      await new Promise((r) => setTimeout(r, 2000));
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main();


