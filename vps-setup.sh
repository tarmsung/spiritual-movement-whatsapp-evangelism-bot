#!/bin/bash

# Evangelism Bot - VPS Deployment Script
# This script automates the initial setup on a fresh Ubuntu VPS

echo "=== WhatsApp Evangelism Bot - VPS Setup ==="
echo ""

# Update system
echo "Step 1: Updating system..."
sudo apt update && sudo apt upgrade -y

# Install Node.js
echo "Step 2: Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
echo "Step 3: Installing Git..."
sudo apt install -y git

# Install build tools
echo "Step 4: Installing build tools..."
sudo apt install -y build-essential python3

# Install PM2
echo "Step 5: Installing PM2..."
sudo npm install -g pm2

# Verify installations
echo ""
echo "=== Installation Summary ==="
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Git version: $(git --version)"
echo "PM2 installed: $(pm2 --version)"
echo ""

echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Clone or upload your bot code to ~/evangelism-bot"
echo "2. cd ~/evangelism-bot"
echo "3. npm install"
echo "4. Create .env file"
echo "5. pm2 start ecosystem.config.json"
echo "6. pm2 save"
echo "7. pm2 startup"
