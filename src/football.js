require("dotenv").config();
const axios = require("axios");

const BASE_URL = "https://v3.football.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY;

const headers = {
  "x-apisports-key": API_KEY,
};

// 39=EPL, 140=La Liga, 135=Serie A, 78=Bundesliga, 61=Ligue 1
// 2=Champions League, 3=Europa League, 848=Conference League
const LEAGUE_IDS = [39, 140, 135, 78, 61, 2, 3];

async function getFootballMatches() {
  if (!API_KEY) throw new Error("API_FOOTBALL_KEY not set");

  const dates = [0, 1, 2].map(d =>
    new Date(Date.now() + d * 86400000).toISOString().split("T")[0]
  );

  const allFixturesRaw = await Promise.all(dates.map(fetchFixtures));
  const allFixtures = allFixturesRaw.flat();
  const filtered = allFixtures.filter((f) => LEAGUE_IDS.includes(f.league.id));

  if (filtered.length === 0) return [];

  console.log(`⚽ Found ${filtered.length} football fixtures`);

  const enriched = [];
  for (const fixture of filtered.slice(0, 8)) {
    await delay(400);
    const result = await enrichFixture(fixture).catch((e) => {
      console.error(`⚠️ Failed to enrich ${fixture.teams.home.name} vs ${fixture.teams.away.name}:`, e.message);
      return null;
    });
    if (result) enriched.push(result);
  }

  return enriched;
}

async function fetchFixtures(date) {
  const res = await axios.get(`${BASE_URL}/fixtures`, {
    headers,
    params: { date, status: "NS" },
  });
  return res.data.response || [];
}

async function enrichFixture(fixture) {
  const fixtureId = fixture.fixture.id;
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const leagueId = fixture.league.id;

  await delay(400);
  const prediction = await fetchPrediction(fixtureId).catch(() => null);

  await delay(400);
  const standings = await fetchStandings(leagueId).catch(() => []);
  const homeStanding = standings.find((s) => s.team.id === homeId) || null;
  const awayStanding = standings.find((s) => s.team.id === awayId) || null;

  await delay(400);
  const h2hRaw = await fetchH2H(homeId, awayId).catch(() => []);

  return {
    sport: "football",
    id: fixtureId,
    match: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
    league: fixture.league.name,
    date: fixture.fixture.date,
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    prediction: prediction
      ? {
          advice: prediction.predictions?.advice,
          homeWinPct: prediction.predictions?.percent?.home,
          drawPct: prediction.predictions?.percent?.draw,
          awayWinPct: prediction.predictions?.percent?.away,
          goalsHome: prediction.predictions?.goals?.home,
          goalsAway: prediction.predictions?.goals?.away,
        }
      : null,
    homeStats: homeStanding ? extractStandingStats(homeStanding) : null,
    awayStats: awayStanding ? extractStandingStats(awayStanding) : null,
    h2h: summarizeH2H(h2hRaw),
  };
}

async function fetchPrediction(fixtureId) {
  const res = await axios.get(`${BASE_URL}/predictions`, {
    headers,
    params: { fixture: fixtureId },
  });
  return res.data.response?.[0] || null;
}

async function fetchStandings(leagueId) {
  const season = getLatestAllowedSeason();
  const res = await axios.get(`${BASE_URL}/standings`, {
    headers,
    params: { league: leagueId, season },
  });
  return res.data.response?.[0]?.league?.standings?.[0] || [];
}

async function fetchH2H(homeId, awayId) {
  const season = getLatestAllowedSeason();
  const res = await axios.get(`${BASE_URL}/fixtures`, {
    headers,
    params: { h2h: `${homeId}-${awayId}`, season, status: "FT" },
  });
  return res.data.response || [];
}

function getLatestAllowedSeason() {
  // Free plan allows up to season 2024
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const currentSeasonStart = month >= 7 ? year : year - 1;
  const FREE_PLAN_MAX = 2024;
  return Math.min(currentSeasonStart, FREE_PLAN_MAX);
}

function extractStandingStats(s) {
  const played = s.all?.played || 1;
  return {
    rank: s.rank,
    points: s.points,
    form: s.form,
    goalsDiff: s.goalsDiff,
    played: s.all?.played,
    wins: s.all?.win,
    draws: s.all?.draw,
    losses: s.all?.lose,
    goalsFor: s.all?.goals?.for,
    goalsAgainst: s.all?.goals?.against,
    avgGoalsFor: (s.all?.goals?.for / played).toFixed(2),
    avgGoalsAgainst: (s.all?.goals?.against / played).toFixed(2),
    homeWins: s.home?.win,
    homeGoalsFor: s.home?.goals?.for,
    homeGoalsAgainst: s.home?.goals?.against,
    awayWins: s.away?.win,
    awayGoalsFor: s.away?.goals?.for,
    awayGoalsAgainst: s.away?.goals?.against,
  };
}

function summarizeH2H(fixtures) {
  if (!fixtures || fixtures.length === 0) return { played: 0 };

  let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0, btts = 0;

  fixtures.forEach((f) => {
    const hg = f.goals?.home || 0;
    const ag = f.goals?.away || 0;
    totalGoals += hg + ag;
    if (hg > ag) homeWins++;
    else if (ag > hg) awayWins++;
    else draws++;
    if (hg > 0 && ag > 0) btts++;
  });

  return {
    played: fixtures.length,
    homeWins,
    awayWins,
    draws,
    avgGoals: (totalGoals / fixtures.length).toFixed(2),
    bttsRate: ((btts / fixtures.length) * 100).toFixed(0) + "%",
  };
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { getFootballMatches };