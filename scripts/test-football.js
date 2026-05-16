require("dotenv").config();
const { getFootballMatches } = require("../src/football");

console.log("Testing API-Football connection...");
getFootballMatches()
  .then((matches) => {
    console.log(`✅ Got ${matches.length} matches`);
    if (matches.length > 0) {
      console.log("\nSample match:");
      console.log(JSON.stringify(matches[0], null, 2));
    }
  })
  .catch((err) => console.error("❌ Failed:", err.message));
