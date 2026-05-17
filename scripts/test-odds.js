require("dotenv").config();
const axios = require("axios");

async function testOdds() {
  const leagues = [
    "soccer_italy_serie_a",
    "soccer_england_premier_league", 
    "basketball_euroleague",
  ];

  for (const league of leagues) {
    const res = await axios.get(`https://api.the-odds-api.com/v4/sports/${league}/odds`, {
      params: {
        apiKey: process.env.ODDS_API_KEY,
        regions: "eu",
        markets: "h2h,totals",
        oddsFormat: "decimal",
      },
    });

    console.log(`\n📋 ${league}:`);
    res.data.forEach(g => {
      console.log(`  ${g.home_team} vs ${g.away_team}`);
      const totals = g.bookmakers?.[0]?.markets?.find(m => m.key === "totals");
      if (totals) {
        console.log(`    Totals points available:`, totals.outcomes.map(o => `${o.name} ${o.point}`).join(", "));
      }
    });

    console.log(`Requests left: ${res.headers["x-requests-remaining"]}`);
  }
}

testOdds().catch(console.error);