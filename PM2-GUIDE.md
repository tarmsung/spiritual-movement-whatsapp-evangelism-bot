# Process Management Guide

## 🚀 Running the Bot 24/7 with PM2

PM2 keeps your bot running continuously, automatically restarts it if it crashes, and ensures it starts when your computer boots.

## Installation

Install PM2 globally:
```powershell
npm install -g pm2
```

## Starting the Bot

**Start with PM2:**
```powershell
pm2 start ecosystem.config.json
```

**Alternative - Direct start:**
```powershell
pm2 start src/index.js --name evangelism-bot
```

## Useful PM2 Commands

### Monitoring & Status
```powershell
# View all running processes
pm2 list

# Monitor in real-time
pm2 monit

# View detailed info
pm2 show evangelism-bot

# View logs (live)
pm2 logs evangelism-bot

# View last 100 lines of logs
pm2 logs evangelism-bot --lines 100
```

### Control Commands
```powershell
# Stop the bot
pm2 stop evangelism-bot

# Restart the bot
pm2 restart evangelism-bot

# Delete from PM2
pm2 delete evangelism-bot

# Stop all processes
pm2 stop all

# Restart all processes
pm2 restart all
```

### Auto-Startup on Boot
```powershell
# Generate startup script
pm2 startup

# Save current process list
pm2 save

# Disable auto-startup
pm2 unstartup
```

## Logs Location

Logs are stored in:
- **Error logs:** `logs/pm2-error.log`
- **Output logs:** `logs/pm2-out.log`
- **PM2 logs:** `C:\Users\<username>\.pm2\logs\`

## Configuration

The bot is configured via `ecosystem.config.json`:
- **Auto-restart:** Yes (on crash)
- **Memory limit:** 500MB (restarts if exceeded)
- **Restart delay:** 4 seconds
- **Instances:** 1 (single instance)

## Troubleshooting

### Bot Not Starting
```powershell
# Check PM2 logs
pm2 logs evangelism-bot --err

# Check process list
pm2 list

# Restart
pm2 restart evangelism-bot
```

### Bot Keeps Crashing
```powershell
# View error logs
pm2 logs evangelism-bot --lines 50 --err

# Check memory usage
pm2 monit
```

### Clear Logs
```powershell
pm2 flush evangelism-bot
```

## Best Practices

1. **Always save after changes:**
   ```powershell
   pm2 save
   ```

2. **Monitor regularly:**
   ```powershell
   pm2 monit
   ```

3. **Backup your data** (Supabase handles daily backups automatically, but you can export data from the dashboard)

4. **Check logs** if the bot behaves unexpectedly

5. **Restart after .env changes:**
   ```powershell
   pm2 restart evangelism-bot
   ```

## Production Checklist

- [x] PM2 installed globally
- [ ] Bot started with PM2
- [ ] Startup script configured (`pm2 startup`)
- [ ] Process list saved (`pm2 save`)
- [ ] Real WhatsApp group IDs configured
- [ ] Regular database backups scheduled
- [ ] Logs being monitored

---

**Your bot will now run 24/7 with automatic restarts! 🎉**
