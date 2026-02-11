# VPS Deployment Guide

## 🌐 Recommended VPS Providers

### Budget-Friendly Options

1. **Contabo** (Best Value)
   - Price: $4.50/month
   - RAM: 4GB
   - Storage: 50GB SSD
   - Perfect for this bot
   - [Sign up](https://contabo.com/)

2. **DigitalOcean**
   - Price: $6/month
   - RAM: 1GB
   - Storage: 25GB SSD
   - Easy to use
   - [Sign up](https://www.digitalocean.com/)

3. **Hostinger VPS**
   - Price: $5.99/month
   - RAM: 4GB
   - Storage: 50GB
   - Good support
   - [Sign up](https://www.hostinger.com/)

4. **Vultr**
   - Price: $6/month
   - RAM: 1GB
   - Storage: 25GB SSD
   - Multiple locations
   - [Sign up](https://www.vultr.com/)

**Recommendation:** Start with **Contabo** or **DigitalOcean** for best value.

## 📋 Prerequisites

- VPS with Ubuntu 20.04 or 22.04 (recommended)
- SSH access to your VPS
- Domain name (optional, for easier access)

## 🚀 Step-by-Step Deployment

### Step 1: Set Up Your VPS

1. **Create a VPS** with Ubuntu 22.04 LTS
2. **Note down:**
   - Server IP address
   - Root password
   - SSH port (usually 22)

### Step 2: Connect to Your VPS

**From Windows (using PowerShell):**
```powershell
ssh root@YOUR_SERVER_IP
```

Or use **PuTTY** for a GUI SSH client.

### Step 3: Initial Server Setup

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installation
node --version
npm --version

# Install Git
apt install -y git

# Install PM2 globally
npm install -g pm2

# Install build tools (required for better-sqlite3)
apt install -y build-essential python3
```

### Step 4: Create a Non-Root User (Security Best Practice)

```bash
# Create new user
adduser botuser

# Add to sudo group
usermod -aG sudo botuser

# Switch to new user
su - botuser
```

### Step 5: Upload Your Bot to VPS

**Option A: Using Git (Recommended)**

On your local PC:
```powershell
# Initialize git in your project (if not already done)
cd "C:\Users\user\Documents\SPIRITUALMOVEMENT WHATSAPP-WEB.JS"
git init
git add .
git commit -m "Initial commit"

# Push to GitHub/GitLab (create repo first)
git remote add origin https://github.com/yourusername/evangelism-bot.git
git push -u origin main
```

On your VPS:
```bash
# Clone your repository
cd ~
git clone https://github.com/yourusername/evangelism-bot.git
cd evangelism-bot
```

**Option B: Using SCP (Direct Upload)**

From your local PC:
```powershell
# Upload project folder to VPS
scp -r "C:\Users\user\Documents\SPIRITUALMOVEMENT WHATSAPP-WEB.JS" root@YOUR_SERVER_IP:/home/botuser/evangelism-bot
```

### Step 6: Set Up the Bot on VPS

```bash
# Navigate to project
cd ~/evangelism-bot

# Install dependencies
npm install

# Create .env file
nano .env
```

**Copy your .env contents:**
```env
CHURCH_NAME=Spiritual Movement
WAKE_PHRASE=evangelism
ADMIN_NUMBERS=263771772984@s.whatsapp.net
OPENAI_API_KEY=
REPORT_SCHEDULE=0 9 1 * *
DATABASE_PATH=./data/evangelism.db
LOG_LEVEL=info
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

### Step 7: Start the Bot with PM2

```bash
# Start the bot
pm2 start ecosystem.config.json

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
# Copy and run the command it outputs
pm2 save

# Check status
pm2 list
pm2 logs evangelism-bot
```

### Step 8: Scan QR Code

The bot will generate a QR code. You need to see it:

**Option 1: View in terminal** (if QR displays)
```bash
pm2 logs evangelism-bot
```

**Option 2: Enable remote display**
```bash
# Install screen
apt install screen

# Start a screen session
screen -S whatsapp-bot

# Run bot in screen
cd ~/evangelism-bot
npm start

# Scan the QR code that appears
# After scanning, detach: Ctrl+A then D
```

After scanning, stop the manual process and use PM2:
```bash
# Kill the manual process
Ctrl+C

# Start with PM2
pm2 start ecosystem.config.json
pm2 save
```

### Step 9: Update Group IDs

Once the bot is running and connected:
1. Add bot to your WhatsApp groups
2. Check logs for group IDs: `pm2 logs evangelism-bot`
3. Update database with real group IDs

## 🔒 Security Best Practices

### 1. Set Up Firewall

```bash
# Install UFW
apt install ufw

# Allow SSH
ufw allow 22/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

### 2. Disable Root Login

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Change this line:
PermitRootLogin no

# Restart SSH
sudo systemctl restart sshd
```

### 3. Regular Backups

```bash
# Create backup script
nano ~/backup-bot.sh
```

Add this content:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf ~/backups/evangelism-bot-$DATE.tar.gz ~/evangelism-bot/data/
# Keep only last 30 days
find ~/backups/ -name "*.tar.gz" -mtime +30 -delete
```

Make it executable and schedule:
```bash
chmod +x ~/backup-bot.sh
crontab -e
# Add this line:
0 2 * * * /home/botuser/backup-bot.sh
```

## 📊 Monitoring

### View Logs
```bash
pm2 logs evangelism-bot
pm2 logs evangelism-bot --lines 100
```

### Check Status
```bash
pm2 list
pm2 monit
pm2 show evangelism-bot
```

### Restart Bot
```bash
pm2 restart evangelism-bot
```

## 🔄 Updating the Bot

```bash
# Pull latest changes (if using Git)
cd ~/evangelism-bot
git pull

# Install new dependencies (if any)
npm install

# Restart bot
pm2 restart evangelism-bot
```

## 🆘 Troubleshooting

### Bot Not Starting
```bash
# Check logs
pm2 logs evangelism-bot --err

# Check Node version
node --version  # Should be 18+

# Reinstall dependencies
rm -rf node_modules
npm install
```

### QR Code Not Showing
```bash
# Run manually to see QR
pm2 stop evangelism-bot
cd ~/evangelism-bot
npm start
# After scanning, Ctrl+C and restart with PM2
pm2 start ecosystem.config.json
```

### Database Errors
```bash
# Check permissions
ls -la ~/evangelism-bot/data/
chmod 644 ~/evangelism-bot/data/evangelism.db
```

## 💰 Cost Estimate

- **VPS:** $4-6/month
- **Domain (optional):** $10-15/year
- **Total:** ~$5/month

## ✅ Deployment Checklist

- [ ] VPS created and accessible via SSH
- [ ] Node.js 18+ installed
- [ ] Project uploaded to VPS
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured
- [ ] Bot started with PM2
- [ ] QR code scanned
- [ ] PM2 startup configured
- [ ] Firewall set up
- [ ] Backups scheduled
- [ ] Real group IDs updated

---

**Your bot will now run 24/7 on the VPS! 🎉**
