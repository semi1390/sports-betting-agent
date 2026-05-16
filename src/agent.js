const { getFootballMatches } = require("./football");
const { getBasketballMatches } = require("./basketball");
const { analyzeWithClaude } = require("./claude");
const { sendTelegramMessage } = require("./telegram");
const { enrichPicksWithRealOdds } = require("./odds");

async function runBettingAgent() {
  console.log("📊 Fetching match data...");

  const [footballMatches, basketballMatches] = await Promise.allSettled([
    getFootballMatches(),
    getBasketballMatches(),
  ]);

  const allMatches = [
    ...(footballMatches.status === "fulfilled" ? footballMatches.value : []),
    ...(basketballMatches.status === "fulfilled"
      ? basketballMatches.value
      : []),
  ];

  if (footballMatches.status === "rejected") {
    console.error("⚠️  Football API error:", footballMatches.reason.message);
  }
  if (basketballMatches.status === "rejected") {
    console.error(
      "⚠️  Basketball API error:",
      basketballMatches.reason.message
    );
  }

  if (allMatches.length === 0) {
    console.log("😴 No matches available right now. Skipping.");
    await sendTelegramMessage(
      "😴 No matches found for analysis right now. Will check again later."
    );
    return;
  }

  console.log(`✅ Got ${allMatches.length} matches. Sending to Claude AI...`);

const picks = await analyzeWithClaude(allMatches);

  if (!picks || picks.length === 0) {
    console.log("🤔 Claude found no value bets this round.");
    await sendTelegramMessage(
      "🔍 Analyzed today's matches — no strong value bets found. Staying disciplined!"
    );
    return;
  }

 const enrichedPicks = await enrichPicksWithRealOdds(picks);
  const validPicks = enrichedPicks.filter(p => p.odds && !isNaN(p.odds));

  const comboOdds = validPicks.reduce((acc, p) => acc * parseFloat(p.odds), 1);
  if (validPicks.length < 2 || comboOdds < 2.00 || comboOdds > 6.00) {
    console.log(`⚠️ Combo odds ${comboOdds.toFixed(2)} outside acceptable range. Skipping.`);
    await sendTelegramMessage(
      `⚠️ Picks found but combo odds (${comboOdds.toFixed(2)}) outside target range. Skipping this run.`
    );
    return;
  }
  const message = formatTelegramMessage(picks);
  await sendTelegramMessage(message);
  console.log("✅ Picks sent to Telegram!");
}

function formatTelegramMessage(validPicks) {
  const now = new Date().toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const totalOdds = picks
    .reduce((acc, p) => acc * parseFloat(p.odds), 1)
    .toFixed(2);

  let msg = `🎯 *AI BETTING PICKS* — ${now}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  picks.forEach((pick, i) => {
    const sport = pick.sport === "basketball" ? "🏀" : "⚽";
    msg += `${sport} *${pick.match}*\n`;
    msg += `📌 Pick: *${pick.pick}*\n`;
    msg += `💰 Odds: *${pick.odds}*\n`;
    msg += `📈 ${pick.reason}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🎲 *COMBO ODDS: ${totalOdds}*\n`;
  msg += `⚠️ _Bet responsibly. Max 2-3% of bankroll._`;

  return msg;
}

module.exports = { runBettingAgent };
