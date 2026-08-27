import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function geocodePostcode(apiKey: string, postcode: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${postcode}, UK`)}&region=uk&key=${apiKey}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.[0]) return null;
    const r = data.results[0];
    return {
      latitude: r.geometry.location.lat as number,
      longitude: r.geometry.location.lng as number,
    };
  } catch {
    return null;
  }
}

function cleanPostcode(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('GOOGLE_GEOCODING_API_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_GEOCODING_API_KEY is not configured. Add it to Supabase edge function secrets first.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  try {
    const authHeader = req.headers.get('Authorization');
    let adminCheck = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token.length > 40) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: jwtMatch } = await supabase
            .from('admin_users')
            .select('id, email, full_name')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();
          adminCheck = jwtMatch;
        }
      }
    }

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: Record<string, any> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const dryRun = body?.dry_run === true;

    const summary: Record<string, any> = {
      guards: { found: 0, geocoded: 0, failed: 0, skipped_no_postcode: 0 },
      jobs: { found: 0, geocoded: 0, failed: 0, skipped_no_postcode: 0 },
      dry_run: dryRun,
    };

    const { data: guards, error: guardsErr } = await supabase
      .from('guards')
      .select('id, postcode, home_latitude, home_longitude')
      .is('home_latitude', null);

    if (guardsErr) {
      return new Response(
        JSON.stringify({ error: `Failed to load guards: ${guardsErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const g of guards || []) {
      const postcode = cleanPostcode(g.postcode);
      if (!postcode) {
        summary.guards.skipped_no_postcode++;
        continue;
      }
      summary.guards.found++;
      const geo = await geocodePostcode(apiKey, postcode);
      if (!geo) {
        summary.guards.failed++;
        continue;
      }
      if (!dryRun) {
        await supabase
          .from('guards')
          .update({ home_latitude: geo.latitude, home_longitude: geo.longitude })
          .eq('id', g.id);
      }
      summary.guards.geocoded++;
      await new Promise((r) => setTimeout(r, 120));
    }

    const { data: jobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('id, venue_postcode, postcode, latitude, longitude')
      .is('latitude', null);

    if (jobsErr) {
      return new Response(
        JSON.stringify({ error: `Failed to load jobs: ${jobsErr.message}`, summary }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const j of jobs || []) {
      const postcode = cleanPostcode(j.venue_postcode) || cleanPostcode(j.postcode);
      if (!postcode) {
        summary.jobs.skipped_no_postcode++;
        continue;
      }
      summary.jobs.found++;
      const geo = await geocodePostcode(apiKey, postcode);
      if (!geo) {
        summary.jobs.failed++;
        continue;
      }
      if (!dryRun) {
        await supabase
          .from('jobs')
          .update({ latitude: geo.latitude, longitude: geo.longitude, geocoded_at: new Date().toISOString() })
          .eq('id', j.id);
      }
      summary.jobs.geocoded++;
      await new Promise((r) => setTimeout(r, 120));
    }

    return new Response(
      JSON.stringify({ success: true, summary }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
