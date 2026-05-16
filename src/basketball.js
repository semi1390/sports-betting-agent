const axios = require("axios");

const BASE_URL = "https://v1.basketball.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY; // same key, different sport endpoint

const headers = {
  "x-apisports-key": API_KEY,
};

// League IDs on api-sports basketball:
// 12 = NBA, 120 = EuroLeague, 117 = EuroCup, 116 = NCAA
const LEAGUE_IDS = [12, 120, 117];

async function getBasketballMatches() {
  if (!API_KEY) throw new Error("API_FOOTBALL_KEY not set");

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [todayGames, tomorrowGames] = await Promise.all([
    fetchGames(today),
    fetchGames(tomorrow),
  ]);

  const allGames = [...todayGames, ...tomorrowGames];

  // Filter to our target leagues only
 
  const filtered = allGames.filter((g) => LEAGUE_IDS.includes(g.league.id));
  console.log(`🏀 After league filter: ${filtered.length}`);

  if (filtered.length === 0) return [];

  // Enrich top 8 to save API requests
  const enriched = await Promise.allSettled(
    filtered.slice(0, 8).map((game) => enrichGame(game))
  );


  return enriched
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
}

async function fetchGames(date) {
  const res = await axios.get(`${BASE_URL}/games`, {
    headers,
    params: { date },
  });
  // Only return games not yet started
  return (res.data.response || []).filter(
    (g) => g.status.short === "NS"
  );
}

async function enrichGame(game) {
  const homeId = game.teams.home.id;
  const awayId = game.teams.away.id;
  const leagueId = game.league.id;
  const statSeason = getStatSeason();

  function getStatSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const currentSeasonStart = month >= 9 ? year : year - 1;
  const currentSeason = `${currentSeasonStart}-${currentSeasonStart + 1}`;
  const previousSeason = `${currentSeasonStart - 1}-${currentSeasonStart}`;
  // Free plan max is 2024-2025
  const FREE_PLAN_MAX_START = 2024;
  return currentSeasonStart > FREE_PLAN_MAX_START ? previousSeason : currentSeason;
}

 
  const [homeLast10, awayLast10, homeStats, awayStats] =
    await Promise.allSettled([
      fetchLastGames(homeId, leagueId, statSeason, 10),
      fetchLastGames(awayId, leagueId, statSeason, 10),
      fetchTeamStats(homeId, leagueId, statSeason),
      fetchTeamStats(awayId, leagueId, statSeason),
    ]);


  return {
    sport: "basketball",
    id: game.id,
    match: `${game.teams.home.name} vs ${game.teams.away.name}`,
    league: game.league.name,
    date: game.date,
    homeTeam: game.teams.home.name,
    awayTeam: game.teams.away.name,
    homeForm:
      homeLast10.status === "fulfilled"
        ? summarizeForm(homeLast10.value, homeId)
        : null,
    awayForm:
      awayLast10.status === "fulfilled"
        ? summarizeForm(awayLast10.value, awayId)
        : null,
    homeStats:
      homeStats.status === "fulfilled"
        ? extractStats(homeStats.value)
        : null,
    awayStats:
      awayStats.status === "fulfilled"
        ? extractStats(awayStats.value)
        : null,
  };
}

async function fetchLastGames(teamId, leagueId, season, n) {
  const res = await axios.get(`${BASE_URL}/games`, {
    headers,
    params: {
      team: teamId,
      season,
    },
  });
  const all = res.data.response || [];
  const finished = all.filter((g) => g.status.short === "FT");
  return finished.slice(-n);
}

async function fetchTeamStats(teamId, leagueId, season) {
  const res = await axios.get(`${BASE_URL}/teams/statistics`, {
    headers,
    params: { team: teamId, league: leagueId, season },
  });
  return res.data.response || null;
}

function extractStats(stats) {
  if (!stats || !stats.points) return null;
  return {
    avgPointsScored: stats.points?.for?.average?.all || "N/A",
    avgPointsConceded: stats.points?.against?.average?.all || "N/A",
    homeAvgScored: stats.points?.for?.average?.home || "N/A",
    awayAvgScored: stats.points?.for?.average?.away || "N/A",
  };
}

function summarizeForm(games, teamId) {
  if (!games || games.length === 0) return { played: 0, form: "" };

  let wins = 0, losses = 0, totalFor = 0, totalAgainst = 0;
  let formStr = "";

  games.forEach((g) => {
    const isHome = g.teams.home.id === teamId;
    const myScore = isHome ? g.scores.home.total : g.scores.away.total;
    const oppScore = isHome ? g.scores.away.total : g.scores.home.total;

    if (!myScore || !oppScore) return;

    totalFor += myScore;
    totalAgainst += oppScore;

    if (myScore > oppScore) { wins++; formStr += "W"; }
    else { losses++; formStr += "L"; }
  });

  const played = wins + losses;
  return {
    played,
    wins,
    losses,
    form: formStr,
    avgPointsScored: played ? (totalFor / played).toFixed(1) : "0",
    avgPointsConceded: played ? (totalAgainst / played).toFixed(1) : "0",
    avgTotal: played ? ((totalFor + totalAgainst) / played).toFixed(1) : "0",
  };
}

module.exports = { getBasketballMatches };