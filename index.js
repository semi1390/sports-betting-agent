require("dotenv").config();
const cron = require("node-cron");
const { runBettingAgent } = require("./src/agent");

console.log("🤖 Sports Betting Agent starting...");

// Run 3x daily: 7am, 1pm, 7pm (UTC — adjust to your timezone)
const schedule = ["0 7 * * *", "0 13 * * *", "0 19 * * *"];

schedule.forEach((time) => {
  cron.schedule(time, async () => {
    console.log(`\n⏰ Running agent at ${new Date().toISOString()}`);
    try {
      await runBettingAgent();
    } catch (err) {
      console.error("❌ Agent run failed:", err.message);
    }
  });
});

// Also run immediately on startup (useful for testing)
if (process.env.RUN_ON_STARTUP === "true") {
  console.log("🚀 Running immediately on startup...");
  runBettingAgent().catch((err) =>
    console.error("❌ Startup run failed:", err.message)
  );
}

console.log("✅ Scheduler active. Waiting for next run...");
