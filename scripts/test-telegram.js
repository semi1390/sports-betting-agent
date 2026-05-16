require("dotenv").config();
const { sendTestMessage } = require("../src/telegram");

console.log("Testing Telegram connection...");
sendTestMessage()
  .then(() => console.log("✅ Test message sent!"))
  .catch((err) => console.error("❌ Failed:", err.message));
