# Backend Deployment with PM2

## Quick Deploy to VPS

```bash
# Deploy backend to your server
./deploy.sh YOUR_SERVER_IP

# Example:
./deploy.sh 192.168.1.100
```

## What it does:
- ✅ Installs Node.js & PM2 on server
- ✅ Clones repository from GitHub
- ✅ Installs dependencies  
- ✅ Creates environment file
- ✅ Starts with PM2 on port 4050

## After deployment:
1. **Edit environment file**: `ssh root@YOUR_SERVER_IP 'nano /var/www/school-backend/.env'`
2. **Restart app**: `ssh root@YOUR_SERVER_IP 'pm2 restart school-backend'`

## Management commands:
```bash
# SSH to your server
ssh root@YOUR_SERVER_IP

# Check PM2 status
pm2 status

# View logs
pm2 logs school-backend

# Restart
pm2 restart school-backend
```

Backend will be available at: `http://YOUR_SERVER_IP:4050`