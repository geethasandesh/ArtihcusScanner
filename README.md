# Attendance Scanner Website

A React + Vite + Tailwind CSS website for scanning QR codes from the Artihcus Internal Chat app and marking attendance in Supabase.

## Features

- 📷 QR Code Scanner with camera access
- 🔐 HMAC-SHA256 signature verification
- ⏱️ Timestamp freshness validation (60 seconds)
- 💾 Supabase integration for attendance storage
- 📊 Attendance records display
- 🎨 Modern UI with Tailwind CSS

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the Scanner directory:
```bash
# Copy the template
cp env.template .env
```

3. Fill in your Supabase credentials (same as your Flutter app):
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
VITE_QR_SECRET_KEY=artihcus_attendance_secret_2025
```

**Note:** Use the same `SUPABASE_URL` and `SUPABASE_ANON_KEY` values from your Flutter app's `.env` file, but prefix them with `VITE_` for Vite to recognize them.

4. Run the database migration:
- Execute `migration_attendance_table.sql` in your Supabase SQL Editor

5. Start the development server:
```bash
npm run dev
```

## Database Setup

Before using the scanner, you need to create the attendance table in Supabase. Run the SQL migration file:

```sql
-- See migration_attendance_table.sql
```

## Usage

1. Open the scanner page
2. Allow camera access when prompted
3. Point the camera at the QR code displayed on the employee's phone
4. The attendance will be automatically marked if:
   - The QR code signature is valid
   - The QR code is not older than 60 seconds
   - The employee hasn't already marked attendance today

## Security

- QR codes are verified using HMAC-SHA256 signatures
- QR codes expire after 60 seconds
- Only one attendance record per employee per day is allowed
- All scans are logged for audit purposes

