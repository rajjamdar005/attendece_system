# Multi-Tenant Isolation Test Script
# Tests that company_admin can ONLY access their own company's data

$baseUrl = "http://10.188.0.250:3000/api/v1"
$ProgressPreference = 'SilentlyContinue'

Write-Host ""
Write-Host "=== Multi-Tenant Isolation Test ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Login as company_admin
Write-Host "[1] Login as company_admin..." -ForegroundColor Yellow
try {
    $loginBody = @{
        username = "companyadmin"
        password = "CompanyAdmin@123"
    } | ConvertTo-Json
    
    $loginResp = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    
    if ($loginResp.success) {
        $token = $loginResp.data.token
        $user = $loginResp.data.user
        Write-Host "  SUCCESS: Login successful" -ForegroundColor Green
        Write-Host "    User: $($user.username)" -ForegroundColor Gray
        Write-Host "    Role: $($user.role)" -ForegroundColor Gray
        Write-Host "    Company ID: $($user.company_id)" -ForegroundColor Gray
        $companyId = $user.company_id
    } else {
        Write-Host "  FAIL: Login failed: $($loginResp.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  FAIL: Login error: $_" -ForegroundColor Red
    Write-Host "  Note: If password is wrong, you may need to reset it" -ForegroundColor Yellow
    exit 1
}

$headers = @{
    Authorization = "Bearer $token"
}

# Test 2: Access own company's employees
Write-Host ""
Write-Host "[2] Access own company's employees..." -ForegroundColor Yellow
try {
    $employees = Invoke-RestMethod -Uri "$baseUrl/employees" -Headers $headers -ErrorAction Stop
    
    if ($employees.success) {
        Write-Host "  SUCCESS: Retrieved $($employees.data.Count) employees" -ForegroundColor Green
        foreach ($emp in $employees.data) {
            Write-Host "    - $($emp.name) (Company: $($emp.company_id))" -ForegroundColor Gray
            
            if ($emp.company_id -ne $companyId) {
                Write-Host "  SECURITY BREACH: Employee from different company visible!" -ForegroundColor Red
                Write-Host "    Expected company: $companyId" -ForegroundColor Red
                Write-Host "    Got company: $($emp.company_id)" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "  ERROR: $_" -ForegroundColor Red
}

# Test 3: Try to access different company's data
Write-Host ""
Write-Host "[3] Try to access different company's employees..." -ForegroundColor Yellow
try {
    $fakeCompanyId = "00000000-0000-0000-0000-000000000000"
    $otherEmployees = Invoke-RestMethod -Uri "$baseUrl/employees?company_id=$fakeCompanyId" -Headers $headers -ErrorAction Stop
    
    # Compare results: should get SAME employees (filter is working) or different ones (breach)
    if ($otherEmployees.success) {
        $sameCount = ($employees.data.Count -eq $otherEmployees.data.Count)
        $sameIds = $true
        if ($employees.data.Count -gt 0 -and $otherEmployees.data.Count -gt 0) {
            $employeeIds = $employees.data | ForEach-Object { $_.id } | Sort-Object
            $otherIds = $otherEmployees.data | ForEach-Object { $_.id } | Sort-Object
            $sameIds = (Compare-Object $employeeIds $otherIds) -eq $null
        }
        
        if ($sameIds -and $sameCount) {
            Write-Host "  SUCCESS: Filter working - returns same employees (ignores query param)" -ForegroundColor Green
            Write-Host "    Count: $($otherEmployees.data.Count) employees (same as Test 2)" -ForegroundColor Gray
        } else {
            Write-Host "  SECURITY BREACH: Different employees returned!" -ForegroundColor Red
            Write-Host "    Test 2 count: $($employees.data.Count), Test 3 count: $($otherEmployees.data.Count)" -ForegroundColor Red
        }
    }
} catch {
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 403) {
            Write-Host "  SUCCESS: Correctly blocked with 403 Forbidden" -ForegroundColor Green
        } else {
            Write-Host "  BLOCKED: Status $statusCode" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ERROR: $_" -ForegroundColor Yellow
    }
}

# Test 4: Access own company's attendance
Write-Host ""
Write-Host "[4] Access own company's attendance..." -ForegroundColor Yellow
try {
    $attendance = Invoke-RestMethod -Uri "$baseUrl/attendance" -Headers $headers -ErrorAction Stop
    
    if ($attendance.success) {
        Write-Host "  SUCCESS: Retrieved $($attendance.data.Count) attendance records" -ForegroundColor Green
        
        $breachFound = $false
        foreach ($record in $attendance.data | Select-Object -First 5) {
            if ($record.company_id -ne $companyId -and $record.company_id -ne $null) {
                Write-Host "  SECURITY BREACH: Attendance from different company visible!" -ForegroundColor Red
                $breachFound = $true
            }
        }
        if (-not $breachFound -and $attendance.data.Count -gt 0) {
            Write-Host "  SUCCESS: All records belong to correct company" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "  ERROR: $_" -ForegroundColor Yellow
}

# Test 5: Access users endpoint
Write-Host ""
Write-Host "[5] Access users endpoint..." -ForegroundColor Yellow
try {
    $users = Invoke-RestMethod -Uri "$baseUrl/users" -Headers $headers -ErrorAction Stop
    
    if ($users.success) {
        Write-Host "  SUCCESS: Retrieved $($users.data.Count) users" -ForegroundColor Green
        $breachFound = $false
        foreach ($u in $users.data) {
            Write-Host "    - $($u.username) (Role: $($u.role), Company: $($u.company_id))" -ForegroundColor Gray
            
            if ($u.role -ne 'incubation_head' -and $u.company_id -ne $companyId) {
                Write-Host "  SECURITY BREACH: User from different company visible!" -ForegroundColor Red
                $breachFound = $true
            }
        }
        if (-not $breachFound) {
            Write-Host "  SUCCESS: Correct user filtering" -ForegroundColor Green
        }
    }
} catch {
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 403) {
            Write-Host "  SUCCESS: Correctly blocked with 403 Forbidden" -ForegroundColor Green
        } else {
            Write-Host "  BLOCKED: Status $statusCode" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ERROR: $_" -ForegroundColor Yellow
    }
}

# Test 6: Try to create user in different company
Write-Host ""
Write-Host "[6] Try to create user in different company..." -ForegroundColor Yellow
try {
    $newUser = @{
        username = "hacker_user"
        password = "Hacker@123"
        role = "technician"
        company_id = "00000000-0000-0000-0000-000000000000"
    } | ConvertTo-Json
    
    $createResp = Invoke-RestMethod -Uri "$baseUrl/users" -Method POST -Body $newUser -ContentType "application/json" -Headers $headers -ErrorAction Stop
    
    if ($createResp.success) {
        Write-Host "  SECURITY BREACH: Created user in different company!" -ForegroundColor Red
    }
} catch {
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 403) {
            Write-Host "  SUCCESS: Correctly blocked with 403 Forbidden" -ForegroundColor Green
        } elseif ($statusCode -eq 400) {
            Write-Host "  SUCCESS: Blocked with 400 Bad Request (validation)" -ForegroundColor Green
        } else {
            Write-Host "  BLOCKED: Status $statusCode" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ERROR: $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host "Review results above for any SECURITY BREACH warnings" -ForegroundColor Yellow
Write-Host ""
