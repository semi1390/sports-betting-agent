require("dotenv").config();
const { getBasketballMatches } = require("../src/basketball");

console.log("Testing Ball Don't Lie API connection...");
getBasketballMatches()
  .then((matches) => {
    console.log(`✅ Got ${matches.length} NBA games`);
    if (matches.length > 0) {
      console.log("\nSample game:");
      console.log(JSON.stringify(matches[0], null, 2));
    }
  })
  .catch((err) => console.error("❌ Failed:", err.message));
