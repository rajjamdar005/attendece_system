# 🚀 Quick Start Guide - ESP32 RFID Attendance System

Get your attendance system running in 30 minutes!

## 📋 What You'll Need

### Hardware (for testing)
- 1x ESP32 dev board
- 1x MFRC522 RFID reader
- 5x RFID cards/tags
- Jumper wires
- USB cable

### Software
- Node.js 18+ ([download](https://nodejs.org))
- Arduino IDE ([download](https://www.arduino.cc/en/software))
- Git ([download](https://git-scm.com))

### Accounts (free tier)
- Supabase account ([signup](https://supabase.com))

## Step 1: Database Setup (5 minutes)

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Name: `rfid-attendance`
   - Save the password!

2. **Run Database Migration**
   - Go to SQL Editor in Supabase Dashboard
   - Open `supabase/migrations/20250101000001_initial_schema.sql`
   - Copy entire content and paste
   - Click "Run"
   - Wait for success message ✓

3. **Get API Keys**
   - Go to Settings → API
   - Copy:
     - Project URL: `https://xxxxx.supabase.co`
     - `anon` key (public)
     - `service_role` key (secret!)

## Step 2: Backend Setup (5 minutes)

```bash
# Navigate to backend folder
cd attend/backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your Supabase credentials
# Use notepad or any text editor
notepad .env
```

**Update .env with your values:**
```
NODE_ENV=development
PORT=3000
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
JWT_SECRET=my-super-secret-jwt-key-min-32-characters-long
CORS_ORIGIN=http://localhost:5173
```

**Start backend:**
```bash
npm run dev
```

You should see:
```
🚀 Server running on port 3000
📡 WebSocket available at ws://localhost:3000/api/v1/live
```

Leave this terminal running!

## Step 3: Frontend Setup (5 minutes)

**Open NEW terminal:**

```bash
# Navigate to frontend folder
cd attend/frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env
notepad .env
```

**Update .env:**
```
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000/api/v1/live
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Start frontend:**
```bash
npm run dev
```

You should see:
```
  VITE ready in 500 ms
  ➜  Local:   http://localhost:5173/
```

## Step 4: First Login (2 minutes)

1. Open browser: `http://localhost:5173`

2. Login with default credentials:
   - Username: `admin`
   - Password: `Admin@123`

3. You're in! 🎉

**⚠️ IMPORTANT: Change password immediately in production!**

## Step 5: ESP32 Hardware Setup (5 minutes)

**Wire MFRC522 to ESP32:**

```
MFRC522    →    ESP32
SDA        →    GPIO 21
SCK        →    GPIO 18
MOSI       →    GPIO 23
MISO       →    GPIO 19
RST        →    GPIO 22
GND        →    GND
3.3V       →    3.3V

Optional:
LED        →    GPIO 2 (+ 220Ω resistor)
BUZZER     →    GPIO 4
```

## Step 6: Flash ESP32 Firmware (5 minutes)

1. **Open Arduino IDE**

2. **Install ESP32 Board Support:**
   - File → Preferences
   - Additional Board Manager URLs:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Tools → Board → Boards Manager
   - Search "ESP32"
   - Install "ESP32 by Espressif Systems"

3. **Install Libraries:**
   - Tools → Manage Libraries
   - Install:
     - `MFRC522` by GithubCommunity
     - `ArduinoJson` by Benoit Blanchon

4. **Open Firmware:**
   - File → Open → `attend/firmware/rfid-reader/rfid-reader.ino`

5. **Configure:**
   ```cpp
   // Update these lines:
   const char* WIFI_SSID_1 = "YourWiFiName";
   const char* WIFI_PASSWORD_1 = "YourWiFiPassword";
   const char* API_URL = "http://192.168.1.x:3000/api/v1";  // Your PC's IP
   const char* DEVICE_UUID = "esp-reader-01";
   ```

   **Finding your PC's IP:**
   - Windows: `ipconfig` → Look for IPv4 Address
   - Mac/Linux: `ifconfig` → Look for inet

6. **Upload:**
   - Tools → Board → ESP32 Dev Module
   - Tools → Port → (select your ESP32 port)
   - Click Upload (→) button
   - Wait for "Done uploading"

7. **Test:**
   - Tools → Serial Monitor (115200 baud)
   - You should see:
     ```
     =================================
     ESP32 RFID Attendance System
     Firmware: 1.0.0
     =================================
     
     ✓ RFID Reader initialized
     ✓ WiFi connected
     ✓ Device registered successfully
     🚀 System ready - waiting for RFID tags...
     ```

## Step 7: First Scan (3 minutes)

1. **Create a Company** (in web dashboard):
   - Go to Companies
   - Click "Add Company"
   - Name: "Test Company"
   - Save

2. **Create an Employee:**
   - Go to Employees
   - Click "Add Employee"
   - Fill in details
   - Company: Test Company
   - Save

3. **Scan RFID Card:**
   - Hold RFID card near the reader
   - LED should light up
   - Buzzer beeps

4. **Assign Tag:**
   - Dashboard → Live Feed shows the scan
   - Note the Tag UID (e.g., `AB:CD:EF:12`)
   - Go to Employees → Find your employee
   - Click "Assign Tag"
   - Enter the UID
   - Save

5. **Scan Again:**
   - Scan same card
   - Dashboard shows employee name!
   - ✅ Success!

## 🎉 You're Done!

Your attendance system is now running locally!

## What's Next?

### Add More Users
```bash
# Create company admin
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "company1_admin",
    "password": "SecurePass123!",
    "full_name": "John Doe",
    "email": "john@company1.com",
    "role": "company_admin",
    "company_id": 1
  }'
```

### Deploy to Production
- See `docs/deployment.md` for complete production deployment guide
- Deploy to Render (backend) + Vercel (frontend)
- Takes ~30 minutes

### Add More Devices
- Copy firmware to multiple ESP32s
- Change `DEVICE_UUID` for each device
- Update `DEVICE_NAME` and `LOCATION`

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000  # Windows
lsof -ti:3000  # Mac/Linux

# Kill process and restart
```

### ESP32 won't connect to WiFi
- Check SSID and password
- Ensure 2.4GHz network (ESP32 doesn't support 5GHz)
- Check signal strength (should be near router)

### Card not reading
- Check wiring (especially SDA, SCK, MOSI, MISO)
- Verify 3.3V power (NOT 5V!)
- Try different RFID card (MIFARE Classic works best)

### Dashboard shows "Network Error"
- Verify backend is running on port 3000
- Check VITE_API_URL in frontend/.env
- Test: `curl http://localhost:3000/health`

## 📚 Learn More

- **API Documentation**: `docs/api.md`
- **Hardware Setup**: `firmware/README.md`
- **Database Schema**: `supabase/migrations/`
- **Frontend Components**: `frontend/src/`

## 💬 Get Help

- Check `docs/troubleshooting.md`
- Read `docs/faq.md`
- Review code comments

## 🎯 Testing Checklist

- [ ] Backend health check: `http://localhost:3000/health`
- [ ] Frontend loads: `http://localhost:5173`
- [ ] Can login with admin/Admin@123
- [ ] Dashboard shows live feed
- [ ] ESP32 connects to WiFi
- [ ] ESP32 registers with backend
- [ ] RFID card scans successfully
- [ ] Scan appears in dashboard
- [ ] Can assign tag to employee
- [ ] Second scan shows employee name

## 📊 System Architecture

```
┌──────────────┐
│  RFID Cards  │
└──────┬───────┘
       │
┌──────▼───────┐         ┌─────────────┐
│   ESP32      │ HTTPS   │   Backend   │
│  + MFRC522   ├────────►│   Node.js   │
│  (Firmware)  │         │   Express   │
└──────────────┘         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │  Supabase   │
                         │  PostgreSQL │
                         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │  Frontend   │
                         │    React    │
                         └─────────────┘
```

---

**Ready to track attendance like a pro!** 🚀

For production deployment, see `docs/deployment.md`
