require("dotenv").config();
const axios = require("axios");

axios.get("https://v1.basketball.api-sports.io/status", {
  headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
}).then(r => console.log(JSON.stringify(r.data, null, 2)))
  .catch(e => console.error(e.response?.data || e.message));