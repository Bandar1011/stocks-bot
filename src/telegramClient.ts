import axios from "axios";

function chunkMessage(text: string, limit = 3800): string[] {
  const parts: string[] = [];
  let current: string[] = [];
  let currentLen = 0;
  for (const line of text.split("\n")) {
    const lineLen = line.length + 1;
    if (currentLen + lineLen > limit && current.length) {
      parts.push(current.join("\n"));
      current = [line];
      currentLen = line.length;
    } else {
      current.push(line);
      currentLen += lineLen;
    }
  }
  if (current.length) parts.push(current.join("\n"));
  return parts;
}

export async function sendMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  for (const chunk of chunkMessage(text)) {
    try {
      await axios.post(url, { chat_id: chatId, text: chunk, disable_web_page_preview: true }, { timeout: 15000 });
    } catch {
      // ignore
    }
  }
}


