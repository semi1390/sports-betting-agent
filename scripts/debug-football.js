// scripts/debug-football.js
require("dotenv").config();
const axios = require("axios");

async function run() {
  // Test predictions for today's fixture
  const p = await axios.get("https://v3.football.api-sports.io/predictions", {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    params: { fixture: 1388605 },
  }).catch(e => ({ data: e.response?.data }));
  console.log("PREDICTIONS results:", p.data?.results);
  console.log("PREDICTIONS sample:", JSON.stringify(p.data?.response?.[0]?.predictions, null, 2));

  // Test standings for Bundesliga 2024
  const s = await axios.get("https://v3.football.api-sports.io/standings", {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    params: { league: 78, season: 2024 },
  }).catch(e => ({ data: e.response?.data }));
  console.log("STANDINGS results:", s.data?.results);
  console.log("STANDINGS sample:", JSON.stringify(s.data?.response?.[0]?.league?.standings?.[0]?.slice(0, 2), null, 2));

  // Test fixtures with season 2024
  const f = await axios.get("https://v3.football.api-sports.io/fixtures", {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    params: { team: 168, season: 2024, status: "FT" },
  }).catch(e => ({ data: e.response?.data }));
  console.log("FIXTURES 2024 results:", f.data?.results);
  console.log("FIXTURES errors:", JSON.stringify(f.data?.errors));
}

run();