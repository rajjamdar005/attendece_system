# ESP32 RFID Attendance System
## Multi-Company Incubation Centre Solution

A production-ready, networked RFID attendance system with offline support, real-time monitoring, and comprehensive reporting.

## 🎯 Features

- **Multi-tenant**: Manage multiple companies in one incubation centre
- **Offline-first**: ESP32 devices buffer events when network is down
- **Real-time**: Live attendance feed with WebSocket support
- **Secure**: Device token auth, JWT for users, RBAC enforcement
- **Scalable**: Handles thousands of daily events
- **Robust**: Retry logic, heartbeat monitoring, OTA firmware updates


## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Arduino IDE or PlatformIO
- Supabase account (free tier works)
- ESP32 dev boards + MFRC522 RFID modules

### 1. Database Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize and link your project
cd attend
supabase link --project-ref your-project-ref
supabase db push
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with backend API URL
npm run dev
```

### 4. Firmware Setup

See `firmware/README.md` for detailed ESP32 setup instructions.

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-jwt-secret
PORT=3000
NODE_ENV=production
```

**Frontend (.env)**
```
VITE_API_URL=https://your-api.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Firmware (config.h)**
```cpp
#define WIFI_SSID "YourNetwork"
#define WIFI_PASSWORD "YourPassword"
#define API_URL "https://your-api.com/api/v1"
#define DEVICE_UUID "esp-01"
```


## 🔐 Security

- ✅ HTTPS/TLS everywhere
- ✅ Device token authentication
- ✅ JWT with refresh tokens
- ✅ Row-level security (RLS) in Supabase
- ✅ Rate limiting on all endpoints
- ✅ Password hashing (bcrypt)
- ✅ Audit logs for critical operations
- ✅ CORS and CSP headers

## 📈 Scaling

- Supports 100+ devices
- Handles 10,000+ events/day per instance
- Horizontal scaling with load balancer
- Connection pooling for database
- Automatic backups and retention

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Integration tests
npm run test:integration

# Load testing
npm run test:load
```


## 🛠️ Deployment

### Option 1: Managed Services (Recommended)
- Database: Supabase (managed Postgres)
- Backend: Render / Railway / DigitalOcean App Platform
- Frontend: Vercel / Netlify

### Option 2: Docker Compose
```bash
cd infra
docker-compose up -d
```

### Option 3: Kubernetes
```bash
kubectl apply -f infra/k8s/
```

## 📖 Documentation

- [Hardware Setup Guide](docs/hardware-setup.md)
- [API Documentation](docs/api.md)
- [Firmware Development](firmware/README.md)
- [Dashboard User Guide](docs/user-guide.md)
- [Deployment Guide](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)

## 🤝 Support

For issues or questions:
1. Check [Troubleshooting Guide](docs/troubleshooting.md)
2. Review [FAQ](docs/faq.md)
3. Open an issue on GitHub

## 📝 License

MIT License - See LICENSE file for details

## 🎉 Acknowledgments

Built with ESP32, Supabase, React, and modern web standards for reliable attendance tracking in multi-tenant environments.

---

**Version:** 2.0.0  
**Last Updated:** October 29, 2025
