# API Testing Guide - User Management

## Base URL
```
http://10.188.0.250:3000/api/v1
```

## Authentication
All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 1. Login (Get JWT Token)

### Request
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

### Response
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "admin",
    "role": "incubation_head",
    "company_id": null
  }
}
```

## 2. List Users

### Request
```http
GET /api/v1/users?limit=50&offset=0
Authorization: Bearer <token>
```

### Query Parameters (Optional)
- `company_id` - Filter by company UUID
- `role` - Filter by role (incubation_head, company_admin, technician)
- `status` - Filter by status (active, inactive)
- `limit` - Results per page (default: 50)
- `offset` - Skip N results (default: 0)

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "john_admin",
      "role": "company_admin",
      "company_id": "company-uuid",
      "is_active": true,
      "last_login": "2026-01-12T01:00:00.000Z",
      "created_at": "2026-01-10T10:00:00.000Z",
      "companies": {
        "id": "company-uuid",
        "name": "Company A"
      }
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0
  }
}
```

## 3. Create User (Company Admin or Technician)

### Request
```http
POST /api/v1/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "jane_admin",
  "password": "SecurePass123!",
  "role": "company_admin",
  "company_id": "company-uuid-here",
  "full_name": "Jane Doe"
}
```

### Field Requirements
- **username**: 3-50 characters, unique
- **password**: Minimum 8 characters, must contain:
  - Uppercase letter (A-Z)
  - Lowercase letter (a-z)
  - Number (0-9)
  - Special character (@$!%*?&)
- **role**: Must be "company_admin" or "technician" (cannot create incubation_head)
- **company_id**: Valid company UUID
- **full_name**: Optional, max 100 characters

### Response
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "new-user-uuid",
    "username": "jane_admin",
    "role": "company_admin",
    "company_id": "company-uuid-here",
    "full_name": "Jane Doe",
    "is_active": true,
    "created_at": "2026-01-12T01:15:00.000Z",
    "companies": {
      "id": "company-uuid-here",
      "name": "Company A"
    }
  }
}
```

### Error Responses

**Username already exists**
```json
{
  "success": false,
  "message": "Username already exists"
}
```

**Invalid password**
```json
{
  "success": false,
  "message": "Password must contain uppercase, lowercase, number, and special character"
}
```

## 4. Update User

### Request
```http
PUT /api/v1/users/{user-id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "technician",
  "is_active": false,
  "password": "NewSecurePass456!",
  "full_name": "Jane Smith"
}
```

### Fields (All Optional)
- `role` - Change role (company_admin or technician)
- `is_active` - Activate/deactivate user (true/false)
- `company_id` - Move user to different company
- `password` - Reset password (must meet complexity requirements)
- `full_name` - Update display name

### Response
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": "user-uuid",
    "username": "jane_admin",
    "role": "technician",
    "is_active": false,
    "updated_at": "2026-01-12T01:20:00.000Z",
    "companies": {
      "id": "company-uuid",
      "name": "Company A"
    }
  }
}
```

### Restrictions
- Cannot modify incubation_head users
- Only incubation_head can call this endpoint

## 5. Delete User

### Request
```http
DELETE /api/v1/users/{user-id}
Authorization: Bearer <token>
```

### Response
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### Restrictions
- Cannot delete incubation_head users
- Cannot delete your own account
- Only incubation_head can call this endpoint

## Rate Limiting

### Auth Endpoints (`/api/v1/auth/*`)
- **Limit**: 5 requests per 15 minutes per IP
- **Error Response** (429):
```json
{
  "success": false,
  "message": "Too many login attempts, please try again after 15 minutes."
}
```

### User Management Endpoints (`/api/v1/users/*`)
- **Limit**: 100 requests per 15 minutes per IP
- **Error Response** (429):
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again after 15 minutes."
}
```

## Testing with cURL

### 1. Login
```bash
curl -X POST http://10.188.0.250:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
```

### 2. Create User
```bash
curl -X POST http://10.188.0.250:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "username": "test_admin",
    "password": "TestPass123!",
    "role": "company_admin",
    "company_id": "COMPANY_UUID_HERE",
    "full_name": "Test Admin"
  }'
```

### 3. List Users
```bash
curl -X GET "http://10.188.0.250:3000/api/v1/users?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Update User
```bash
curl -X PUT http://10.188.0.250:3000/api/v1/users/USER_UUID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "is_active": false
  }'
```

### 5. Delete User
```bash
curl -X DELETE http://10.188.0.250:3000/api/v1/users/USER_UUID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Testing with Postman

1. Create a new collection "RFID Attendance API"
2. Add environment variable `baseUrl` = `http://10.188.0.250:3000/api/v1`
3. Add environment variable `token` (will be set after login)

### Pre-request Script for Authenticated Requests
```javascript
pm.request.headers.add({
  key: 'Authorization',
  value: 'Bearer ' + pm.environment.get('token')
});
```

### Test Script for Login (to save token)
```javascript
if (pm.response.code === 200) {
  var jsonData = pm.response.json();
  pm.environment.set('token', jsonData.token);
}
```

## Common Issues

### 403 Forbidden
- **Cause**: Not authorized for this role
- **Solution**: Only incubation_head can manage users

### 401 Unauthorized
- **Cause**: Missing or invalid JWT token
- **Solution**: Login again to get fresh token

### 409 Conflict
- **Cause**: Username already exists
- **Solution**: Choose different username

### 429 Too Many Requests
- **Cause**: Hit rate limit
- **Solution**: Wait 15 minutes before trying again

## Testing Checklist

- [ ] Login as incubation_head
- [ ] Create company_admin for Company A
- [ ] Create company_admin for Company B
- [ ] Login as Company A admin
- [ ] Try to list users (should only see Company A users)
- [ ] Try to create user (should fail - forbidden)
- [ ] Login as incubation_head again
- [ ] Update user (deactivate)
- [ ] Delete user
- [ ] Test rate limiting (try 6 logins rapidly)
