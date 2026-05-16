const axios = require("axios");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set");
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const res = await axios.post(url, {
    chat_id: CHAT_ID,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  });

  if (!res.data.ok) {
    throw new Error(`Telegram API error: ${JSON.stringify(res.data)}`);
  }

  console.log("📱 Telegram message sent successfully");
  return true;
}

async function startCommandListener(onRun) {
  if (!BOT_TOKEN) return;

  console.log("👂 Listening for Telegram /run command...");

  let offset = 0;

  setInterval(async () => {
    try {
      const res = await axios.get(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`,
        { params: { offset, timeout: 10 } }
      );

      const updates = res.data.result || [];

      for (const update of updates) {
        offset = update.update_id + 1;

        const text = update.message?.text?.trim();
        const chatId = String(update.message?.chat?.id);

        if (chatId !== String(CHAT_ID)) continue;

        if (text === "/run") {
          console.log("⚡ Manual /run triggered via Telegram");
          await sendTelegramMessage("⚡ Manual run triggered! Analyzing matches...");
          await onRun();
        }

        if (text === "/status") {
          await sendTelegramMessage("✅ Agent is online and running. Next auto-run at scheduled time.");
        }
      }
    } catch (err) {
      // Silent fail
    }
  }, 3000);
}

async function sendTestMessage() {
  await sendTelegramMessage(
    "✅ *Sports Betting Agent is connected!*\n\nSend /run to trigger manual analysis.\nSend /status to check agent is online."
  );
}

module.exports = { sendTelegramMessage, sendTestMessage, startCommandListener };