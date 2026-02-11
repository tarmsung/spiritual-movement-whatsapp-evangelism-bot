# Windows Auto-Startup Guide

## Method 1: Startup Folder (Easiest)

1. Save PM2 process list:
   ```powershell
   pm2 save
   ```

2. Press `Win + R` and type: `shell:startup`

3. Create a shortcut to `start-bot.bat` in that folder

4. Done! Bot will start on Windows login

## Method 2: Task Scheduler (More Reliable)

1. Save PM2 process list:
   ```powershell
   pm2 save
   ```

2. Open Task Scheduler:
   - Press `Win + R`
   - Type `taskschd.msc`
   - Press Enter

3. Create a new task:
   - Click "Create Basic Task"
   - Name: "WhatsApp Evangelism Bot"
   - Trigger: "When the computer starts"
   - Action: "Start a program"
   - Program: `C:\Users\user\Documents\SPIRITUALMOVEMENT WHATSAPP-WEB.JS\start-bot.bat`
   - Finish

4. Edit the task properties:
   - Right-click the task → Properties
   - Check "Run with highest privileges"
   - Under "Conditions", uncheck "Start only if on AC power"
   - Click OK

## Method 3: pm2-windows-startup (Alternative)

Install the Windows-specific package:
```powershell
npm install pm2-windows-startup -g
pm2-startup install
```

Then save your processes:
```powershell
pm2 save
```

## Verify Auto-Startup

After setting up auto-startup:
1. Restart your computer
2. Open PowerShell
3. Run: `pm2 list`
4. You should see the bot running automatically!

---

**Recommendation:** Use Method 1 (Startup Folder) for simplicity, or Method 2 (Task Scheduler) for more reliability.
