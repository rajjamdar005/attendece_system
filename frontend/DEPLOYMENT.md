# Deployment Guide - Vercel

## 🚀 Quick Deploy to Vercel

### Step 1: Prerequisites
- ✅ Backend deployed on Render (get the URL first)
- ✅ Supabase project active
- ✅ GitHub account with repository

### Step 2: Deploy to Vercel

#### Option A: One-Click Deploy (Recommended)
1. Push code to GitHub repository
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click **"Add New..."** → **"Project"**
4. Import your GitHub repository
5. Vercel auto-detects React/Vite configuration
6. Click **"Deploy"**

#### Option B: Vercel CLI
```bash
cd d:\attend\frontend
npm install -g vercel
vercel login
vercel
```

### Step 3: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

#### Required Variables:
```env
VITE_API_URL=https://your-backend.onrender.com/api/v1
VITE_WS_URL=wss://your-backend.onrender.com/api/v1/live
VITE_SUPABASE_URL=https://lbrnbtqeztehsdkkhzxp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important Notes:**
- Replace `your-backend.onrender.com` with actual Render backend URL
- Use `wss://` (not `ws://`) for secure WebSocket connection in production
- Supabase credentials stay the same as development

#### Set Environment for Each:
- **Production**: ✅ (Always set)
- **Preview**: ✅ (Recommended for testing)
- **Development**: ❌ (Uses local .env)

### Step 4: Update Backend CORS

After deploying, update backend CORS to allow frontend:

**In Render Dashboard → Backend → Environment Variables:**

Update `CORS_ORIGIN` to include your Vercel URL:
```env
CORS_ORIGIN=https://your-backend.onrender.com,https://your-frontend.vercel.app,http://localhost:5173
```

**Redeploy backend** after updating CORS.

---

## 📋 Deployment Configuration

### Build Settings (Auto-detected by Vercel):
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Node Version**: 18.x (specified in package.json)

### Custom Configuration:
All settings in [vercel.json](vercel.json):
- Single Page Application routing (all routes → index.html)
- Static asset caching (1 year for /assets/*)
- Environment variable placeholders

---

## 🌐 Domain Configuration

### Default Domain:
After deployment, Vercel provides:
- `https://your-project.vercel.app`
- `https://your-project-username.vercel.app`

### Custom Domain (Optional):
1. Go to **Settings → Domains**
2. Add your custom domain
3. Configure DNS records as instructed
4. Update `CORS_ORIGIN` in backend to include custom domain

---

## 🔧 Testing Deployment

### Test Frontend:
```bash
# Visit your Vercel URL
https://your-project.vercel.app

# Test login page
https://your-project.vercel.app/login

# Check API connection (open browser console)
# Should see successful API calls to Render backend
```

### Test Full Flow:
1. **Login**: Use credentials from backend setup
2. **Dashboard**: Should load KPIs and charts
3. **Employees**: Should fetch data from Supabase
4. **Devices**: Should show registered ESP32 devices
5. **Reports**: Should generate PDF/CSV exports
6. **Live Updates**: Scan RFID card → Should see real-time update

---

## 🔍 Vercel Build Logs

Monitor deployment in Vercel Dashboard:
- **Deployments**: View all deployments
- **Build Logs**: Debug build errors
- **Function Logs**: Monitor runtime errors
- **Analytics**: Track page views, performance

---

## 🆘 Troubleshooting

### Build Fails:
```bash
# Check package.json has all dependencies
# Ensure Node version >=18.0.0
# Review build logs in Vercel dashboard
```

### API Connection Fails:
- ✅ Verify `VITE_API_URL` is correct
- ✅ Check backend is deployed and running on Render
- ✅ Ensure CORS is updated with Vercel URL
- ✅ Open browser console for detailed error

### 404 on Routes:
- ✅ Ensure `vercel.json` exists with rewrite rules
- ✅ Redeploy after adding vercel.json

### WebSocket Not Working:
- ✅ Use `wss://` (not `ws://`) for production
- ✅ Verify backend WebSocket endpoint is accessible
- ✅ Check browser console for connection errors

### Environment Variables Not Loaded:
- ✅ Ensure variables start with `VITE_` prefix
- ✅ Set variables in Vercel dashboard (not .env.production)
- ✅ Redeploy after adding environment variables

---

## 🔐 Security Checklist

- [ ] HTTPS enabled by default (Vercel provides SSL)
- [ ] Environment variables secured in Vercel dashboard
- [ ] Backend CORS only allows Vercel domain
- [ ] Supabase Row Level Security (RLS) enabled
- [ ] No sensitive keys in frontend code
- [ ] API tokens stored in localStorage (client-side only)

---

## 🚀 Automatic Deployments

### Enable Git Integration:
1. Connect repository in Vercel dashboard
2. **Production Branch**: `main` → Auto-deploy to production
3. **Preview Branches**: Other branches → Auto-deploy to preview URLs

### Preview Deployments:
- Every pull request gets unique preview URL
- Test changes before merging to main
- Share preview links with team

### Rollback:
- Go to **Deployments**
- Click **"..."** on previous deployment
- Select **"Promote to Production"**

---

## 📊 Monitoring

### Vercel Analytics (Free):
- Enable in **Settings → Analytics**
- Track page views, performance metrics
- Monitor Core Web Vitals

### Supabase Monitoring:
- Check database queries in Supabase dashboard
- Monitor API requests and errors
- Track storage usage

---

## 💰 Pricing

### Vercel Free Tier Includes:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ HTTPS/SSL certificates
- ✅ Git integration
- ✅ Preview deployments
- ✅ Analytics (basic)

### Upgrade to Pro ($20/month) for:
- 1TB bandwidth
- Password protection
- Advanced analytics
- Priority support

---

## 🔄 Update Workflow

### Deploy New Changes:
```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push origin main

# Vercel automatically deploys within 1-2 minutes
```

### Local Testing Before Deploy:
```bash
cd frontend

# Test with production build
npm run build
npm run preview

# Visit http://localhost:4173
```

---

## 📝 Next Steps

After successful deployment:

1. **Get Vercel URL**: Copy from Vercel dashboard
2. **Update Backend CORS**: Add Vercel URL to Render backend
3. **Test Full System**:
   - Login to frontend
   - Scan RFID card on ESP32
   - Verify event appears in dashboard
   - Check real-time WebSocket updates
   - Test PDF/CSV exports

4. **Share URLs**:
   - Frontend: `https://your-project.vercel.app`
   - Backend: `https://your-backend.onrender.com`
   - Docs: Share deployment guide with team

---

## 🎯 Complete System URLs

After both deployments:

- **Frontend (Vercel)**: `https://your-frontend.vercel.app`
- **Backend (Render)**: `https://your-backend.onrender.com`
- **Database (Supabase)**: `https://lbrnbtqeztehsdkkhzxp.supabase.co`
- **ESP32 Devices**: Connect to Render backend URL

---

**Deployment completed! 🎉**

Your attendance system is now live in the cloud!

**Total Cost**: $0/month (Free tier) or $27/month (Render Starter $7 + Vercel Pro $20)
