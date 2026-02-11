# WhatsApp Evangelism Bot - Detailed Setup Guide

This guide provides step-by-step instructions for setting up and configuring the WhatsApp Evangelism Reporter Bot.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Assembly Setup](#assembly-setup)
5. [WhatsApp Connection](#whatsapp-connection)
6. [Testing](#testing)
7. [Production Deployment](#production-deployment)

## System Requirements

### Minimum Requirements

- **Operating System**: Windows, macOS, or Linux
- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js
- **Internet**: Stable connection required
- **WhatsApp**: A phone number with WhatsApp installed

### Recommended Setup

- Dedicated phone number for the bot
- Server or computer that stays online 24/7
- OpenAI API account (optional, for AI reports)

## Installation

### Step 1: Install Node.js

1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Choose the LTS (Long Term Support) version
3. Run the installer and follow the prompts
4. Verify installation:

```bash
node --version
npm --version
```

### Step 2: Install Dependencies

Navigate to the project directory and install packages:

```bash
cd "C:\Users\user\Documents\SPIRITUALMOVEMENT WHATSAPP-WEB.JS"
npm install
```

This will install all required dependencies including:
- @whiskeysockets/baileys (WhatsApp library)
- better-sqlite3 (database)
- pdfkit (PDF generation)
- openai (AI reports)
- node-cron (scheduling)

### Step 3: Run Setup Wizard

```bash
npm run setup
```

Follow the prompts to configure:
- Church name
- Wake phrase (e.g., `!evangelism`)
- Admin phone numbers
- OpenAI API key (optional)
- Assemblies/groups

## Configuration

### Environment Variables

The setup wizard creates a `.env` file. You can manually edit it:

```env
# Church Information
CHURCH_NAME=Your Church Name

# Bot Configuration
WAKE_PHRASE=!evangelism
NODE_ENV=production

# Admin Configuration
# Format: phone@s.whatsapp.net
ADMIN_NUMBERS=1234567890@s.whatsapp.net,0987654321@s.whatsapp.net

# OpenAI Configuration (Optional)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

# Report Schedule (Cron format)
# Examples:
# 0 9 1 * * = 9 AM on 1st of month
# 0 18 * * 5 = 6 PM every Friday
REPORT_SCHEDULE=0 9 1 * *

# Database Configuration
DATABASE_PATH=./data/evangelism.db

# Logging Configuration
LOG_LEVEL=info
```

### Getting an OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new secret key
5. Copy and paste into `.env` file

**Note**: AI reports are optional. Without an API key, the bot will generate basic statistical summaries.

## Assembly Setup

Assemblies represent different church branches or groups where reports should be posted.

### Method 1: Setup Wizard

During `npm run setup`, you can add assemblies interactively.

### Method 2: Direct Database Access

You can also add assemblies directly to the SQLite database:

```sql
INSERT INTO assemblies (name, whatsapp_group_id) 
VALUES ('Main Campus', '1234567890-1620000000@g.us');
```

### Getting WhatsApp Group IDs

To find your group IDs:

1. Start the bot (`npm start`)
2. Scan the QR code
3. Add the bot to your WhatsApp group
4. Send a message in the group
5. Check the bot logs - the group ID will be displayed

Example group ID format: `1234567890-1620000000@g.us`

**Important**: Keep these IDs secure as they provide access to your groups.

## WhatsApp Connection

### First Time Setup

1. Start the bot:
```bash
npm start
```

2. A QR code will appear in the terminal

3. On your phone:
   - Open WhatsApp
   - Go to Settings → Linked Devices
   - Tap "Link a Device"
   - Scan the QR code

4. Once connected, you'll see: "WhatsApp connection established successfully! ✅"

### Authentication Files

The bot stores authentication in `auth_info_baileys/`. This folder contains:
- Encryption keys
- Session information
- Connection credentials

**Important**: 
- Don't delete this folder while the bot is active
- Back it up to avoid re-scanning
- Keep it secure (it's already in `.gitignore`)

### Reconnection

The bot automatically reconnects if disconnected. If connection fails repeatedly:

1. Delete the `auth_info_baileys/` folder
2. Restart the bot
3. Scan the QR code again

## Testing

### Test 1: Basic Connection

1. Save the bot's number to your contacts
2. Send a message to the bot
3. Check logs to confirm message received

### Test 2: Form Flow

1. Send `!evangelism` to the bot
2. Complete the entire form
3. Verify the confirmation message
4. Check that the report appears in your group

### Test 3: Database Verification

Check the database to ensure the report was saved:

```bash
# Using SQLite command line
sqlite3 data/evangelism.db "SELECT * FROM reports ORDER BY id DESC LIMIT 1;"
```

### Test 4: Help Command

Send `!help` to verify the help system works.

### Test 5: Cancel Functionality

1. Start a form with `!evangelism`
2. Type `cancel` mid-form
3. Verify the form is cancelled

## Production Deployment

### Option 1: Local Computer

Run the bot on a computer that stays on 24/7.

**Using PM2** (recommended):

```bash
# Install PM2
npm install -g pm2

# Start bot with PM2
pm2 start src/index.js --name evangelism-bot

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

**Useful PM2 commands**:
```bash
pm2 status           # Check status
pm2 logs            # View logs
pm2 restart evangelism-bot
pm2 stop evangelism-bot
pm2 delete evangelism-bot
```

### Option 2: Cloud Hosting

Deploy to a cloud platform:

**Railway**:
1. Create account at railway.app
2. Connect GitHub repository
3. Set environment variables
4. Deploy

**Heroku**:
1. Create account at heroku.com
2. Install Heroku CLI
3. Create new app
4. Set environment variables
5. Deploy with Git

**DigitalOcean**:
1. Create a Droplet (Ubuntu)
2. SSH into the server
3. Install Node.js
4. Clone repository
5. Run with PM2

### Backup Strategy

**Important files to backup**:
- `data/evangelism.db` - Your database
- `auth_info_baileys/` - Authentication
- `.env` - Configuration
- `reports/` - Generated PDFs

**Automated backup script** (Linux/Mac):

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf backup-$DATE.tar.gz data/ auth_info_baileys/ .env reports/
```

## Troubleshooting

### Common Issues

**Issue**: "npm: command not found"
- **Solution**: Install Node.js from nodejs.org

**Issue**: "Cannot find module 'better-sqlite3'"
- **Solution**: Run `npm install`

**Issue**: QR code not scanning
- **Solution**: Ensure good lighting, try a different phone angle

**Issue**: "WhatsApp not connected"
- **Solution**: Check internet connection, rescan QR code

**Issue**: Reports not posting to groups
- **Solution**: Verify group IDs, ensure bot is in the group

**Issue**: OpenAI errors
- **Solution**: Check API key, verify billing/credits

### Getting Help

1. Check the logs for error messages
2. Review this guide and README.md
3. Verify configuration in `.env`
4. Test with simple commands like `!help`

## Security Considerations

### Best Practices

- ✅ Keep `.env` file secure
- ✅ Don't commit sensitive data to Git
- ✅ Use strong, unique API keys
- ✅ Regularly backup your database
- ✅ Keep Node.js and dependencies updated
- ✅ Use HTTPS for cloud deployments
- ✅ Restrict admin access

### File Permissions

Ensure proper permissions (Unix/Linux):

```bash
chmod 600 .env                    # Only owner can read/write
chmod 700 auth_info_baileys/      # Only owner can access
chmod 755 data/                   # Owner can write, others read
```

## Maintenance

### Regular Tasks

**Daily**: Check bot is running

**Weekly**: Review logs for errors

**Monthly**: 
- Backup database
- Review monthly reports
- Update dependencies (`npm update`)

**Quarterly**:
- Review and clean old reports
- Update Node.js if needed
- Review security practices

---

For additional support, refer to the main [README.md](README.md) documentation.
