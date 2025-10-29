# ESP32 RFID Attendance System - Deployment Guide

Complete guide to deploying the production-ready attendance system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [ESP32 Device Setup](#esp32-device-setup)
6. [Production Checklist](#production-checklist)
7. [Monitoring & Maintenance](#monitoring--maintenance)

## Prerequisites

### Required Accounts

- **Supabase** account (free tier sufficient for start)
- **Vercel** or **Netlify** account (for frontend)
- **Render**, **Railway**, or **DigitalOcean** account (for backend)
- **GitHub** account (for CI/CD)

### Required Software

- Node.js 18+ and npm
- Git
- Arduino IDE or PlatformIO (for ESP32)
- PostgreSQL client (optional, for local testing)

## Supabase Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in details:
   - **Name**: `rfid-attendance`
   - **Database Password**: (save securely)
   - **Region**: Choose closest to your location

### 2. Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
cd attend
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

**Alternative: Manual SQL**

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20250101000001_initial_schema.sql`
3. Paste and execute

### 3. Get API Credentials

From Supabase Dashboard → Settings → API:

- **Project URL**: `https://xxxxx.supabase.co`
- **anon/public key**: `eyJhbGc...` (for frontend)
- **service_role key**: `eyJhbGc...` (for backend, keep secret!)

## Backend Deployment

### Option A: Deploy to Render (Recommended)

1. **Create GitHub Repository**

```bash
cd attend
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/rfid-attendance.git
git push -u origin main
```

2. **Deploy on Render**

- Go to [render.com](https://render.com)
- Click "New +" → "Web Service"
- Connect your GitHub repo
- Configure:
  - **Name**: `rfid-attendance-api`
  - **Root Directory**: `backend`
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`
  - **Instance Type**: Starter ($7/month)

3. **Set Environment Variables**

Add in Render dashboard → Environment:

```
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
DEVICE_TOKEN_SALT_ROUNDS=10
DEVICE_TOKEN_EXPIRES_DAYS=365
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_DEVICE_MAX=300
CORS_ORIGIN=https://your-frontend-domain.com
LOG_LEVEL=info
BCRYPT_ROUNDS=10
```

4. **Deploy**

Render will auto-deploy. Note your backend URL: `https://rfid-attendance-api.onrender.com`

### Option B: Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
cd backend
railway init

# Set environment variables
railway variables set SUPABASE_URL=https://...
railway variables set SUPABASE_SERVICE_KEY=...
# ... (set all variables)

# Deploy
railway up
```

### Option C: Deploy with Docker

```bash
cd attend

# Build backend image
docker build -t rfid-attendance-backend ./backend

# Run backend container
docker run -d \
  -p 3000:3000 \
  -e SUPABASE_URL=https://... \
  -e SUPABASE_SERVICE_KEY=... \
  --name attendance-api \
  rfid-attendance-backend
```

## Frontend Deployment

### Option A: Deploy to Vercel (Recommended)

1. **Install Vercel CLI**

```bash
npm install -g vercel
```

2. **Configure Environment**

Create `frontend/.env.production`:

```
VITE_API_URL=https://your-backend-url.onrender.com/api/v1
VITE_WS_URL=wss://your-backend-url.onrender.com/api/v1/live
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. **Deploy**

```bash
cd frontend
vercel

# Follow prompts
# Choose "Create new project"
# Use default settings

# Production deployment
vercel --prod
```

4. **Set Environment Variables in Vercel Dashboard**

- Go to Vercel project → Settings → Environment Variables
- Add all variables from `.env.production`

### Option B: Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
cd frontend
netlify deploy --prod

# Follow prompts
# Build command: npm run build
# Publish directory: dist
```

Add environment variables in Netlify dashboard → Site settings → Environment variables

## ESP32 Device Setup

### 1. Flash Firmware

1. Open `firmware/rfid-reader/rfid-reader.ino` in Arduino IDE

2. **Update Configuration**:

```cpp
// WiFi credentials
const char* WIFI_SSID_1 = "YourNetworkName";
const char* WIFI_PASSWORD_1 = "YourPassword";

// API Configuration
const char* API_URL = "https://your-backend.onrender.com/api/v1";
const char* DEVICE_UUID = "esp-reader-01";  // Unique per device

// Device Info
const char* DEVICE_NAME = "Main Entrance";
const char* LOCATION = "Building A - Ground Floor";
```

3. **Update Provisioning Secret** (must match backend):

```cpp
doc["secret"] = "your-secure-provisioning-secret";
```

4. **Upload**:
   - Connect ESP32 via USB
   - Tools → Board → ESP32 Dev Module
   - Tools → Port → (select your port)
   - Sketch → Upload

5. **Test**:
   - Open Serial Monitor (115200 baud)
   - Watch for successful WiFi connection and device registration
   - Scan an RFID card

### 2. Register Device in Backend

**Option A: Automatic (on first boot)**

Device will auto-register if provisioning secret matches.

**Option B: Manual Registration**

```bash
curl -X POST https://your-api.com/api/v1/devices/register \
  -H "Content-Type: application/json" \
  -d '{
    "device_uuid": "esp-reader-01",
    "secret": "your-provisioning-secret",
    "device_name": "Main Entrance",
    "location": "Building A"
  }'
```

Save the returned `token` and update firmware if needed.

## Production Checklist

### Security

- [ ] Change default admin password
- [ ] Set strong JWT_SECRET (min 32 chars)
- [ ] Set unique provisioning secret per installation
- [ ] Enable HTTPS/TLS everywhere
- [ ] Configure CORS_ORIGIN to your frontend domain
- [ ] Set secure OTA password in firmware
- [ ] Enable Supabase RLS policies
- [ ] Rotate device tokens periodically

### Backend

- [ ] Set NODE_ENV=production
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting
- [ ] Set up error logging (Sentry/LogRocket)
- [ ] Configure database backups
- [ ] Set up health check monitoring

### Frontend

- [ ] Update API URLs to production
- [ ] Test all authentication flows
- [ ] Verify WebSocket connection
- [ ] Test on mobile devices
- [ ] Enable analytics (optional)

### ESP32 Devices

- [ ] Test offline buffering
- [ ] Verify heartbeat interval
- [ ] Test OTA updates
- [ ] Label devices with QR codes
- [ ] Document device locations
- [ ] Test power failure recovery

### Database

- [ ] Verify all migrations ran successfully
- [ ] Test RLS policies
- [ ] Enable automatic backups
- [ ] Set up monitoring alerts
- [ ] Test data retention policies

## Monitoring & Maintenance

### Health Checks

**Backend Health**:
```bash
curl https://your-api.com/health
```

**Database Monitoring**:
- Supabase Dashboard → Database → Usage

### Logs

**Backend Logs** (Render):
- Dashboard → Your Service → Logs

**Device Logs**:
- Serial monitor for local devices
- Implement remote logging for production

### Backups

**Database Backups** (Supabase):
- Automatic daily backups on Pro plan
- Manual: Dashboard → Database → Backups

**Application Backups**:
- GitHub repository (code)
- Export attendance data monthly

### Updates

**Backend/Frontend**:
```bash
git pull origin main
# Render/Vercel will auto-deploy
```

**Firmware OTA**:
1. Upload new sketch via Arduino IDE
2. Devices update on next power cycle
3. Or use OTA web interface at `http://esp-reader-01.local`

## Troubleshooting

### Backend Won't Start

- Check all environment variables are set
- Verify Supabase credentials
- Check logs for specific errors

### Frontend Can't Connect

- Verify API_URL is correct and accessible
- Check CORS settings in backend
- Test API with curl/Postman

### ESP32 Can't Register

- Verify API_URL is accessible from device network
- Check provisioning secret matches backend
- Verify WiFi credentials
- Check serial monitor for specific errors

### Database Connection Failed

- Verify Supabase project is active
- Check service_role key is correct
- Test connection with Supabase client

## Scaling

### Horizontal Scaling

- **Backend**: Increase Render instances or use load balancer
- **Database**: Upgrade Supabase plan for more connections
- **Frontend**: Auto-scaled by Vercel/Netlify

### Performance Optimization

- Enable database connection pooling
- Add Redis cache for frequent queries
- Use CDN for frontend assets
- Optimize database indexes

### Cost Estimates

**Small Installation** (1-3 devices, 100 employees):
- Supabase: Free
- Render: $7/month
- Vercel: Free
- **Total: ~$7/month**

**Medium Installation** (10-20 devices, 500 employees):
- Supabase Pro: $25/month
- Render: $25/month
- Vercel Pro: $20/month
- **Total: ~$70/month**

## Support & Resources

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: See `docs/` folder
- **API Docs**: `docs/api.md`
- **FAQ**: `docs/faq.md`

---

**System is now production-ready!** 🚀

Next steps:
1. Create first company
2. Add employees
3. Assign RFID tags
4. Deploy ESP32 readers
5. Monitor dashboard for live attendance
