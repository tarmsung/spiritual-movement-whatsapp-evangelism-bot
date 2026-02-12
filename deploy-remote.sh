#!/bin/bash

# Navigate to project directory
cd ~/spiritual-movement-whatsapp-evangelism-bot || exit

# Pull latest changes
echo "⬇️ Pulling latest changes..."
git pull

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Restart Bot
echo "🔄 Restarting bot..."
pm2 restart ecosystem.config.json

echo "✅ Deployment complete!"
