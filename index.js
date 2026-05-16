require("dotenv").config();
const cron = require("node-cron");
const { runBettingAgent } = require("./src/agent");
const { startCommandListener } = require("./src/telegram");

console.log("🤖 Sports Betting Agent starting...");

// Run once daily at 7am UTC (8am Lagos time)
cron.schedule("0 7 * * *", async () => {
  console.log(`\n⏰ Daily run at ${new Date().toISOString()}`);
  try {
    await runBettingAgent();
  } catch (err) {
    console.error("❌ Agent run failed:", err.message);
  }
});

// Listen for /run and /status commands from Telegram
startCommandListener(async () => {
  try {
    await runBettingAgent();
  } catch (err) {
    console.error("❌ Manual run failed:", err.message);
  }
});

if (process.env.RUN_ON_STARTUP === "true") {
  console.log("🚀 Running immediately on startup...");
  runBettingAgent().catch((err) =>
    console.error("❌ Startup run failed:", err.message)
  );
}

console.log("✅ Scheduler active — daily run at 8am Lagos time.");