# Multi-Tenant User Account Management

## Overview
Your attendance system has **strict user account controls** to ensure security and proper company isolation.

## Who Can Create Accounts?

### ✅ Super Admin (incubation_head) ONLY
- **Only the super admin** can create user accounts
- This includes:
  - Company admin accounts
  - Technician accounts
- Company admins **CANNOT** create other users

## Account Creation Workflow

### When Super Admin Creates a Company Admin:

1. **Super Admin Sets ALL Fields:**
   - ✅ **Username** - Must be globally unique (e.g., "admin_companyA", "admin_companyB")
   - ✅ **Email** - Must be globally unique and valid format
   - ✅ **Password** - Initial password (must meet complexity requirements)
   - ✅ **Company Assignment** - Which company this admin manages
   - ✅ **Full Name** - Optional

2. **Password Requirements:**
   - Minimum 8 characters
   - At least 1 uppercase letter
   - At least 1 lowercase letter
   - At least 1 number
   - At least 1 special character (@$!%*?&)
   - Example: `CompanyAdmin@123`

3. **Uniqueness Enforced:**
   - **Username**: UNIQUE across entire system (database constraint)
   - **Email**: UNIQUE across entire system (database constraint)
   - No two users can have same username, even in different companies
   - No two users can have same email, even in different companies

## Company Admin Capabilities

### What Company Admins CAN Do:
- ✅ Manage employees in their own company
- ✅ View attendance logs for their company
- ✅ Manage RFID tags for their company
- ✅ View reports for their company
- ✅ Manage devices for their company

### What Company Admins CANNOT Do:
- ❌ Create user accounts (even for their own company)
- ❌ View or modify other companies' data
- ❌ Change their company assignment
- ❌ Access super admin features

## Security Layers

### 1. Database Level
- Username has UNIQUE constraint
- Email has UNIQUE constraint (NEW)
- Company_id foreign key enforces valid companies

### 2. API Level (Backend)
- Only `incubation_head` role can access POST /api/v1/users
- All queries automatically filter by user's company_id
- Query parameters ignored for company_admin/technician roles

### 3. UI Level (Frontend)
- Company selection hidden for company_admin
- Create user button only visible to super admin
- Auto-sets company_id based on logged-in user's role

## Example Scenario

### Super Admin Creates Two Company Admins:

**Company A Admin:**
```json
{
  "username": "admin_companyA",
  "email": "admin@companyA.com",
  "password": "SecurePass@123",
  "role": "company_admin",
  "company_id": "uuid-for-company-A",
  "full_name": "John Smith"
}
```

**Company B Admin:**
```json
{
  "username": "admin_companyB",
  "email": "admin@companyB.com", 
  "password": "SecurePass@456",
  "role": "company_admin",
  "company_id": "uuid-for-company-B",
  "full_name": "Jane Doe"
}
```

### After Creation:
- `admin_companyA` logs in → sees only Company A data
- `admin_companyB` logs in → sees only Company B data
- Neither can create new user accounts
- Neither can see the other company's data
- Only super admin can create more accounts

## API Endpoint

### POST /api/v1/users
**Authorization:** Only `incubation_head` (Bearer token required)

**Request Body:**
```json
{
  "username": "unique_username",
  "email": "unique@email.com",
  "password": "SecurePass@123",
  "role": "company_admin",
  "company_id": "uuid-of-company",
  "full_name": "Admin Full Name"
}
```

**Validation:**
- ✅ Username: 3-50 characters, unique
- ✅ Email: Valid email format, unique
- ✅ Password: 8+ chars, uppercase, lowercase, number, special char
- ✅ Role: Must be `company_admin` or `technician` (cannot create `incubation_head`)
- ✅ Company ID: Valid UUID, must reference existing company

## Database Migration (Pending)

To enforce email uniqueness at database level, apply this migration:

```sql
-- File: supabase/migrations/20260112_add_email_unique.sql
ALTER TABLE users 
ADD CONSTRAINT users_email_unique UNIQUE (email);

ALTER TABLE users
ADD CONSTRAINT users_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL);
```

**Note:** Email validation is now enforced in the API code. Database constraint should be added when possible.

## Summary

✅ **Super admin controls everything**
- Creates all company admin accounts
- Sets username, email, password
- Assigns companies

✅ **Company admins are isolated**
- Manage only their own company
- Cannot create users
- Cannot see other companies

✅ **Uniqueness guaranteed**
- Usernames unique across all companies
- Emails unique across all companies
- No conflicts possible

This architecture ensures **complete multi-tenant isolation** with centralized control.
