# VPS Deployment - Quick Reference

## 📍 You Are Here

Your bot is currently running on your local PC with PM2. To move to a VPS for 24/7 operation, follow these steps:

## 🎯 Quick Deployment Steps

### 1. Choose a VPS Provider
- **Recommended:** Contabo ($4.50/month) or DigitalOcean ($6/month)
- Select Ubuntu 22.04 LTS
- Minimum: 1GB RAM, 10GB storage

### 2. Prepare Your Code

**Option A: Upload Manually (Easiest)**
You can use WinSCP or FileZilla to drag-and-drop your entire project folder to the VPS.

**Option B: Use GitHub**
1. Create a GitHub repository
2. Push your code (see VPS-DEPLOYMENT.md for details)
3. Clone on VPS

### 3. Connect to VPS

```powershell
ssh root@YOUR_VPS_IP
```

### 4. Run Setup Script

```bash
# Download and run automated setup
wget https://raw.githubusercontent.com/YOUR_REPO/main/vps-setup.sh
chmod +x vps-setup.sh
./vps-setup.sh
```

Or manually install (see VPS-DEPLOYMENT.md).

### 5. Start the Bot

```bash
cd ~/evangelism-bot
npm install
pm2 start ecosystem.config.json
pm2 save
pm2 startup
```

### 6. Scan QR Code

View logs to see the QR code:
```bash
pm2 logs evangelism-bot
```

## 📚 Full Documentation

- **Complete Guide:** `VPS-DEPLOYMENT.md`
- **Setup Script:** `vps-setup.sh`

## 💡 Alternative: Manual Upload

If you don't want to use Git:

1. Install **WinSCP** on your PC
2. Connect to your VPS
3. Upload the entire project folder
4. Follow steps 5-6 above

## ⚡ Estimated Time

- **Setup:** 15-30 minutes
- **Cost:** $4-6/month
- **Benefit:** True 24/7 uptime

---

**Need help?** Check `VPS-DEPLOYMENT.md` for detailed instructions.
