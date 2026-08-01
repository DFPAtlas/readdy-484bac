import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// KNOWN PLATFORM LIMITATION — PostGIS spatial_ref_sys RLS
// ---------------------------------------------------------------------------
// Supabase Security Advisor may flag: rls_disabled_in_public on
// public.spatial_ref_sys. This table is owned by supabase_admin and
// installed automatically as part of the PostGIS extension.
// Attempting "ALTER TABLE ... ENABLE ROW LEVEL SECURITY" fails with
// "must be owner of table spatial_ref_sys".
//
// It is safe to ignore because:
// 1. spatial_ref_sys is a read-only reference table (EPSG codes, projections).
// 2. No application tables in this project use geometry / geography columns.
// 3. Geocoding is handled by the "geocode-address" Edge Function (Google Maps
//    API), not by PostGIS spatial queries.
//
// Resolution: contact Supabase Support to either enable RLS at the platform
// level, relocate PostGIS to a dedicated schema, or allow-list the table.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'app'
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce'
  }
})

export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: {
          schema: 'app'
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )
  }
  return supabase
}
