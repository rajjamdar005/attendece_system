# Master Deployment Guide
## RFID Attendance System - Full Stack Deployment

This guide covers deploying the complete system to production.

---

## 📋 Pre-Deployment Checklist

### Required Accounts:
- [ ] **Supabase** account (database) - Free tier available
- [ ] **Render** account (backend) - Free tier available
- [ ] **Vercel** account (frontend) - Free tier available
- [ ] **GitHub** account (code repository) - Free

### Required Information:
- [ ] Supabase Project URL
- [ ] Supabase Service Role Key
- [ ] Supabase Anon Key
- [ ] WiFi credentials for ESP32
- [ ] Physical ESP32 device with RFID reader

---

## 🚀 Deployment Steps (In Order)

### Step 1: Deploy Backend to Render
**Estimated Time**: 10 minutes

1. Follow [backend/DEPLOYMENT.md](../backend/DEPLOYMENT.md)
2. Get backend URL: `https://your-backend.onrender.com`
3. Test health endpoint: `https://your-backend.onrender.com/health`

**Critical**: Note down your backend URL for next steps!

---

### Step 2: Deploy Frontend to Vercel
**Estimated Time**: 5 minutes

1. Follow [frontend/DEPLOYMENT.md](DEPLOYMENT.md)
2. Update `VITE_API_URL` with backend URL from Step 1
3. Get frontend URL: `https://your-frontend.vercel.app`
4. **Important**: Update backend CORS with frontend URL

**Update Backend CORS:**
```env
# In Render Dashboard → Backend → Environment Variables
CORS_ORIGIN=https://your-backend.onrender.com,https://your-frontend.vercel.app
```

---

### Step 3: Update ESP32 Firmware
**Estimated Time**: 5 minutes

**File**: `firmware/rfid-reader/rfid-reader.ino`

**Change Line 45:**
```cpp
// OLD:
const char* API_URL_DEFAULT = "http://10.188.0.250:3000";

// NEW (use your actual Render URL):
const char* API_URL_DEFAULT = "https://your-backend.onrender.com";
```

**Upload to ESP32:**
1. Open Arduino IDE
2. Load `rfid-reader.ino`
3. Update API_URL_DEFAULT
4. Select board: ESP32 Dev Module
5. Upload firmware

---

### Step 4: Test Complete System
**Estimated Time**: 10 minutes

#### Test Backend:
```bash
curl https://your-backend.onrender.com/health
# Expected: {"status":"ok","timestamp":"..."}
```

#### Test Frontend:
1. Visit `https://your-frontend.vercel.app`
2. Login with credentials
3. Check dashboard loads

#### Test ESP32:
1. Power on ESP32
2. Check Serial Monitor (115200 baud):
```
✓ WiFi connected – IP: 10.188.0.44
[TIME] NTP synced (IST): 2026
✓ Device registered – token: eyJhbGci...
System running – waiting for RFID cards
```

#### Test End-to-End:
1. Scan RFID card on ESP32
2. Check Serial Monitor:
```
📡 [RFID] Card: 23:A8:38:DA
[NET] ✓ Event sent: IN
```
3. Check frontend dashboard → Should see new event
4. Check Supabase → attendance_logs table updated

---

## 🌍 System Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   ESP32     │────────▶│   Render     │◀────────│   Vercel    │
│   RFID      │  HTTPS  │   Backend    │  HTTPS  │   Frontend  │
│   Reader    │         │   Node.js    │         │   React     │
└─────────────┘         └──────┬───────┘         └─────────────┘
                               │
                               │ PostgreSQL
                               ▼
                        ┌──────────────┐
                        │   Supabase   │
                        │   Database   │
                        └──────────────┘
```

### Component URLs:
- **ESP32**: Local network (WiFi connected)
- **Backend**: `https://your-backend.onrender.com`
- **Frontend**: `https://your-frontend.vercel.app`
- **Database**: `https://lbrnbtqeztehsdkkhzxp.supabase.co`

---

## 💰 Cost Breakdown

### Free Tier (Recommended for Testing):
| Service | Cost | Limitations |
|---------|------|-------------|
| Supabase | $0 | 500MB database, 2GB bandwidth |
| Render | $0 | Sleeps after 15 min inactivity |
| Vercel | $0 | 100GB bandwidth/month |
| **Total** | **$0/month** | Cold starts on Render |

### Production Tier (Recommended for Live):
| Service | Cost | Benefits |
|---------|------|----------|
| Supabase Pro | $25 | 8GB database, 250GB bandwidth |
| Render Starter | $7 | Always-on, no sleep |
| Vercel Pro | $20 | 1TB bandwidth, analytics |
| **Total** | **$52/month** | No cold starts, better performance |

---

## ⚙️ Important Production Notes

### Render Free Tier Sleep Mode:
**Problem**: Service sleeps after 15 minutes of inactivity
**Impact**: First ESP32 request takes 30-60 seconds
**Solution Options**:
1. **Upgrade to Starter** ($7/month) - No sleep
2. **Ping Service** - Use cron-job.org to ping `/health` every 10 minutes
3. **Accept Sleep** - ESP32 buffers events offline, retries when awake

### ESP32 Offline Buffering:
When backend is unavailable (sleep/network issues):
- Events saved to LittleFS filesystem
- Auto-retry with exponential backoff
- Automatic flush when connection restored
- Supports up to 500 buffered events

---

## 🔐 Security Configuration

### Backend (Render):
- [x] HTTPS enabled by default
- [x] JWT token authentication
- [x] Rate limiting (500 req/15min)
- [x] CORS whitelist (frontend + ESP32)
- [x] Helmet security headers
- [x] Environment variables secured

### Frontend (Vercel):
- [x] HTTPS enabled by default
- [x] Static asset caching
- [x] SPA routing configured
- [x] No sensitive keys in code
- [x] API tokens in localStorage only

### Database (Supabase):
- [ ] **TODO**: Enable Row Level Security (RLS)
- [ ] **TODO**: Set up backup schedule
- [ ] **TODO**: Configure retention policies

### ESP32:
- [x] Device secret generation (MAC-based)
- [x] Token-based authentication
- [x] Offline buffering
- [ ] **Optional**: Add HTTPS/SSL support

---

## 📊 Monitoring & Logs

### Backend Monitoring (Render):
- **Logs**: Real-time in Render dashboard
- **Metrics**: CPU, Memory, Response time
- **Alerts**: Configure email alerts for downtime

### Frontend Monitoring (Vercel):
- **Deployments**: Track all deployments
- **Analytics**: Enable in Settings → Analytics
- **Errors**: Check Function Logs for runtime errors

### Database Monitoring (Supabase):
- **Dashboard**: Query editor, table browser
- **API**: Monitor request volume
- **Logs**: SQL query logs

### ESP32 Monitoring:
- **Serial Monitor**: Real-time firmware logs (115200 baud)
- **Heartbeat**: Every 5 minutes to backend
- **Error Stats**: Tracked in firmware, sent via heartbeat

---

## 🆘 Troubleshooting Common Issues

### ESP32 Connection Refused (-1):
```
[NET] HTTP error: -1
[NET] Send failed after retries - buffering
```
**Causes**:
- Backend not deployed or stopped
- Wrong API URL in firmware
- Render service sleeping (free tier)

**Solutions**:
1. Check Render dashboard → Service running
2. Verify API_URL matches Render URL exactly
3. Wait 60 seconds for Render to wake up
4. Check Serial Monitor for registration success

---

### CORS Error in Browser:
```
Access to fetch at 'https://backend.onrender.com' from origin 'https://frontend.vercel.app' 
has been blocked by CORS policy
```
**Solution**:
1. Go to Render → Backend → Environment Variables
2. Update `CORS_ORIGIN`:
```env
CORS_ORIGIN=https://your-backend.onrender.com,https://your-frontend.vercel.app,http://localhost:5173
```
3. Redeploy backend

---

### Database Connection Error:
```
Error: connect ECONNREFUSED
```
**Solutions**:
1. Verify Supabase credentials in Render env vars
2. Check Supabase project is active (not paused)
3. Ensure service role key is correct (not anon key)
4. Check Supabase dashboard for outages

---

### Build Failed on Vercel:
**Common Issues**:
- Missing dependencies in package.json
- Node version mismatch
- Build command incorrect

**Solutions**:
1. Check Vercel build logs for specific error
2. Ensure Node version >=18.0.0 in package.json
3. Verify `npm run build` works locally
4. Check all dependencies installed

---

## 🔄 Update & Maintenance

### Deploy Updates:
```bash
# Make changes locally
git add .
git commit -m "Description of changes"
git push origin main

# Both Vercel and Render auto-deploy within 1-2 minutes
```

### Update ESP32 Firmware:
1. Make changes to `rfid-reader.ino`
2. Connect ESP32 via USB
3. Upload via Arduino IDE
4. Monitor Serial output for success

### Database Migrations:
1. Test changes in Supabase staging environment
2. Apply to production via Supabase SQL editor
3. Update backend code if schema changed
4. Redeploy backend

---

## 📝 Post-Deployment Tasks

### Immediate (Day 1):
- [ ] Test login from multiple devices
- [ ] Scan 10+ RFID cards to test volume
- [ ] Generate PDF/CSV reports
- [ ] Monitor backend logs for errors
- [ ] Check database records in Supabase

### Week 1:
- [ ] Set up monitoring alerts
- [ ] Configure automated backups
- [ ] Enable Supabase RLS policies
- [ ] Test offline buffering (disconnect WiFi)
- [ ] Monitor free tier usage limits

### Month 1:
- [ ] Review error statistics from ESP32 heartbeats
- [ ] Analyze report usage patterns
- [ ] Optimize database queries if slow
- [ ] Consider upgrading to paid tiers
- [ ] Add more ESP32 devices if needed

---

## 🎯 Success Metrics

Your deployment is successful when:
- ✅ Backend health endpoint returns 200 OK
- ✅ Frontend loads without errors
- ✅ Login works with valid credentials
- ✅ ESP32 registers and gets token
- ✅ RFID scan creates database record
- ✅ Dashboard shows real-time updates
- ✅ PDF/CSV exports work correctly
- ✅ System runs 24/7 without manual intervention

---

## 📞 Support Resources

### Documentation:
- **Render**: https://render.com/docs
- **Vercel**: https://vercel.com/docs
- **Supabase**: https://supabase.com/docs
- **ESP32**: https://docs.espressif.com/

### Community:
- **Render**: https://community.render.com
- **Vercel**: https://github.com/vercel/vercel/discussions
- **Supabase**: https://github.com/supabase/supabase/discussions

---

## 🎉 Deployment Complete!

Your RFID attendance system is now live in production!

**System URLs**:
- Frontend: `https://your-frontend.vercel.app`
- Backend: `https://your-backend.onrender.com`
- Database: Supabase Dashboard

**Next**: Share URLs with your team and start tracking attendance! 🚀
