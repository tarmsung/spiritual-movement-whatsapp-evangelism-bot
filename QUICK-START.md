# Quick Start Commands

## First Time Setup

```powershell
# 1. Install PM2 (already done ✓)
npm install -g pm2

# 2. Start the bot
pm2 start ecosystem.config.json

# 3. Set up auto-start on boot
pm2 startup

# 4. Save the process list
pm2 save
```

## Daily Use Commands

```powershell
# Check if bot is running
pm2 list

# View bot logs (live)
pm2 logs evangelism-bot

# Restart the bot
pm2 restart evangelism-bot

# Stop the bot
pm2 stop evangelism-bot

# Monitor real-time stats
pm2 monit
```

## View Database Data

```powershell
node scripts/view-data.js
```

---

**Your bot is now set up to run 24/7! 🎉**

See `PM2-GUIDE.md` for detailed documentation.
