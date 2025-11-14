# Setup Instructions

## Prerequisites

- Node.js 18+ and npm installed
- Supabase account and project
- Camera access permissions for the browser

## Step 1: Install Dependencies

```bash
cd Scanner
npm install
```

## Step 2: Configure Environment Variables

Create a `.env` file in the Scanner directory:

```bash
# Copy the template
cp env.template .env
```

Edit `.env` and add your Supabase credentials. **Use the same values from your Flutter app's `.env` file:**

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
VITE_QR_SECRET_KEY=artihcus_attendance_secret_2025
```

**Important Notes:**
- Use the **same** `SUPABASE_URL` and `SUPABASE_ANON_KEY` from your Flutter app's `.env` file
- In Vite, environment variables must be prefixed with `VITE_` to be accessible in the app
- The QR secret key must match exactly between the Flutter app and this website

**How to get Supabase credentials (if you don't have them):**
1. Go to your Supabase project dashboard
2. Click on "Settings" → "API"
3. Copy the "Project URL" (for `VITE_SUPABASE_URL`)
4. Copy the "anon public" key (for `VITE_SUPABASE_ANON_KEY`)

## Step 3: Set Up Database

1. Open your Supabase project dashboard
2. Go to "SQL Editor"
3. Run the migration file: `migration_attendance_table.sql`
4. This will create the `attendance_records` table with proper indexes and RLS policies

## Step 4: Run the Application

```bash
npm run dev
```

The application will start on `http://localhost:5173` (or another port if 5173 is busy).

## Step 5: Build for Production

```bash
npm run build
```

The production build will be in the `dist` folder.

## Troubleshooting

### Camera Not Working
- Make sure you're using HTTPS or localhost (required for camera access)
- Check browser permissions for camera access
- Try a different browser (Chrome/Firefox recommended)

### Supabase Connection Issues
- Verify your `.env` file has the correct values
- Check that your Supabase project is active
- Ensure the `attendance_records` table exists

### QR Code Not Scanning
- Ensure the QR code is generated from the Flutter app
- Check that the QR code is not older than 60 seconds
- Verify the secret key matches between app and website

## Security Notes

- The secret key should be the same in both the Flutter app and this website
- In production, consider using environment variables or a secure key management service
- The website uses the Supabase anon key, which is safe for client-side use with RLS policies

