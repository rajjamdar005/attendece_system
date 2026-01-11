# ESP32 RFID Attendance System - Quick Install Script
# Run this in PowerShell from the project root

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "ESP32 RFID Attendance System" -ForegroundColor Cyan
Write-Host "Quick Installation Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "✓ npm found: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Install backend dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Push-Location backend
if (Test-Path package.json) {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Backend dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ Backend installation failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
} else {
    Write-Host "✗ backend/package.json not found" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host ""

# Install frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location frontend
if (Test-Path package.json) {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "✗ Frontend installation failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
} else {
    Write-Host "✗ frontend/package.json not found" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host ""

# Create .env files if they don't exist
Write-Host "Checking environment files..." -ForegroundColor Yellow

if (-not (Test-Path "backend/.env")) {
    Copy-Item "backend/.env.example" "backend/.env"
    Write-Host "✓ Created backend/.env from template" -ForegroundColor Green
    Write-Host "  ⚠ Please edit backend/.env with your Supabase credentials" -ForegroundColor Yellow
} else {
    Write-Host "✓ backend/.env already exists" -ForegroundColor Green
}

if (-not (Test-Path "frontend/.env")) {
    Copy-Item "frontend/.env.example" "frontend/.env"
    Write-Host "✓ Created frontend/.env from template" -ForegroundColor Green
    Write-Host "  ⚠ Please edit frontend/.env with your API URL" -ForegroundColor Yellow
} else {
    Write-Host "✓ frontend/.env already exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Set up Supabase project and run migrations" -ForegroundColor White
Write-Host "2. Edit backend/.env with your Supabase credentials" -ForegroundColor White
Write-Host "3. Edit frontend/.env with your API URL" -ForegroundColor White
Write-Host "4. Start backend: cd backend; npm run dev" -ForegroundColor White
Write-Host "5. Start frontend: cd frontend; npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "For detailed instructions, see GETTING_STARTED.md" -ForegroundColor Cyan
Write-Host ""
