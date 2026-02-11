# WhatsApp Evangelism Reporter Bot

A comprehensive WhatsApp chatbot system for collecting, storing, and analyzing church evangelism reports. The bot provides an interactive form-based interface, automatic group posting, and AI-powered monthly reporting.

## ✨ Features

- **📝 Interactive Form Collection** - 9-step conversational form for evangelism reports
- **💾 Database Storage** - Supabase (PostgreSQL) for reliable cloud storage
- **📤 Automatic Group Posting** - Reports automatically posted to WhatsApp groups by assembly
- **🤖 AI-Powered Reports** - Monthly summaries with OpenAI analysis (optional)
- **📊 PDF Generation** - Professional PDF reports with statistics and insights
- **⏰ Automated Scheduling** - Monthly reports generated and distributed automatically
- **🔐 Secure Configuration** - Environment-based configuration for sensitive data

## 📋 Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **WhatsApp Account** - For the bot (can be separate from personal)
- **OpenAI API Key** - Optional, for AI-powered reports ([Get one here](https://platform.openai.com/))

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Setup Wizard

```bash
npm run setup
```

The wizard will:
- Initialize the database
- Create your `.env` configuration file
- Set up assemblies (church branches/groups)

### 3. Start the Bot

```bash
npm start
```

### 4. Scan QR Code

When the bot starts, a QR code will appear in the terminal. Scan it with WhatsApp on your phone to authenticate.

### 5. Test the Bot

Send `!evangelism` (or your custom wake phrase) to the bot in a private chat to start a new report.

## 📖 Usage

### Submitting a Report

1. Open a private chat with the bot number
2. Send `!evangelism`
3. Follow the interactive prompts:
   - Select your assembly
   - Enter your name
   - Specify activity date
   - Provide location
   - Enter people reached
   - Enter conversions
   - Select activity type
   - Add optional notes
   - Review and confirm

4. The report is automatically:
   - Saved to the database
   - Posted to your assembly's WhatsApp group

### Available Commands

- `!evangelism` - Start a new evangelism report
- `!help` - Display help information
- `cancel` - Cancel the current form (during form filling)

## ⚙️ Configuration

### Environment Variables

Edit the `.env` file to configure:

```env
# Church Information
CHURCH_NAME=Your Church Name

# Bot Configuration
WAKE_PHRASE=!evangelism

# Admin Numbers (comma-separated)
ADMIN_NUMBERS=1234567890@s.whatsapp.net

# OpenAI API Key (optional)
OPENAI_API_KEY=sk-...

# Database Configuration (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### Adding Assemblies

Assemblies can be added through:
1. The setup wizard (`npm run setup`)
2. Directly in the database

To get WhatsApp Group IDs:
1. Add the bot to your WhatsApp group
2. Check the bot logs - the group ID will be displayed when messages are received

## 📊 Monthly Reports

The bot automatically generates monthly reports on the 1st of each month (configurable). Reports include:

- **Overall Statistics** - Total reports, people reached, conversions, rates
- **Assembly Performance** - Breakdown by each assembly
- **Activity Analysis** - Breakdown by activity types
- **AI Insights** - Trends, highlights, and recommendations (if OpenAI is configured)

Reports are:
- Posted as summaries to all WhatsApp groups
- Generated as PDFs in the `reports/` directory
- Sent to admin numbers

## 🗂️ Project Structure

```
whatsapp-evangelism-bot/
├── src/
│   ├── bot/
│   │   ├── connection.js       # WhatsApp connection
│   │   └── messageHandler.js   # Message routing
│   ├── config/
│   │   ├── config.js           # Configuration loader
│   │   └── setup.js            # Setup wizard
│   ├── database/
│   │   └── db.js               # Database operations
│   ├── forms/
│   │   ├── formValidator.js    # Input validation
│   │   └── reportForm.js       # Interactive form
│   ├── services/
│   │   ├── aiReportGenerator.js # AI analysis
│   │   ├── groupPoster.js       # Group posting
│   │   ├── pdfGenerator.js      # PDF creation
│   │   └── scheduler.js         # Task scheduling
│   ├── utils/
│   │   ├── helpers.js           # Utility functions
│   │   └── logger.js            # Logging
│   └── index.js                 # Main entry point
├── .env                         # Configuration (created by setup)
├── package.json
└── README.md
```

## 🔧 Troubleshooting

### Bot Not Connecting
- Ensure you have a stable internet connection
- Check that you scanned the QR code correctly
- Try deleting the `auth_info_baileys/` folder and rescanning

### Reports Not Posting to Groups
- Verify the bot has been added to the WhatsApp group
- Check that the group ID in the database is correct
- Look for error messages in the bot logs

### Database Errors
- Ensure the `data/` directory has write permissions
- Try deleting the database file and running setup again

### OpenAI Errors
- Verify your API key is valid and has credits
- The bot will fall back to basic summaries if OpenAI fails
- Check logs for specific error messages

## 📝 Development

### Running in Development Mode

```bash
npm run dev
```

This uses Node's `--watch` flag to auto-restart on file changes.

### Database Location

The database is hosted on Supabase. You can view/manage data in your Supabase Dashboard.

### Logs

Logs are printed to the console. Set `LOG_LEVEL=debug` in `.env` for more verbose logging.

## 🤝 Support

For issues, questions, or feature requests:
1. Check the logs for error messages
2. Review this documentation
3. Contact your system administrator

## 📄 License

MIT License - feel free to modify and use for your church!

---

**Built with ❤️ for spreading the Gospel**
