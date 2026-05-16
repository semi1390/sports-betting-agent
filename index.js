require("dotenv").config();
const cron = require("node-cron");
const { runBettingAgent } = require("./src/agent");
const { startCommandListener } = require("./src/telegram");

console.log("🤖 Sports Betting Agent starting...");

// Run 3x daily: 7am, 1pm, 7pm UTC (8am, 2pm, 8pm Lagos)
const schedule = ["0 7 * * *", "0 13 * * *", "0 19 * * *"];

schedule.forEach((time) => {
  cron.schedule(time, async () => {
    console.log(`\n⏰ Scheduled run at ${new Date().toISOString()}`);
    try {
      await runBettingAgent();
    } catch (err) {
      console.error("❌ Agent run failed:", err.message);
    }
  });
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

console.log("✅ Scheduler active. Waiting for next run...");