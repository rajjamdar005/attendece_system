# Deployment Guide - Render.com

## 🚀 Quick Deploy to Render

### Step 1: Prepare Supabase
1. Go to your Supabase project dashboard
2. Copy these values:
   - **Project URL**: Settings → API → Project URL
   - **Service Role Key**: Settings → API → Service Role Key (secret)
   - **Anon Key**: Settings → API → Anon Key (public)

### Step 2: Deploy to Render

#### Option A: Using render.yaml (Recommended)
1. Push code to GitHub repository
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click **"New +"** → **"Blueprint"**
4. Connect your GitHub repository
5. Render will automatically detect `render.yaml`
6. Click **"Apply"**

#### Option B: Manual Setup
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `rfid-attendance-backend`
   - **Region**: Singapore (closest to India)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter for no sleep)

### Step 3: Configure Environment Variables

In Render Dashboard → Environment → Add these variables:

#### Required (Must Set):
```env
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=<click "Generate" button to create secure random value>
CORS_ORIGIN=https://your-backend.onrender.com,https://your-frontend.vercel.app
```

#### Optional (Use defaults from render.yaml):
- JWT_EXPIRES_IN=7d
- DEVICE_TOKEN_SALT_ROUNDS=10
- LOG_LEVEL=info
- BCRYPT_ROUNDS=10

### Step 4: Deploy & Get URL

1. Click **"Create Web Service"**
2. Wait for build to complete (2-3 minutes)
3. Copy your backend URL: `https://your-app-name.onrender.com`
4. Test health endpoint: `https://your-app-name.onrender.com/health`

---

## 🔧 Update ESP32 Firmware

Once backend is deployed, update firmware:

### File: `firmware/rfid-reader/rfid-reader.ino`

**Line 45 - Change API URL:**
```cpp
// OLD (Local):
const char* API_URL_DEFAULT = "http://10.188.0.250:3000";

// NEW (Production):
const char* API_URL_DEFAULT = "https://your-app-name.onrender.com";
```

**Upload firmware to ESP32:**
1. Open Arduino IDE
2. Load `rfid-reader.ino`
3. Update API_URL_DEFAULT with your Render URL
4. Upload to ESP32

---

## 🌐 Update Frontend

### File: `frontend/.env.production`

```env
VITE_API_URL=https://your-backend.onrender.com
```

Or in `frontend/src/config.js`:
```javascript
export const API_URL = import.meta.env.VITE_API_URL || "https://your-backend.onrender.com";
```

---

## ⚙️ Important Notes

### Free Tier Limitations:
- **Service sleeps after 15 minutes** of inactivity
- **Cold start takes 30-60 seconds** to wake up
- **ESP32 Impact**: First request after sleep will timeout → event buffered → retried when service wakes

### Solutions:
1. **Upgrade to Starter Plan** ($7/month):
   - No sleep
   - Always-on service
   - Better for production

2. **Keep Free Tier Active**:
   - Set up cron job to ping `/health` every 10 minutes
   - Use external service like [cron-job.org](https://cron-job.org)
   - Ping URL: `https://your-app-name.onrender.com/health`

3. **Accept Cold Starts**:
   - ESP32 offline buffering handles this gracefully
   - Events are saved to LittleFS
   - Auto-retry when service wakes

### Database:
- ✅ Already using Supabase (cloud-hosted)
- ✅ No migration needed
- ✅ Database always available (independent of Render)

### HTTPS/SSL:
- ✅ Render provides HTTPS by default
- ⚠️ ESP32 needs WiFiClientSecure for HTTPS
- Current firmware uses HTTP only

---

## 🔍 Testing Deployment

### Test Backend:
```bash
# Health check
curl https://your-app-name.onrender.com/health

# API health
curl https://your-app-name.onrender.com/api/v1/health

# Device registration (test)
curl -X POST https://your-app-name.onrender.com/api/v1/devices/register \
  -H "Content-Type: application/json" \
  -d '{
    "device_uuid": "test-device-01",
    "secret": "test-secret-123",
    "device_name": "Test Reader",
    "location": "Test Location"
  }'
```

### Monitor ESP32:
```
Serial Monitor Output:
✓ WiFi connected – IP: 10.188.0.44
[NET] Registering device …
[NET] Target: https://your-app-name.onrender.com/api/v1/devices/register
✓ Device registered – token: eyJhbGciOiJIUzI1NiIsInR5...
```

---

## 📊 Monitoring

### Render Dashboard:
- **Logs**: Real-time server logs
- **Metrics**: CPU, Memory, Response time
- **Events**: Deployments, restarts

### Supabase Dashboard:
- **Database**: Query editor, table browser
- **Logs**: Database queries, API requests
- **Auth**: User management

---

## 🆘 Troubleshooting

### ESP32 Connection Refused (-1):
- Check Render URL is correct in firmware
- Verify backend is deployed and running
- Check Render logs for errors

### CORS Error:
- Add frontend URL to `CORS_ORIGIN` in Render env vars
- Format: `https://backend.onrender.com,https://frontend.vercel.app`

### Database Connection Error:
- Verify Supabase credentials in Render env vars
- Check Supabase project is active
- Ensure service role key is correct

### Cold Start Timeout:
- Normal on free tier
- ESP32 will buffer event offline
- Event sent automatically when service wakes

---

## 🔐 Security Checklist

- [ ] Generate new JWT_SECRET (use Render's "Generate" button)
- [ ] Update CORS_ORIGIN with production URLs only
- [ ] Verify Supabase service role key is secret (not exposed)
- [ ] Remove development/test users from production database
- [ ] Enable Supabase Row Level Security (RLS) policies
- [ ] Consider upgrading ESP32 to HTTPS (WiFiClientSecure)

---

## 📝 Next Steps

After successful deployment:

1. **Test end-to-end flow**:
   - Scan RFID card on ESP32
   - Check Render logs for event
   - Verify database record in Supabase
   - Check frontend reports

2. **Set up monitoring**:
   - Configure Render alerts
   - Monitor Supabase usage
   - Track ESP32 error rates

3. **Consider upgrades**:
   - Render Starter plan ($7/month) for always-on
   - Add HTTPS support to ESP32
   - Set up automated backups

---

**Deployment completed! 🎉**

Your backend URL: `https://your-app-name.onrender.com`
