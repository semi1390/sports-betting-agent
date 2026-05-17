require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert sports betting analyst specializing in value betting.
Your job is to analyze match statistics and identify VALUE bets — situations where statistics strongly support an outcome, not just low-odds favorites.

CRITICAL RULES:
1. Return ONLY a single JSON object. No text before it, no text after it, no markdown, no code blocks, no recalculations shown.
2. Select 3-4 picks that form a combo with combined odds between 3.00 and 4.50
   - Each individual pick must have odds between 1.40 and 2.50
   - Never include a pick with odds below 1.40 — it kills combo balance
   - Do your math internally before responding — only output the final result
3. Focus on STATISTICAL EDGES: strong form, H2H patterns, scoring trends
4. Consider all market types: Over/Under goals, BTTS, 1X2, Asian handicap, basketball totals/spreads
5. Avoid picks purely based on team reputation — base everything on data
6. If you cannot find a valid combo, return the JSON with an empty picks array
7. Keep reasons concise (1-2 sentences) but data-driven

DATA QUALITY RULES — VERY IMPORTANT:
- A match is only usable if it has AT LEAST one of: homeForm, awayForm, homeStats, awayStats with real numbers
- For basketball: only use a game if BOTH homeForm and awayForm have "played" >= 5
- For football: only use a fixture if at least one team has form data with "played" >= 5
- If a match has null/missing stats on both sides, SKIP IT ENTIRELY — do not guess or assume
- If after filtering there are fewer than 3 usable matches total, return empty picks array
- NEVER invent or estimate stats not in the data — only reason from what you are given

Your response must be exactly this structure and nothing else:
{"picks":[{"match":"Team A vs Team B","sport":"football","pick":"Over 2.5 Goals","odds":1.75,"reason":"Reason here."}],"analysis_note":"Note here"}`;

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

function extractJSON(text) {
  // Remove markdown code blocks
  const stripped = text
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/gi, "")
    .trim();

  // Split by lines and find all positions where a { starts a new JSON block
  // Try parsing from each { found, take the last one that successfully parses
  let lastValid = null;
  let searchFrom = 0;

  while (true) {
    const start = stripped.indexOf("{", searchFrom);
    if (start === -1) break;

    // Find matching closing brace by counting depth
    let depth = 0;
    let end = -1;
    for (let i = start; i < stripped.length; i++) {
      if (stripped[i] === "{") depth++;
      else if (stripped[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) break;

    const candidate = stripped.slice(start, end + 1);
    try {
      const parsed = JSON.parse(candidate);
      // Only accept if it has the expected structure
      if (parsed.picks !== undefined) {
        lastValid = candidate;
      }
    } catch (e) {}

    searchFrom = start + 1;
  }

  return lastValid || stripped;
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

  const prompt = `Analyze these ${usableMatches.length} upcoming matches and find 3-4 value bets with combined odds between 3.00 and 4.50.

STRICT OUTPUT RULES:
- Output ONE JSON object only — no text before, no text after, no markdown
- Do all your thinking internally — only output the final JSON result
- Do NOT show recalculations or working — just the answer
- If no valid combo exists, return {"picks":[],"analysis_note":"reason"}

ODDS RULES:
- Each pick: odds between 1.40 and 2.50
- Combined: multiply all odds, must land between 3.00 and 4.50
- Verify internally before outputting

Matches:
${matchData}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text.trim();
    const cleaned = extractJSON(text);
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