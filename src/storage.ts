import Database from "better-sqlite3";

export class Storage {
  private db: Database.Database;

  constructor(sqlitePath: string) {
    this.db = new Database(sqlitePath);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS sent_news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        title TEXT,
        sent_at INTEGER NOT NULL
      )`
    );
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS watchlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        ticker TEXT NOT NULL,
        UNIQUE(chat_id, ticker)
      )`
    );
  }

  hasSent(url: string): boolean {
    const row = this.db.prepare("SELECT 1 FROM sent_news WHERE url = ? LIMIT 1").get(url);
    return !!row;
  }

  markSent(ticker: string, url: string, title?: string): void {
    try {
      this.db
        .prepare(
          "INSERT OR IGNORE INTO sent_news (ticker, url, title, sent_at) VALUES (?, ?, ?, ?)"
        )
        .run(ticker, url, title || "", Math.floor(Date.now() / 1000));
    } catch (e) {
      // ignore
    }
  }

  // Watchlist CRUD
  addTickers(chatId: string, tickers: string[]): number {
    const stmt = this.db.prepare(
      "INSERT OR IGNORE INTO watchlists (chat_id, ticker) VALUES (?, ?)"
    );
    let count = 0;
    for (const t of tickers) {
      try {
        const res = stmt.run(chatId, t.toUpperCase());
        if (res.changes > 0) count += 1;
      } catch {
        // ignore
      }
    }
    return count;
  }

  removeTickers(chatId: string, tickers: string[]): number {
    const stmt = this.db.prepare(
      "DELETE FROM watchlists WHERE chat_id = ? AND ticker = ?"
    );
    let count = 0;
    for (const t of tickers) {
      try {
        const res = stmt.run(chatId, t.toUpperCase());
        if (res.changes > 0) count += 1;
      } catch {
        // ignore
      }
    }
    return count;
  }

  listTickers(chatId: string): string[] {
    const rows = this.db
      .prepare("SELECT ticker FROM watchlists WHERE chat_id = ? ORDER BY ticker")
      .all(chatId) as { ticker: string }[];
    return rows.map((r) => r.ticker);
  }
}


