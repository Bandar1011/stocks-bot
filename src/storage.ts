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
}


