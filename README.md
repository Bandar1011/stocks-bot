
<img width="443" height="339" alt="Screenshot 0007-10-04 at 4 49 11" src="https://github.com/user-attachments/assets/b6367caf-ce41-426e-a92e-227595eee658" />
📈 St<img width="443" height="865" alt="Screenshot 0007-10-04 at 4 48 22" src="https://github.com/user-attachments/assets/95d575f9-88c5-460e-8630-256478bb69b5" />
ocks Telegram Bot / 株式テレグラムボット

EN: A TypeScript-powered Telegram bot that tracks stock tickers, fetches financial news, summarizes headlines with AI, and sends real-time digests or end-of-day reports.
JP: TypeScriptで作られたTelegramボットです。株式ティッカーを監視し、金融ニュースを取得、AIで要約し、リアルタイムや終値のレポートを自動で送信します。

✨ Features / 機能

🔍 Watchlist Tracking / ウォッチリスト監視
　指定した株式ティッカー（例: TSLA, AAPL, NVDA）を継続的にモニター。

📰 News Fetching / ニュース取得
　NewsAPIまたはYahoo FinanceのRSSから最新ニュースを取得。

🤖 AI Summarization / AI要約
　Google Gemini APIでヘッドラインを要約。Geminiが無い場合はヒューリスティック方式を使用。

💬 Telegram Integration / Telegram連携
　監視結果をTelegramグループまたは個人チャットに自動配信。

📊 End-of-Day Reports / 日次レポート
　1日の株価サマリーを自動でまとめて送信。

🗂 Flashcard-Style Insights / 投資判断メモ
　AIがニュース内容に基づき「Buy / Sell / Hold」を提案（参考情報、投資助言ではありません）。

⚙️ Setup / セットアップ
1. Install dependencies / 依存関係インストール
npm install

2. Environment variables / 環境変数
export WATCHLIST="TSLA,AAPL,NVDA"
export TELEGRAM_BOT_TOKEN="<your_bot_token>"
export TELEGRAM_CHAT_ID="<your_chat_id>"
# Optional / 任意
export NEWSAPI_API_KEY="<newsapi_key>"
export GEMINI_API_KEY="<gemini_api_key>"
export GEMINI_MODEL="gemini-2.0-flash"   # default
export LOOKBACK_HOURS=12                 # default
export SQLITE_PATH="news.db"             # default

3. Run the bot / 実行方法
# Intraday news digest / 日中ニュースダイジェスト
npm run dev:intraday

# End-of-day stock prices / 終値サマリー
npm run dev:eod

# Telegram command handler / コマンドハンドラー
npm run dev:commands

📱 Telegram Commands / コマンド一覧

/news → 最新ニュースの要約を表示

例: /news 48h (過去48時間)

例: /news TSLA,AAPL 7d (指定ティッカー7日分)

/price → 現在の株価を表示

例: /price TSLA,AAPL

/sources → ニュースの出典URLとヘッドライン一覧

🗓 Scheduling / スケジューリング

npm run start:eod → 終値サマリー自動送信

npm run start:eod-news → 日次ニュースシグナル自動送信

🔒 Notes / 補足

SQLiteでニュースURLを保存 → 重複送信を防止。

新しいニュースが無い場合は "No notable new items in the last Xh." を返す。

投資判断シグナル（Buy/Sell/Hold）は参考情報のみであり、投資助言ではありません。
