import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Missing auth token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Invalid auth token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { formData, clientId } = body;

    if (!clientId || !formData) {
      return new Response(JSON.stringify({ error: 'validation', message: 'Missing clientId or formData' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, user_id, contact_name, email, phone, company_name, subscription_tier')
      .eq('id', clientId)
      .maybeSingle();

    if (!client || client.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Client mismatch or not found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: entitlement } = await supabaseAdmin
      .from('user_entitlements_data')
      .select('plan_slug, plan_name, features, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!entitlement?.plan_slug || !entitlement.is_active) {
      return new Response(JSON.stringify({
        error: 'entitlement_failed',
        message: 'Could not verify your subscription plan. Please refresh or contact support.',
      }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: usageCheck, error: usageError } = await supabaseAdmin.rpc('check_monthly_usage', {
      p_user_id: user.id,
      p_feature_key: 'client_job_post',
      p_increment: false,
    });

    if (usageError || !usageCheck) {
      return new Response(JSON.stringify({
        error: 'usage_check_failed',
        message: 'Could not verify job posting limits. Please try again.',
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!usageCheck.allowed) {
      return new Response(JSON.stringify({
        error: 'limit_reached',
        message: `You have reached your monthly job posting limit (${usageCheck.used}/${usageCheck.limit}). Upgrade your plan to post more jobs.`,
        details: usageCheck,
      }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const addressParts = [formData.addressLine1, formData.city, formData.postcode, 'UK'].filter(Boolean);
    const fullAddress = addressParts.join(', ');

    let geo: { latitude: number; longitude: number } | null = null;
    let geocodingWarning: string | null = null;

    const geocodingKey = Deno.env.get('GOOGLE_GEOCODING_API_KEY');
    if (geocodingKey) {
      try {
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&region=uk&key=${geocodingKey}`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        if (geoData.status === 'OK' && geoData.results?.[0]) {
          geo = {
            latitude: geoData.results[0].geometry.location.lat,
            longitude: geoData.results[0].geometry.location.lng,
          };
        } else {
          geocodingWarning = 'geocoding_failed';
        }
      } catch {
        geocodingWarning = 'geocoding_failed';
      }
    }

    function formatTimeForJob(time: string): string | null {
      if (!time) return null;
      const trimmed = time.trim();
      const timeRegex = /^\d{1,2}:\d{2}(:\d{2})?$/;
      if (!timeRegex.test(trimmed)) return null;
      return trimmed.split(':').length === 2 ? `${trimmed}:00` : trimmed;
    }

    const jobPayload = {
      client_id: clientId,
      job_title: (formData.jobTitle || '').trim(),
      security_type: formData.securityType || '',
      job_description: (formData.jobDescription || '').trim(),
      venue_name: (formData.venue || '').trim(),
      venue_address_line1: (formData.addressLine1 || '').trim(),
      venue_address_line2: (formData.addressLine2 || '').trim() || null,
      venue_city: (formData.city || '').trim(),
      venue_postcode: (formData.postcode || '').trim(),
      number_of_guards: parseInt(formData.numberOfGuards) || 1,
      number_of_days: parseInt(formData.numberOfDays) || 1,
      start_date: formData.startDate,
      end_date: formData.endDate || formData.startDate,
      start_time: formatTimeForJob(formData.startTime),
      end_time: formatTimeForJob(formData.endTime),
      hourly_rate: parseFloat(formData.hourlyRate) || 0,
      sia_licence_required: formData.siaLicenceRequired === 'yes',
      required_licence_types: formData.specificLicences?.length > 0 ? formData.specificLicences : null,
      uniform_required: formData.uniformRequired === 'yes',
      uniform_details: (formData.uniformDetails || '').trim() || null,
      experience_level: formData.experienceLevel || '',
      dress_code: (formData.dressCode || '').trim() || null,
      special_instructions: (formData.specialInstructions || '').trim() || null,
      additional_requirements: (formData.additionalRequirements || '').trim() || null,
      urgency: formData.urgency || 'standard',
      contact_name: formData.contactName || '',
      contact_phone: formData.contactPhone || '',
      contact_email: formData.contactEmail || '',
      status: formData.publishAt && new Date(formData.publishAt) > new Date() ? 'draft' : 'open',
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      geocoded_at: geo ? new Date().toISOString() : null,
      repeat_pattern: formData.repeatShift === 'none' ? 'one-off' : (formData.repeatShift || 'one-off'),
      repeat_frequency: formData.repeatFrequency || null,
      repeat_end_date: formData.repeatEndDate || null,
      is_recurring: formData.repeatShift !== 'none',
      saved_site_id: formData.savedSiteId || null,
      publish_at: formData.publishAt ? new Date(formData.publishAt).toISOString() : null,
      expires_at: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
      is_featured: formData.isFeatured || false,
      is_urgent: formData.isUrgent || formData.urgency === 'urgent' || formData.urgency === 'immediate',
      is_draft: formData.publishAt ? new Date(formData.publishAt) > new Date() : false,
      auto_close_on_expiry: formData.autoCloseOnExpiry !== false,
      featured_until: formData.isFeatured && formData.featuredDuration
        ? new Date(Date.now() + parseInt(formData.featuredDuration) * 24 * 60 * 60 * 1000).toISOString()
        : null,
    };

    const { data: jobData, error: insertError } = await supabaseAdmin
      .from('jobs')
      .insert(jobPayload)
      .select('id')
      .maybeSingle();

    if (insertError || !jobData) {
      return new Response(JSON.stringify({
        error: 'insert_failed',
        message: insertError?.message || 'Failed to create job. Please try again.',
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jobId = jobData.id;
    const warnings: string[] = [];

    if (geocodingWarning) {
      warnings.push(geocodingWarning);
    }

    try {
      await supabaseAdmin.rpc('check_monthly_usage', {
        p_user_id: user.id,
        p_feature_key: 'client_job_post',
        p_increment: true,
      });
    } catch {
      warnings.push('usage_record_failed');
    }

    try {
      await supabaseAdmin.from('client_activity_log').insert({
        client_id: clientId,
        user_id: user.id,
        action_type: 'job_created',
        action_description: `Job posted: ${formData.jobTitle}`,
        category: 'job',
        related_job_id: jobId,
        metadata: {
          security_type: formData.securityType,
          guards: formData.numberOfGuards,
          location: formData.city,
          hourly_rate: formData.hourlyRate,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      warnings.push('activity_log_failed');
    }

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-job-posted-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          clientEmail: formData.contactEmail,
          clientName: formData.contactName,
          jobTitle: formData.jobTitle,
          jobId,
          venue: formData.venue,
          startDate: formData.startDate,
          startTime: formData.startTime,
          numberOfGuards: formData.numberOfGuards,
          hourlyRate: formData.hourlyRate,
        }),
      });
    } catch {
      warnings.push('email_failed');
    }

    try {
      await fetch(`${supabaseUrl}/functions/v1/notify-matching-guards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId }),
      });
    } catch {
      warnings.push('notification_failed');
    }

    return new Response(JSON.stringify({
      success: true,
      jobId,
      warnings,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({
      error: 'server_error',
      message: err.message || 'An unexpected error occurred',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});