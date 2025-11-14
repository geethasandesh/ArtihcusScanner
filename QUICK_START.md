# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
Create `.env` file (use same values from Flutter app's `.env`):
```bash
cp env.template .env
```

Edit `.env`:
```env
# Use the same SUPABASE_URL and SUPABASE_ANON_KEY from your Flutter app
# Just add VITE_ prefix for Vite to recognize them
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
VITE_QR_SECRET_KEY=artihcus_attendance_secret_2025
```

### 3. Run Database Migration
- Open Supabase SQL Editor
- Run `migration_attendance_table.sql`

### 4. Start Development Server
```bash
npm run dev
```

### 5. Open Browser
Navigate to `http://localhost:5173`

## 📱 How to Use

1. **Scanner Page** (`/`)
   - Click "Start Scanning"
   - Allow camera permissions
   - Point camera at QR code from Flutter app
   - Attendance is automatically marked

2. **Attendance Records** (`/attendance`)
   - View all attendance records
   - Filter by date (Today, Week, Month)
   - Refresh to see latest records

## 🔒 Security Features

- ✅ HMAC-SHA256 signature verification
- ✅ QR code expiration (60 seconds)
- ✅ One attendance per employee per day
- ✅ Duplicate prevention

## 🛠️ Troubleshooting

**Camera not working?**
- Use HTTPS or localhost
- Check browser permissions
- Try Chrome or Firefox

**Can't connect to Supabase?**
- Verify `.env` file has correct values
- Check Supabase project is active
- Ensure table exists

**QR code not scanning?**
- QR code must be from Flutter app
- QR code must be less than 60 seconds old
- Check secret key matches

