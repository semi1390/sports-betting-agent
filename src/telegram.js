const axios = require("axios");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set");
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
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
  } catch (err) {
    if (err.response?.data) {
      console.error("Telegram error details:", err.response.data);
    }
    throw err;
  }
}

// Utility: send a test ping (used in setup)
async function sendTestMessage() {
  await sendTelegramMessage(
    "✅ *Sports Betting Agent is connected!*\n\nYour picks will be delivered here 3x daily."
  );
}

module.exports = { sendTelegramMessage, sendTestMessage };
