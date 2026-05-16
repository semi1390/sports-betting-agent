require("dotenv").config();
const axios = require("axios");

const API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = "https://api.the-odds-api.com/v4/sports";

// Map our league names to The Odds API sport keys
const LEAGUE_MAP = {
  // Football
  "Premier League": "soccer_england_premier_league",
  "La Liga": "soccer_spain_la_liga",
  "Serie A": "soccer_italy_serie_a",
  "Ligue 1": "soccer_france_ligue_one",
  "Bundesliga": "soccer_germany_bundesliga",
  "UEFA Champions League": "soccer_uefa_champs_league",
  "UEFA Europa League": "soccer_uefa_europa_league",
  "MLS": "soccer_usa_mls",
  // Basketball
  "NBA": "basketball_nba",
  "ACB": "basketball_spain_acb",
  "EuroLeague": "basketball_euroleague",
};

// Fetch all upcoming odds for a sport key
async function fetchOddsForSport(sportKey) {
  const res = await axios.get(`${BASE_URL}/${sportKey}/odds`, {
    params: {
      apiKey: API_KEY,
      regions: "eu",
      markets: "h2h,totals",
      oddsFormat: "decimal",
    },
  });
  console.log(`📊 Odds requests remaining: ${res.headers["x-requests-remaining"]}`);
  return res.data || [];
}

// Normalize team name for fuzzy matching
function normalize(name) {
  return name
    .toLowerCase()
    .replace(/\s+(fc|sc|cf|ac|bc|bk|sk|fk|1\.|sv|vv|if|afc|bfc)$/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Find best odds match for a given match
function findOddsForMatch(match, oddsGames) {
  const [homeName, awayName] = match.match.split(" vs ");
  const normHome = normalize(homeName);
  const normAway = normalize(awayName);

  for (const game of oddsGames) {
    const normOddsHome = normalize(game.home_team);
    const normOddsAway = normalize(game.away_team);

    const homeMatch = normOddsHome.includes(normHome) || normHome.includes(normOddsHome);
    const awayMatch = normOddsAway.includes(normAway) || normAway.includes(normOddsAway);

    if (homeMatch && awayMatch) {
      return extractOdds(game);
    }
  }
  return null;
}

// Extract useful odds from a game object
function extractOdds(game) {
  const result = {
    homeWin: null,
    draw: null,
    awayWin: null,
    over25: null,
    under25: null,
    over35: null,
    under35: null,
    bookmaker: null,
  };

  if (!game.bookmakers || game.bookmakers.length === 0) return result;

  // Pick first available bookmaker
  const bookmaker = game.bookmakers[0];
  result.bookmaker = bookmaker.title;

  bookmaker.markets.forEach((market) => {
    if (market.key === "h2h") {
      market.outcomes.forEach((o) => {
        if (o.name === game.home_team) result.homeWin = o.price;
        else if (o.name === game.away_team) result.awayWin = o.price;
        else if (o.name === "Draw") result.draw = o.price;
      });
    }

    if (market.key === "totals") {
      market.outcomes.forEach((o) => {
        if (o.point === 2.5 && o.name === "Over") result.over25 = o.price;
        if (o.point === 2.5 && o.name === "Under") result.under25 = o.price;
        if (o.point === 3.5 && o.name === "Over") result.over35 = o.price;
        if (o.point === 3.5 && o.name === "Under") result.under35 = o.price;
      });
    }
  });

  return result;
}

// Main function — enrich picks with real odds
async function enrichPicksWithRealOdds(picks) {
  if (!API_KEY) {
    console.log("⚠️ ODDS_API_KEY not set — skipping odds enrichment");
    return picks;
  }

  // Get unique leagues from picks
  const leagueKeys = [...new Set(
    picks.map(p => {
      const match = Object.entries(LEAGUE_MAP).find(([league]) =>
        p.match.includes(league) || p.league === league
      );
      return match ? match[1] : null;
    }).filter(Boolean)
  )];

  // Also add sport-based keys
  picks.forEach(p => {
    if (p.sport === "basketball" && !leagueKeys.includes("basketball_nba")) {
      leagueKeys.push("basketball_nba");
      leagueKeys.push("basketball_euroleague");
    }
    if (p.sport === "football") {
      // Add all football leagues since we don't know which one
      ["soccer_spain_la_liga", "soccer_germany_bundesliga",
       "soccer_england_premier_league", "soccer_italy_serie_a",
       "soccer_france_ligue_one"].forEach(k => {
        if (!leagueKeys.includes(k)) leagueKeys.push(k);
      });
    }
  });

  // Fetch odds for all relevant sports
  const allOddsGames = [];
  for (const key of leagueKeys) {
    try {
      const games = await fetchOddsForSport(key);
      allOddsGames.push(...games);
    } catch (err) {
      console.log(`⚠️ Could not fetch odds for ${key}`);
    }
  }

  console.log(`🎲 Fetched odds for ${allOddsGames.length} games total`);

  // Match picks to real odds
  return picks.map((pick) => {
    const realOdds = findOddsForMatch(pick, allOddsGames);

    if (!realOdds) {
      console.log(`⚠️ No real odds found for: ${pick.match}`);
      return { ...pick, realOdds: null };
    }

    // Find the real odd that matches the pick type
    const matchedOdds = matchPickToOdds(pick.pick, realOdds);

    if (matchedOdds) {
      console.log(`✅ ${pick.match}: Claude=${pick.odds} → Real=${matchedOdds} (${realOdds.bookmaker})`);
      return { ...pick, odds: matchedOdds, realOdds };
    }

    console.log(`⚠️ Could not match pick type "${pick.pick}" to real odds for ${pick.match}`);
    return { ...pick, realOdds };
  });
}

// Match a pick description to the right odds value
function matchPickToOdds(pickText, odds) {
  const p = pickText.toLowerCase();

  if (p.includes("home win") || p.includes("to win") && !p.includes("away")) return odds.homeWin;
  if (p.includes("away win") || p.includes("away") && p.includes("win")) return odds.awayWin;
  if (p.includes("draw")) return odds.draw;
  if (p.includes("or draw") && p.includes("home")) return odds.homeWin && odds.draw
    ? parseFloat(Math.max(odds.homeWin, odds.draw).toFixed(2)) : null;
  if (p.includes("over 2.5")) return odds.over25;
  if (p.includes("under 2.5")) return odds.under25;
  if (p.includes("over 3.5")) return odds.over35;
  if (p.includes("under 3.5")) return odds.under35;

  return null;
}

module.exports = { enrichPicksWithRealOdds };