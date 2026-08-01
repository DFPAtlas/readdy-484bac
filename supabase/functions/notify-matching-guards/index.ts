import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function haversineDistanceMiles(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function guardEffectiveMaxDistance(guard: any): number | null {
  if (guard.max_distance_miles !== null && guard.max_distance_miles !== undefined && guard.max_distance_miles > 0) {
    return guard.max_distance_miles;
  }
  if (guard.default_search_radius_km !== null && guard.default_search_radius_km !== undefined && guard.default_search_radius_km > 0) {
    return guard.default_search_radius_km * 0.621371;
  }
  return null;
}

async function sendPushNotification(supabaseUrl: string, supabaseServiceKey: string, userId: string, role: string, title: string, body: string, url?: string) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        userId,
        role,
        title,
        body,
        url: url || '/',
        tag: 'quickguard-job-match',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { jobId } = await req.json();
    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'jobId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: clientData, error: clientError } = await adminSupabase
      .from('clients')
      .select('id, client_type')
      .eq('user_id', user.id)
      .maybeSingle();

    if (clientError || !clientData) {
      return new Response(
        JSON.stringify({ error: 'Client account not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: job, error: jobError } = await adminSupabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.client_id !== clientData.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: you do not own this job' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const directClientTypes = ['venue', 'event_organiser', 'business', 'individual'];
    const isDirectBooking = directClientTypes.includes(clientData.client_type || '') && !!job.venue_category;

    const securityTypeMap: Record<string, string> = {
      'door-supervisor': 'Door Supervisor',
      'event-security': 'Event Security',
      'retail-security': 'Retail Security',
      'close-protection': 'Close Protection',
      'cctv-operator': 'CCTV Operator',
      'security-guard': 'Security Guard',
      'mobile-patrol': 'Mobile Patrol',
      'key-holding': 'Key Holding',
      'dog-handler': 'Dog Handler',
      'door_supervisor': 'Door Supervisor',
      'security_guard': 'Security Guard',
      'cctv': 'CCTV Operator',
      'close_protection': 'Close Protection',
      'dog_handler': 'Dog Handler',
      'any': 'any',
    };

    const licenceLabel = securityTypeMap[job.required_license_type || job.security_type] || job.security_type;
    const jobCity = (job.venue_city || '').trim().toLowerCase();
    const jobLat = typeof job.latitude === 'number' ? job.latitude : null;
    const jobLng = typeof job.longitude === 'number' ? job.longitude : null;
    const hasJobCoords = jobLat !== null && jobLng !== null;

    let query = adminSupabase
      .from('guards')
      .select('id, full_name, email, location, user_id, preferred_venue_categories, home_latitude, home_longitude, max_distance_miles, willing_to_travel, default_search_radius_km')
      .eq('is_active', true)
      .eq('verification_status', 'approved')
      .eq('profile_completed', true);

    if (isDirectBooking) {
      query = query.eq('accepts_direct_bookings', true);
    }

    if (licenceLabel && licenceLabel !== 'any') {
      query = query.contains('licence_types', [licenceLabel]);
    }

    const { data: matchingGuards, error: guardsError } = await query;

    if (guardsError || !matchingGuards || matchingGuards.length === 0) {
      return new Response(
        JSON.stringify({ notified: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let guardsToNotify = matchingGuards;

    if (isDirectBooking && job.venue_category) {
      guardsToNotify = guardsToNotify.filter((g) => {
        if (!g.preferred_venue_categories || g.preferred_venue_categories.length === 0) return true;
        return g.preferred_venue_categories.includes(job.venue_category);
      });
    }

    const guardsWithDistance: Array<{ guard: any; distanceMiles: number | null; distanceLabel: string }> = [];

    if (hasJobCoords) {
      for (const g of guardsToNotify) {
        const guardLat = typeof g.home_latitude === 'number' ? g.home_latitude : null;
        const guardLng = typeof g.home_longitude === 'number' ? g.home_longitude : null;

        if (guardLat !== null && guardLng !== null) {
          const dist = haversineDistanceMiles(jobLat, jobLng, guardLat, guardLng);
          const maxDist = guardEffectiveMaxDistance(g);
          const isWilling = g.willing_to_travel !== false;

          if (isWilling && (maxDist === null || dist <= maxDist)) {
            guardsWithDistance.push({
              guard: g,
              distanceMiles: dist,
              distanceLabel: dist < 0.5 ? 'Within 0.5 mi' : `${dist.toFixed(1)} miles`,
            });
          }
        } else {
          guardsWithDistance.push({
            guard: g,
            distanceMiles: null,
            distanceLabel: 'Distance unknown',
          });
        }
      }

      guardsWithDistance.sort((a, b) => {
        if (a.distanceMiles === null && b.distanceMiles === null) return 0;
        if (a.distanceMiles === null) return 1;
        if (b.distanceMiles === null) return -1;
        return a.distanceMiles - b.distanceMiles;
      });
    } else {
      const cityMatched = guardsToNotify.filter((g) =>
        g.location && g.location.toLowerCase().includes(jobCity)
      );
      const sourceList = cityMatched.length > 0 ? cityMatched : guardsToNotify;

      for (const g of sourceList) {
        guardsWithDistance.push({
          guard: g,
          distanceMiles: null,
          distanceLabel: g.location && g.location.toLowerCase().includes(jobCity) ? 'Nearby' : 'Various',
        });
      }
    }

    const dateStr = job.start_date
      ? new Date(job.start_date).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'TBC';

    const location = `${job.venue_name}, ${job.venue_city}`;
    let notifiedCount = 0;
    let pushCount = 0;

    for (const entry of guardsWithDistance) {
      const guard = entry.guard;

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-job-match-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            guard_id: guard.user_id,
            job_id: jobId,
            guard_email: guard.email,
            guard_name: guard.full_name || 'Guard',
            job_title: job.job_title,
            client_name: job.contact_name || 'Client',
            location,
            date: dateStr,
            start_time: job.start_time || '',
            end_time: job.end_time || '',
            hourly_rate: job.hourly_rate ? job.hourly_rate.toFixed(2) : '0.00',
            distance_miles: entry.distanceLabel,
            job_type: licenceLabel,
            is_direct_booking: isDirectBooking,
            venue_category: job.venue_category || '',
          }),
        });

        if (res.ok) {
          notifiedCount++;
        }
      } catch {
        // Continue on individual guard failure
      }

      try {
        if (guard.user_id) {
          const pushOk = await sendPushNotification(
            supabaseUrl,
            supabaseServiceKey,
            guard.user_id,
            'guard',
            `New ${isDirectBooking ? 'Direct Booking' : 'Job'} Match`,
            `${job.job_title} at ${job.venue_city} — £${job.hourly_rate}/hr. Click to view.`,
            `/jobs/${jobId}`
          );
          if (pushOk) pushCount++;
        }
      } catch {
        // Continue on individual push failure
      }
    }

    return new Response(
      JSON.stringify({
        notified: notifiedCount,
        pushSent: pushCount,
        totalConsidered: guardsWithDistance.length,
        matchedByDistance: hasJobCoords ? guardsWithDistance.filter(e => e.distanceMiles !== null).length : 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error notifying matching guards:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
