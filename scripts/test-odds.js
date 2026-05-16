// scripts/test-odds.js
require("dotenv").config();
const axios = require("axios");

async function testOdds() {
  const sports = [
    "soccer_spain_la_liga",
    "soccer_england_league1",
    "soccer_usa_mls",
    "soccer_france_ligue_one",
    "soccer_italy_serie_a",
    "basketball_nba",
    "basketball_euroleague",
  ];

  for (const sport of sports) {
    const res = await axios.get(`https://api.the-odds-api.com/v4/sports/${sport}/odds`, {
      params: {
        apiKey: process.env.ODDS_API_KEY,
        regions: "eu",
        markets: "h2h",
        oddsFormat: "decimal",
      },
    });
    console.log(`${sport}: ${res.data.length} games | requests left: ${res.headers["x-requests-remaining"]}`);
  }
}

testOdds().catch(console.error);