require("dotenv").config();
const axios = require("axios");

const API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = "https://api.the-odds-api.com/v4/sports";

const FOOTBALL_LEAGUES = [
  "soccer_italy_serie_a",
  "soccer_spain_la_liga",
  "soccer_france_ligue_one",
  "soccer_germany_bundesliga",
  "soccer_epl",
  "soccer_usa_mls",
  "soccer_uefa_champs_league",
  "soccer_uefa_europa_league",
];

const BASKETBALL_LEAGUES = [
  "basketball_nba",
  "basketball_euroleague",
];

async function fetchOddsForSport(sportKey) {
  const res = await axios.get(`${BASE_URL}/${sportKey}/odds`, {
    params: {
      apiKey: API_KEY,
      regions: "eu",
      markets: "h2h,totals",
      oddsFormat: "decimal",
    },
  });
  console.log(`📊 ${sportKey}: ${res.data.length} games | requests left: ${res.headers["x-requests-remaining"]}`);
  return res.data || [];
}

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/\bfc\b|\bsc\b|\bcf\b|\bac\b|\bbc\b|\bbk\b|\bsk\b|\bfk\b|\bsv\b|\bvv\b|\bif\b|\bafc\b|\bbfc\b|\bbc\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function teamsMatch(name1, name2) {
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

function findOddsForMatch(match, oddsGames) {
  const [homeName, awayName] = match.match.split(" vs ");

  for (const game of oddsGames) {
    const homeMatch = teamsMatch(homeName, game.home_team);
    const awayMatch = teamsMatch(awayName, game.away_team);
    if (homeMatch && awayMatch) return extractOdds(game);

    const homeMatch2 = teamsMatch(homeName, game.away_team);
    const awayMatch2 = teamsMatch(awayName, game.home_team);
    if (homeMatch2 && awayMatch2) return extractOdds(game);
  }
  return null;
}

function extractOdds(game) {
  const result = {
    homeWin: null,
    draw: null,
    awayWin: null,
    over15: null, under15: null,
    over25: null, under25: null,
    over35: null, under35: null,
    overPoints: null, underPoints: null,
    bookmaker: null,
  };

  if (!game.bookmakers || game.bookmakers.length === 0) return result;

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
        const p = o.point;
        const name = o.name;

        // Football totals (goals)
        if (p === 1.5 && name === "Over") result.over15 = o.price;
        if (p === 1.5 && name === "Under") result.under15 = o.price;
        if (p >= 2.0 && p <= 3.0 && name === "Over") result.over25 = o.price;
        if (p >= 2.0 && p <= 3.0 && name === "Under") result.under25 = o.price;
        if (p >= 3.0 && p <= 4.0 && name === "Over") result.over35 = o.price;
        if (p >= 3.0 && p <= 4.0 && name === "Under") result.under35 = o.price;

        // Basketball totals (points 150-280)
        if (p >= 150 && name === "Over") result.overPoints = o.price;
        if (p >= 150 && name === "Under") result.underPoints = o.price;
      });
    }
  });

  return result;
}

function matchPickToOdds(pickText, odds) {
  const p = pickText.toLowerCase();

  // Basketball points totals (Over 218.5, Under 225 etc)
  if (p.includes("over") && /\d{3}/.test(p)) return odds.overPoints;
  if (p.includes("under") && /\d{3}/.test(p)) return odds.underPoints;
  if (p.includes("over") && p.includes("point")) return odds.overPoints;
  if (p.includes("under") && p.includes("point")) return odds.underPoints;

  // Football totals
  if (p.includes("over 1.5") || p.includes("over1.5")) return odds.over15;
  if (p.includes("under 1.5") || p.includes("under1.5")) return odds.under15;
  if (p.includes("over 2") || p.includes("over2")) return odds.over25;
  if (p.includes("under 2") || p.includes("under2")) return odds.under25;
  if (p.includes("over 3") || p.includes("over3")) return odds.over35;
  if (p.includes("under 3") || p.includes("under3")) return odds.under35;

  // BTTS
  if ((p.includes("btts") || p.includes("both teams to score")) && p.includes("no")) return odds.under15;
  if (p.includes("btts") || p.includes("both teams to score")) return odds.over15;

  // 1X2
  if (p.includes("draw")) return odds.draw;
  if (p.includes("or draw")) return odds.homeWin;
  if (p.includes("away win") || p.includes("away to win")) return odds.awayWin;
  if (p.includes("home win") || p.includes("home to win")) return odds.homeWin;
  if (p.includes("to win") || p.includes(" win")) return odds.homeWin;

  // Handicap
  if (p.includes("-") || p.includes("+") || p.includes("handicap") || p.includes("ah")) {
    return p.includes("away") ? odds.awayWin : odds.homeWin;
  }

  return null;
}

async function enrichPicksWithRealOdds(picks) {
  if (!API_KEY) {
    console.log("⚠️ ODDS_API_KEY not set — skipping odds enrichment");
    return picks;
  }

  const allOddsGames = [];
  const footballPicks = picks.filter(p => p.sport === "football");
  const basketballPicks = picks.filter(p => p.sport === "basketball");

  if (footballPicks.length > 0) {
    for (const key of FOOTBALL_LEAGUES) {
      try {
        const games = await fetchOddsForSport(key);
        allOddsGames.push(...games);
      } catch (err) {
        console.log(`⚠️ Could not fetch odds for ${key}`);
      }
    }
  }

  if (basketballPicks.length > 0) {
    for (const key of BASKETBALL_LEAGUES) {
      try {
        const games = await fetchOddsForSport(key);
        allOddsGames.push(...games);
      } catch (err) {
        console.log(`⚠️ Could not fetch odds for ${key}`);
      }
    }
  }

  console.log(`🎲 Fetched real odds for ${allOddsGames.length} games total`);

  return picks.map((pick) => {
    const realOdds = findOddsForMatch(pick, allOddsGames);

    if (!realOdds) {
      console.log(`⚠️ No real odds found for: ${pick.match} — keeping Claude estimate`);
      return pick;
    }

    const matchedOdds = matchPickToOdds(pick.pick, realOdds);

    if (matchedOdds) {
      console.log(`✅ ${pick.match}: Claude=${pick.odds} → Real=${matchedOdds} (${realOdds.bookmaker})`);
      return { ...pick, odds: matchedOdds };
    }

    console.log(`⚠️ Pick type "${pick.pick}" not matched — keeping Claude estimate`);
    return pick;
  });
}

module.exports = { enrichPicksWithRealOdds };