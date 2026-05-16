# 🤖 Sports Betting Agent — Full Setup Guide

## What You're Building
A Node.js bot that runs 3x/day on the cloud, analyzes football and basketball
stats using AI, and sends value bet combos (2.80–3.20 odds) to your Telegram.

---

## STEP 1 — Get Your API Keys

### A) API-Football (Football Data)
1. Go to https://dashboard.api-football.com
2. Sign up for a free account
3. The free plan gives you **100 requests/day** — enough for this bot
4. Copy your API Key from the dashboard
5. Save it as: `API_FOOTBALL_KEY`

### B) Ball Don't Lie (NBA Data)
1. Go to https://app.balldontlie.io
2. Sign up for a free account
3. Free plan covers NBA games, team stats, season averages
4. Copy your API Key
5. Save it as: `BALLDONTLIE_API_KEY`

### C) Claude AI API (Anthropic)
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Go to Settings → API Keys → Create Key
4. Copy the key (starts with `sk-ant-...`)
5. **Add credits** (minimum $5) under Billing — the agent uses ~$0.01–0.05/day
6. Save it as: `ANTHROPIC_API_KEY`

### D) Telegram Bot
**Create the bot:**
1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow the prompts — choose a name and username
4. BotFather gives you a token like: `7123456789:AAF...`
5. Save it as: `TELEGRAM_BOT_TOKEN`

**Get your Chat ID:**
1. Start a conversation with your new bot (click Start)
2. Search Telegram for `@userinfobot`
3. Send it `/start` — it replies with your User ID (a number)
4. That number is your: `TELEGRAM_CHAT_ID`

---

## STEP 2 — Set Up the Project Locally

```bash
# Clone or create your project folder
mkdir sports-betting-agent && cd sports-betting-agent

# Copy all the provided files into this folder
# Then install dependencies:
npm install

# Create your .env file
cp .env.example .env
```

Open `.env` and fill in all your keys:
```
API_FOOTBALL_KEY=abc123...
BALLDONTLIE_API_KEY=xyz789...
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=7123456789:AAF...
TELEGRAM_CHAT_ID=987654321
RUN_ON_STARTUP=false
```

---

## STEP 3 — Test Each Component

Run these tests one at a time:

```bash
# Test Telegram (you should get a message on your phone)
npm run test:telegram

# Test football API (should print match data)
npm run test:football

# Test basketball API (should print NBA games)
npm run test:basketball

# Do a full dry run (sends real picks to Telegram)
RUN_ON_STARTUP=true npm start
```

Fix any errors before deploying (see Troubleshooting section below).

---

## STEP 4 — Deploy to Railway (Recommended)

Railway is the easiest free hosting option with persistent uptime.

### 4A) Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/sports-betting-agent.git
git push -u origin main
```

### 4B) Deploy on Railway
1. Go to https://railway.app and sign up with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `sports-betting-agent` repo
4. Railway auto-detects Node.js and runs `npm start`

### 4C) Add Environment Variables on Railway
1. Click your project → **Variables** tab
2. Click **Raw Editor** and paste all your env vars:
```
API_FOOTBALL_KEY=abc123...
BALLDONTLIE_API_KEY=xyz789...
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=7123456789:AAF...
TELEGRAM_CHAT_ID=987654321
RUN_ON_STARTUP=false
```
3. Click **Update Variables** — Railway restarts automatically

### 4D) Verify It's Running
- Click **Deployments** → view logs
- You should see: `✅ Scheduler active. Waiting for next run...`
- The bot will run at 7am, 1pm, 7pm UTC automatically

**Railway Free Tier:** 500 hours/month — enough for 24/7 uptime.
If you hit limits, add a credit card (Railway charges ~$5/month for always-on).

---

## STEP 5 (Alternative) — Deploy to Render

1. Go to https://render.com and sign up
2. Click **New** → **Web Service**
3. Connect GitHub → select your repo
4. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
5. Add environment variables under **Environment** tab
6. Click **Create Web Service**

**Note on Render Free Tier:** Free instances spin down after 15 minutes of
inactivity. Since this is a cron bot (not a web server), use the **Background
Worker** type instead of Web Service — it stays alive continuously.

---

## Adjusting the Schedule

The schedule is in `index.js`. Times are UTC.
Lagos is UTC+1, so to run at 8am, 2pm, 8pm Lagos time:

```javascript
const schedule = ["0 7 * * *", "0 13 * * *", "0 19 * * *"]; // UTC = 8am/2pm/8pm Lagos
```

Use https://crontab.guru to build custom cron expressions.

---

## Adjusting the Football Leagues

In `src/football.js`, edit the `LEAGUE_IDS` array:
```javascript
// Common league IDs:
// 39  = English Premier League
// 140 = La Liga (Spain)
// 135 = Serie A (Italy)
// 78  = Bundesliga (Germany)
// 61  = Ligue 1 (France)
// 2   = UEFA Champions League
// 3   = UEFA Europa League
// 197 = Nigerian Professional Football League
// 480 = CAF Champions League
const LEAGUE_IDS = [39, 140, 135, 78, 61, 2, 3];
```

---

## Troubleshooting

### "API_FOOTBALL_KEY not set"
→ Make sure `.env` file exists and has the correct key name

### Telegram message not arriving
→ Make sure you started a chat with your bot before the bot sends a message
→ Double-check CHAT_ID (must be a number, not your username)
→ Try `npm run test:telegram` to isolate the issue

### "No matches found"
→ API-Football free plan has limited historical data; check the date
→ Ball Don't Lie may not have games scheduled — NBA off-season is June–October

### Claude returns invalid JSON
→ The agent handles this — check logs for "Failed to parse Claude response"
→ If persistent, the system prompt in `src/claude.js` can be made stricter

### Railway deploy fails
→ Check that `package.json` has `"start": "node index.js"` in scripts
→ Node version must be ≥18 (Railway uses 18+ by default)

### API-Football 401 error
→ Your key may be wrong or your free trial expired
→ Check your dashboard at https://dashboard.api-football.com

---

## Cost Estimates (Monthly)
| Service | Free Tier | Paid |
|---|---|---|
| API-Football | 100 req/day free | $9.99/mo for more |
| Ball Don't Lie | Free tier available | $9.99/mo |
| Claude AI | Pay per use | ~$1–3/mo at 3x/day |
| Railway | 500 hrs free | ~$5/mo always-on |
| **Total** | **~$0** to start | **~$6–18/mo** |

---

## File Structure
```
sports-betting-agent/
├── index.js              ← Entry point + cron scheduler
├── package.json
├── .env.example          ← Copy to .env and fill in
├── .gitignore
├── src/
│   ├── agent.js          ← Main orchestrator
│   ├── football.js       ← API-Football data fetcher
│   ├── basketball.js     ← Ball Don't Lie data fetcher
│   ├── claude.js         ← Claude AI analysis
│   └── telegram.js       ← Telegram message sender
└── scripts/
    ├── test-telegram.js
    ├── test-football.js
    └── test-basketball.js
```
