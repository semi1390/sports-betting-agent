// scripts/debug-football.js
require("dotenv").config();
const axios = require("axios");

async function run() {
  const dates = [1, 2, 3, 4, 5].map(d =>
    new Date(Date.now() + d * 86400000).toISOString().split("T")[0]
  );

  for (const date of dates) {
    const res = await axios.get("https://v3.football.api-sports.io/fixtures", {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
      params: { date, status: "NS" },
    });
    const fixtures = res.data.response || [];
    console.log(`\n📅 ${date}: ${fixtures.length} total fixtures`);
    fixtures.slice(0, 8).forEach(f =>
      console.log(`  - ${f.teams.home.name} vs ${f.teams.away.name} | league: ${f.league.name} (id: ${f.league.id})`)
    );
  }
}

run().catch(console.error);