require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert sports betting analyst specializing in value betting.
Your job is to analyze match statistics and identify VALUE bets — situations where statistics strongly support an outcome, not just low-odds favorites.

CRITICAL RULES:
1. Return ONLY valid JSON, no extra text, no markdown, no code blocks
2. Select 3-4 picks that form a combo with combined odds between 3.00 and 4.50
   - Each individual pick must have odds between 1.40 and 2.50
   - Never include a pick with odds below 1.40 — it kills combo balance
   - Multiply the odds yourself to verify the combo lands in range before responding
3. Focus on STATISTICAL EDGES: strong form, H2H patterns, scoring trends
4. Consider all market types: Over/Under goals, BTTS, 1X2, Asian handicap, basketball totals/spreads
5. Avoid picks purely based on team reputation — base everything on data
6. If you cannot find 3-4 strong value bets, return fewer (even 0) rather than forcing bad picks
7. Keep reasons concise (1-2 sentences) but data-driven

DATA QUALITY RULES — VERY IMPORTANT:
- A match is only usable if it has AT LEAST one of: homeForm, awayForm, homeStats, awayStats with real numbers
- For basketball: only use a game if BOTH homeForm and awayForm have "played" >= 5
- For football: only use a fixture if at least one team has form data with "played" >= 5
- If a match has null/missing stats on both sides, SKIP IT ENTIRELY — do not guess or assume
- If after filtering there are fewer than 3 usable matches total, return 0 picks and explain in analysis_note
- NEVER invent or estimate stats not in the data — only reason from what you are given
- It is better to send NO picks than picks based on incomplete data

Response format (return this exact JSON structure, nothing else, no markdown wrapping):
{
  "picks": [
    {
      "match": "Team A vs Team B",
      "sport": "football",
      "pick": "Over 2.5 Goals",
      "odds": 1.75,
      "reason": "Both teams scored in 8/10 recent games. H2H avg 3.2 goals over last 5 meetings."
    }
  ],
  "analysis_note": "Brief overall note, or explanation of why no picks were made"
}`;

function preFilterMatches(matches) {
  return matches.filter((m) => {
    const hasHomeForm = m.homeForm && m.homeForm.played >= 5;
    const hasAwayForm = m.awayForm && m.awayForm.played >= 5;
    const hasHomeStats = m.homeStats && Object.keys(m.homeStats).length > 0;
    const hasAwayStats = m.awayStats && Object.keys(m.awayStats).length > 0;

    if (m.sport === "basketball") {
      return hasHomeForm && hasAwayForm;
    } else {
      return (hasHomeForm || hasAwayForm) || (hasHomeStats || hasAwayStats);
    }
  });
}

async function analyzeWithClaude(matches) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const usableMatches = preFilterMatches(matches);

  console.log(
    `📋 ${matches.length} total matches → ${usableMatches.length} pass data quality filter`
  );

  if (usableMatches.length < 3) {
    console.log(
      `⚠️  Only ${usableMatches.length} usable matches — not enough for a confident combo. Skipping.`
    );
    return [];
  }

  const matchData = JSON.stringify(usableMatches, null, 2);

  const prompt = `Analyze these ${usableMatches.length} upcoming matches and select 3-4 value bets for a combo with combined odds between 3.00 and 4.50.

All matches below have already passed a data quality check, but still apply your judgment:
- Only pick a match if the stats clearly support the outcome
- Skip any match where the data feels thin or inconclusive
- If you cannot build a confident 3-4 leg combo, return 0 picks

ODDS RULES — STRICTLY ENFORCE:
- Each pick odds must be between 1.40 and 2.50
- Before finalizing, multiply all pick odds together
- If the product is below 3.00 or above 4.50, adjust by swapping a pick or changing the line
- ONLY return picks when you have verified the combined odds land between 3.00 and 4.50

Matches:
${matchData}

- Estimated odds based on typical bookmaker lines for these market types
- Combined odds MUST land between 3.00 and 4.50 — verify by multiplying before responding
- Return ONLY raw JSON, no markdown, no code blocks, no extra text`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text.trim();

    // Robustly extract JSON — works whether Claude wraps in markdown or not
    let cleaned;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    } else {
      cleaned = text
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/gi, "")
        .trim();
    }

    const parsed = JSON.parse(cleaned);

    if (parsed.analysis_note) {
      console.log(`🧠 Claude note: ${parsed.analysis_note}`);
    }

    return parsed.picks || [];
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error("❌ Failed to parse Claude response as JSON:", err.message);
      return [];
    }
    throw err;
  }
}

module.exports = { analyzeWithClaude };