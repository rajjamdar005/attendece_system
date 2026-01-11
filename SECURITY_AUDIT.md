# Security & Architecture Audit Report
**Date**: January 12, 2026  
**System**: RFID Attendance Multi-Tenant System

## Executive Summary
This audit identifies critical security gaps and provides actionable fixes for a production-ready, scalable multi-tenant system.

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. **Supabase Client Using Service Role Key**
**Status**: 🔴 CRITICAL  
**Location**: `backend/src/config/database.js`  
**Issue**: Backend uses `service_role` key which **BYPASSES ALL RLS POLICIES**  
**Impact**: Any compromised endpoint can access ALL data across ALL companies  
**Fix**: Use `anon` key and pass user JWT to Supabase for RLS enforcement

```javascript
// CURRENT (INSECURE):
const supabase = createClient(url, SERVICE_ROLE_KEY); // Bypasses RLS!

// SHOULD BE:
const supabase = createClient(url, ANON_KEY);
// Then set auth context per request: supabase.auth.setSession(userJWT)
```

### 2. **Missing Input Sanitization**
**Status**: 🔴 CRITICAL  
**Location**: All route handlers  
**Issue**: No XSS/SQL injection protection beyond basic validation  
**Fix**: Add DOMPurify for frontend, parameterized queries (already using Supabase), rate limiting

### 3. **No Rate Limiting**
**Status**: 🔴 CRITICAL  
**Issue**: API vulnerable to brute-force attacks (login), DoS  
**Fix**: Implement `express-rate-limit` on auth endpoints (5 attempts/15min)

### 4. **Weak Password Policy**
**Status**: 🟡 HIGH  
**Location**: User registration (not yet implemented)  
**Issue**: No password complexity requirements  
**Fix**: Enforce 8+ chars, uppercase, lowercase, number, special char

### 5. **No CORS Configuration**
**Status**: 🟡 HIGH  
**Issue**: API accepts requests from any origin  
**Fix**: Whitelist frontend domain only

---

## 🟡 MULTI-TENANCY GAPS

### 1. **Incomplete Company Isolation**
**Routes with proper filtering**: ✅ `/companies`, `/tags`  
**Routes MISSING company_id filter**:
- ❌ `/attendance` - Can query other companies' attendance
- ❌ `/employees` - Needs company_id enforcement
- ❌ `/devices` - Device assignment to companies incomplete
- ❌ `/reports` - No company scoping

**Fix**: Add `checkCompanyAccess()` middleware to ALL routes

### 2. **User Management Missing**
**Status**: 🟡 HIGH  
**Missing Endpoints**:
- `POST /api/v1/users` - Create company admin (incubation_head only)
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Deactivate user
- `GET /api/v1/users` - List users (with company filtering)

### 3. **Audit Logging Incomplete**
**Status**: 🟡 MEDIUM  
**Issue**: `audit_logs` table exists but not populated  
**Fix**: Log all mutations (create/update/delete) with user_id, IP, action

---

## 🔵 SCALING CONCERNS

### 1. **No Pagination**
**Impact**: Loading 10,000+ attendance records will timeout  
**Fix**: Add `?page=1&limit=50` to all GET endpoints

### 2. **No Caching**
**Fix**: Add Redis for:
- User sessions
- Company metadata
- Frequently accessed reports

### 3. **Inefficient Queries**
**Issue**: N+1 queries in `/tags` (fetches employee per tag)  
**Fix**: Use Supabase `.select('*, employees(*)')` joins

### 4. **No Background Jobs**
**Use Cases**:
- Bulk employee import
- Report generation (PDF/Excel)
- Email notifications  
**Fix**: Implement BullMQ with Redis

---

## ✅ EXISTING STRENGTHS

1. ✅ JWT authentication implemented
2. ✅ bcrypt password hashing (10 rounds)
3. ✅ Device token authentication (SHA-256)
4. ✅ RLS policies defined (but bypassed by service_role!)
5. ✅ Role-based authorization middleware
6. ✅ Database indexes on critical columns
7. ✅ Input validation with express-validator
8. ✅ Prepared statements (Supabase prevents SQL injection)

---

## 📋 IMPLEMENTATION PRIORITY

### Phase 1: Security Fixes (TONIGHT)
1. ⚠️ Add rate limiting
2. ⚠️ Implement CORS whitelist
3. ⚠️ Add company_id filtering to ALL routes
4. ⚠️ Create user management endpoints
5. ⚠️ Password complexity validation
6. ⚠️ Audit logging triggers

### Phase 2: Frontend (TONIGHT)
1. Login page with JWT storage
2. Protected routes
3. Role-based navigation
4. Company selector (for super admin)
5. Employee/RFID management UI
6. Attendance log viewer

### Phase 3: Scaling (NEXT SESSION)
1. Pagination
2. Redis caching
3. Background jobs
4. Switch to anon key + RLS (requires testing)
5. Load testing

---

## 🎯 RECOMMENDED ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  React + Protected Routes + Role-Based Nav          │
│  JWT stored in httpOnly cookie (not localStorage!)  │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS only
┌──────────────────▼──────────────────────────────────┐
│              API GATEWAY (future)                    │
│  Rate Limiting │ CORS │ DDoS Protection             │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│           BACKEND (Node.js/Express)                  │
│  ✓ JWT Verification                                  │
│  ✓ Role-based Authorization                          │
│  ✓ Input Validation                                  │
│  ✓ Company-scoped Queries                            │
│  ✓ Audit Logging                                     │
└──────┬──────────────────────────┬───────────────────┘
       │                          │
┌──────▼──────┐          ┌────────▼────────┐
│  Supabase   │          │  Redis Cache    │
│  PostgreSQL │          │  (sessions,     │
│  (with RLS) │          │   metadata)     │
└─────────────┘          └─────────────────┘
```

---

## 🔐 DATA ISOLATION STRATEGY

### Option A: Application-Level (Current - NEEDS FIXES)
- Backend enforces company_id filtering
- Pros: Flexible, easier to debug
- Cons: Risk if developer forgets filter

### Option B: Database-Level (RLS - RECOMMENDED)
- PostgreSQL RLS enforces isolation at DB level
- Pros: Impossible to bypass, fail-safe
- Cons: Complex setup, harder to debug

**Recommendation**: Use BOTH - application-level + RLS as safety net

---

## 📝 COMPLIANCE CHECKLIST

- [ ] GDPR: Right to deletion (employee data purge)
- [ ] GDPR: Data export (attendance CSV/PDF)
- [ ] SOC2: Audit logs for all access
- [ ] SOC2: Encryption at rest (Supabase default)
- [ ] SOC2: Encryption in transit (HTTPS)
- [ ] Password rotation policy
- [ ] Session timeout (JWT expiry: 24h recommended)
- [ ] 2FA (future enhancement)

---

## 🚀 NEXT STEPS

1. Review this document
2. Approve implementation phases
3. Start Phase 1 (security fixes)
4. Build frontend (Phase 2)
5. Deploy with environment-based config (dev/staging/prod)
