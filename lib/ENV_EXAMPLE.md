# QuickGuard — Environment Variables

Copy this file to .env and fill in real values.
NEVER commit .env with real secrets.

## Supabase

Found in: Supabase Dashboard → Project Settings → API

NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."

## App

NEXT_PUBLIC_SITE_URL="https://quickguard.uk"

## Auth

Set to "true" to enable Apple OAuth on login/register pages.
Requires Apple Developer credentials configured in Supabase Auth.
NEXT_PUBLIC_APPLE_AUTH_ENABLED="false"

## External Integrations

n8n webhook for SIA verification background checks
NEXT_PUBLIC_N8N_WEBHOOK_URL="https://your-instance.n8n.cloud/webhook-test/sia-verification"

Google Geocoding API key for address-to-coordinates conversion
Used by: geocode-address Edge Function
GOOGLE_GEOCODING_API_KEY="your_google_geocoding_api_key_here"

## Stripe

Do NOT put Stripe secret keys here.
Add them as Supabase Edge Function secrets instead (see lib/EDGE_FUNCTION_SECRETS.md).

Optional: Stripe publishable key for frontend Elements/Checkout.
Not currently used — checkout is handled server-side via Edge Functions.

## SAFETY WARNING

Do NOT add real secrets here (Stripe keys, SMTP passwords, service role keys).
All secrets go to Supabase Edge Function secrets only.
See: lib/EDGE_FUNCTION_SECRETS.md and lib/PRODUCTION_ENV_CHECKLIST.md
Make sure .gitignore includes .env before any commit.

Gmail SMTP is temporary for UAT/soft launch only.
Migrate send-job-posted-email to Resend before scaling beyond early testing.

## ADMIN_REGISTRATION_SECRET

This goes in Supabase Edge Function secrets, NOT here.
Generate: openssl rand -hex 32
Must be >= 32 characters.
Never commit the real value or store it in the database.