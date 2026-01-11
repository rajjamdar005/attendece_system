# Complete Multi-Tenant Workflow

## Overview
This document describes the complete workflow from super admin creating companies to company admins managing their own data.

---

## Super Admin Workflow

### 1. Create Company with Admin Account

**Step 1:** Login as super admin
- Username: `admin`
- Password: `Admin@123`

**Step 2:** Navigate to "Companies" page

**Step 3:** Click "Add Company"

**Step 4:** Fill in company details:
- **Company Name** (required)
- Address
- Contact Person
- Contact Email
- Contact Phone

**Step 5:** Create admin account (same form):
- **Admin Username** (required, unique globally)
  - Example: `techcorp_admin`, `startup_admin`
  - Min 3 characters
  - Letters, numbers, underscores only
  
- **Admin Email** (required, unique globally)
  - Example: `admin@techcorp.com`
  - Must be valid email format
  
- **Admin Password** (required)
  - Min 8 characters
  - Must have: uppercase, lowercase, number, special character
  - Example: `TechCorp@2026`

**Step 6:** Click "Create Company"

**Result:**
- ✅ Company created in database
- ✅ Company admin account created automatically
- ✅ Admin linked to their company
- ✅ Admin can immediately login

---

## Company Admin Workflow

### 1. Login

**Credentials:** Use the username and password set by super admin
- Example:
  - Username: `techcorp_admin`
  - Password: `TechCorp@2026`

### 2. Dashboard View

**What Company Admin Sees:**
- ✅ **Their company name** displayed in profile
- ✅ **Only their company's data**:
  - Total scans for their company
  - Their active devices
  - Their employees count
  - Recent attendance for their employees
- ❌ **Cannot see other companies**
- ❌ **No company filter** (locked to their company)

### 3. Manage Employees

**Navigate to:** Employees page

**What Company Admin Can Do:**
- ✅ View all employees in their company
- ✅ Add new employees to their company
- ✅ Edit employee details
- ✅ Delete employees
- ✅ Assign RFID tags to employees
- ❌ Cannot see employees from other companies
- ❌ Company field is auto-set (no dropdown shown)

**Adding Employee:**
1. Click "Add Employee"
2. Fill in details (name, email, phone, department, etc.)
3. Company is automatically set to their company
4. Click "Create Employee"

### 4. View Reports

**Navigate to:** Reports page

**What Company Admin Sees:**
- ✅ Attendance reports for their company only
- ✅ Daily summary for their company
- ✅ Export attendance data for their company
- ❌ Cannot see other companies' reports
- ❌ No company filter (locked to their company)

### 5. Manage Devices

**Navigate to:** Devices page

**What Company Admin Can Do:**
- ✅ View devices
- ✅ Register new devices
- ✅ Check device status
- Note: Device management may be shared across companies (technician role)

---

## Super Admin Dashboard Features

### Company Filtering

**What Super Admin Sees:**
- ✅ **Company dropdown filter** in dashboard header
- ✅ Can select "All Companies" or specific company
- ✅ Dashboard updates based on selection:
  - Scans filtered by selected company
  - Devices filtered by company
  - Employees count for selected company
  - Attendance feed for selected company

**How to Use:**
1. Login as super admin
2. Go to Dashboard
3. Click company dropdown (next to clock)
4. Select company or "All Companies"
5. Stats update automatically

---

## Security & Isolation

### Username Uniqueness
- ✅ Usernames must be unique **across ALL companies**
- ✅ Example: If Company A has `admin_a`, Company B cannot use `admin_a`
- ✅ Prevents login confusion
- ✅ Enforced at database level

### Email Uniqueness
- ✅ Emails must be unique **across ALL companies**
- ✅ Example: `admin@company.com` can only be used once
- ✅ Prevents account conflicts
- ✅ Enforced at API and database level

### Data Isolation
- ✅ Company A admin **CANNOT** see Company B data
- ✅ Enforced at:
  - **Database level:** Row-level security (RLS)
  - **API level:** company_id filtering in all routes
  - **UI level:** Auto-set company, hidden filters

### Permission Levels

**Incubation Head (Super Admin):**
- ✅ Create/edit/delete companies
- ✅ Create/edit/delete admin accounts
- ✅ View ALL companies' data
- ✅ Filter by specific company
- ✅ Manage system settings

**Company Admin:**
- ✅ View ONLY their company data
- ✅ Manage employees in their company
- ✅ View reports for their company
- ❌ Cannot create user accounts
- ❌ Cannot see other companies
- ❌ Cannot change their assigned company

**Technician:**
- ✅ View devices
- ✅ View attendance (read-only)
- ❌ Cannot modify data
- ❌ Limited access

---

## Example Scenarios

### Scenario 1: Incubation Center with 3 Companies

**Companies:**
1. **TechCorp** - 50 employees
2. **StartupHub** - 20 employees
3. **InnovateLabs** - 35 employees

**Setup by Super Admin:**

**Create TechCorp:**
- Company Name: TechCorp
- Admin Username: `techcorp_admin`
- Admin Email: `admin@techcorp.com`
- Admin Password: `TechCorp@2026`

**Create StartupHub:**
- Company Name: StartupHub
- Admin Username: `startuphub_admin`
- Admin Email: `admin@startuphub.com`
- Admin Password: `StartupHub@2026`

**Create InnovateLabs:**
- Company Name: InnovateLabs
- Admin Username: `innovatelabs_admin`
- Admin Email: `admin@innovatelabs.com`
- Admin Password: `InnovateLabs@2026`

**Result:**
- 3 separate companies
- 3 separate admin accounts
- Each admin can ONLY see their own company
- Super admin can switch between all 3

---

## API Endpoints

### Company Creation with Admin
```
POST /api/v1/companies/with-admin
Authorization: Bearer <super_admin_token>

Body:
{
  "company": {
    "name": "TechCorp",
    "address": "123 Tech Street",
    "contact_person": "John Doe",
    "contact_email": "contact@techcorp.com",
    "contact_phone": "+1234567890"
  },
  "admin": {
    "username": "techcorp_admin",
    "email": "admin@techcorp.com",
    "password": "TechCorp@2026"
  }
}

Response:
{
  "success": true,
  "data": {
    "company": { "id": "...", "name": "TechCorp", ... },
    "admin": { "id": "...", "username": "techcorp_admin", ... }
  }
}
```

### Login as Company Admin
```
POST /api/v1/auth/login

Body:
{
  "username": "techcorp_admin",
  "password": "TechCorp@2026"
}

Response:
{
  "success": true,
  "data": {
    "token": "eyJ...",
    "user": {
      "id": "...",
      "username": "techcorp_admin",
      "role": "company_admin",
      "company_id": "..."
    }
  }
}
```

---

## Testing Checklist

### Create Company Flow
- [ ] Super admin can create company with admin account
- [ ] Company name is required
- [ ] Admin username validation (min 3 chars, alphanumeric)
- [ ] Admin email validation (valid format)
- [ ] Admin password validation (8+ chars, complexity)
- [ ] Username uniqueness enforced
- [ ] Email uniqueness enforced
- [ ] Admin account created automatically
- [ ] Admin assigned to correct company

### Company Admin Login
- [ ] Company admin can login with credentials
- [ ] JWT token issued correctly
- [ ] User object contains company_id

### Company Admin Dashboard
- [ ] Shows only their company's data
- [ ] Cannot see other companies
- [ ] Company filter NOT shown (locked to their company)
- [ ] Stats correct (scans, devices, employees)
- [ ] Live feed shows only their employees

### Company Admin Employees
- [ ] Can view only their company's employees
- [ ] Can add employees (company auto-set)
- [ ] Company dropdown NOT shown
- [ ] Cannot see other companies' employees

### Company Admin Reports
- [ ] Can view only their company's reports
- [ ] Company filter NOT shown (locked to their company)
- [ ] Export works for their company only

### Super Admin Dashboard
- [ ] Company filter dropdown shown
- [ ] Can select "All Companies"
- [ ] Can select specific company
- [ ] Stats update when filter changes
- [ ] Can see all companies' data

### Security
- [ ] Company A admin cannot access Company B data
- [ ] API enforces company filtering
- [ ] Username collision prevented
- [ ] Email collision prevented
- [ ] SQL injection attempts blocked
- [ ] XSS attempts sanitized

---

## Troubleshooting

### "Username already exists"
- **Cause:** Username is taken by another company
- **Solution:** Choose a different username (e.g., add company prefix)

### "Email already registered"
- **Cause:** Email is used by another account
- **Solution:** Use a unique email address

### "Password does not meet requirements"
- **Cause:** Password too weak
- **Solution:** Use min 8 chars with uppercase, lowercase, number, and special character

### Company admin sees "Access Denied"
- **Cause:** Trying to access super admin features (e.g., Companies, Users pages)
- **Solution:** This is normal - only super admin can access those pages

### No data shown on dashboard
- **Cause:** No employees or attendance records yet
- **Solution:** Add employees and wait for RFID scans

---

## Next Steps

### Recommended Enhancements
1. **Email Notifications**
   - Send welcome email when admin account is created
   - Include login credentials and getting started guide

2. **Password Reset**
   - Allow admins to reset their password
   - Email-based password reset flow

3. **Company Branding**
   - Upload company logo
   - Custom color scheme per company

4. **Multi-Admin Support**
   - Allow multiple admins per company
   - Role hierarchy (primary admin, secondary admin)

5. **Activity Logs**
   - Track all admin actions
   - Show login history
   - Audit trail for compliance

---

## Support

For issues or questions:
1. Check this documentation first
2. Review error messages carefully
3. Check browser console for detailed errors
4. Verify credentials are correct
5. Contact system administrator

---

## Summary

✅ **Super Admin:**
- Creates companies
- Creates admin accounts (same form)
- Views all data with company filter
- Manages entire system

✅ **Company Admin:**
- Logs in with credentials
- Sees only their company
- Manages their employees
- Views their reports
- Cannot access other companies

✅ **Security:**
- Username unique globally
- Email unique globally
- Data isolated by company
- Multi-layer filtering (DB + API + UI)
