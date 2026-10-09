import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchWithTransientRetry } from '../_shared/fetchWithTransientRetry.ts';

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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      console.error('[create-job] Token validation failed:', authError?.message || 'User not found');
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Invalid auth token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app' },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const { formData, clientId, submissionId, bookingMode } = body;

    if (!clientId || !formData) {
      return new Response(JSON.stringify({ error: 'validation', message: 'Missing clientId or formData' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, user_id, contact_name, email, phone, company_name, subscription_tier')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) {
      console.error('[create-job] Client lookup failed:', clientError.code);
      return new Response(JSON.stringify({ error: 'client_lookup_failed', message: 'Could not load your client profile. Please try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!client || client.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Client mismatch or not found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Immediate classification is decided on the server, never taken from the
    // browser, and can only ever be requested explicitly. It never bypasses the
    // entitlement or usage checks below.
    const isImmediateBooking = bookingMode === 'immediate';

    // Stable, per-client idempotency key for the booking journey. Malformed
    // values are ignored rather than trusted.
    const safeSubmissionId =
      typeof submissionId === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(submissionId)
        ? submissionId
        : null;

    // Immediate bookings must carry a valid, stable idempotency key. A missing
    // or malformed value is rejected outright rather than silently converted to
    // null, so no entitlement check, usage consumption, job insert or guard
    // notification runs for an invalid immediate request.
    if (isImmediateBooking && !safeSubmissionId) {
      return new Response(JSON.stringify({
        error: 'invalid_submission_id',
        message: 'Immediate bookings require a valid submission identifier.',
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotency: the same authenticated client replaying the same submission
    // must get the already-created job back instead of creating another one.
    if (safeSubmissionId) {
      const { data: existingJob, error: idempotencyError } = await supabaseAdmin
        .from('jobs')
        .select('id')
        .eq('client_id', clientId)
        .eq('submission_id', safeSubmissionId)
        .maybeSingle();

      if (!idempotencyError && existingJob?.id) {
        return new Response(JSON.stringify({
          success: true,
          jobId: existingJob.id,
          idempotent: true,
          warnings: [],
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: entitlement, error: entitlementError } = await supabaseAdmin
      .from('user_entitlements_data')
      .select('plan_slug, plan_name, features, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (entitlementError) {
      console.error('[create-job] Entitlement lookup failed:', entitlementError.code);
      return new Response(JSON.stringify({ error: 'entitlement_lookup_failed', message: 'Could not load your subscription plan. Please try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const title = String(formData.jobTitle || '').trim();
    const description = String(formData.jobDescription || '').trim();
    const venue = String(formData.venue || '').trim();
    const addressLine1 = String(formData.addressLine1 || '').trim();
    const city = String(formData.city || '').trim();
    const postcode = String(formData.postcode || '').trim();
    const securityType = String(formData.securityType || '').trim();
    const contactName = String(formData.contactName || '').trim();
    const contactEmail = String(formData.contactEmail || '').trim().toLowerCase();
    const guardCount = Number.parseInt(String(formData.numberOfGuards || ''), 10);
    const dayCount = Number.parseInt(String(formData.numberOfDays || ''), 10);
    const hourlyRate = Number.parseFloat(String(formData.hourlyRate || ''));
    const startDate = formData.startDate ? new Date(`${formData.startDate}T00:00:00`) : null;
    const endDate = formData.endDate ? new Date(`${formData.endDate}T00:00:00`) : startDate;
    const publishAt = formData.publishAt ? new Date(formData.publishAt) : null;
    const expiresAt = formData.expiresAt ? new Date(formData.expiresAt) : null;

    const validationErrors: string[] = [];
    if (title.length < 3 || title.length > 160) validationErrors.push('Job title must be between 3 and 160 characters');
    if (description.length < 10) validationErrors.push('Job description must be at least 10 characters');
    if (!securityType) validationErrors.push('Security type is required');
    if (!venue) validationErrors.push('Venue is required');
    if (!addressLine1 || !city || !postcode) validationErrors.push('A complete job location is required');
    if (!Number.isInteger(guardCount) || guardCount < 1 || guardCount > 100) validationErrors.push('Number of guards must be between 1 and 100');
    if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 365) validationErrors.push('Number of days must be between 1 and 365');
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0 || hourlyRate > 1000) validationErrors.push('Hourly rate must be greater than 0');
    if (!startDate || Number.isNaN(startDate.getTime())) validationErrors.push('Valid start date is required');
    if (!endDate || Number.isNaN(endDate.getTime())) validationErrors.push('Valid end date is required');
    if (startDate && endDate && endDate < startDate) validationErrors.push('End date cannot be before start date');
    if (!formData.startTime || !formData.endTime) validationErrors.push('Start and end times are required');
    else if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(formData.startTime).trim()) || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(formData.endTime).trim())) validationErrors.push('Start and end times must be valid times');
    if (!contactName) validationErrors.push('Contact name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) validationErrors.push('Valid contact email is required');
    if (publishAt && Number.isNaN(publishAt.getTime())) validationErrors.push('Invalid publish date');
    if (expiresAt && Number.isNaN(expiresAt.getTime())) validationErrors.push('Invalid expiry date');
    if (publishAt && expiresAt && expiresAt <= publishAt) validationErrors.push('Expiry must be after publish time');
    if (formData.siaLicenceRequired === 'yes' && (!Array.isArray(formData.specificLicences) || formData.specificLicences.length === 0)) {
      validationErrors.push('At least one required SIA licence type must be selected');
    }

    if (validationErrors.length > 0) {
      return new Response(JSON.stringify({
        error: 'validation',
        message: 'Please correct the job details before publishing.',
        details: validationErrors,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const addressParts = [addressLine1, city, postcode, 'UK'].filter(Boolean);
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
      job_title: title,
      security_type: securityType,
      job_description: description,
      venue_name: venue,
      venue_address_line1: addressLine1,
      venue_address_line2: (formData.addressLine2 || '').trim() || null,
      venue_city: city,
      venue_postcode: postcode,
      number_of_guards: guardCount,
      number_of_days: dayCount,
      start_date: formData.startDate,
      end_date: formData.endDate || formData.startDate,
      start_time: formatTimeForJob(formData.startTime),
      end_time: formatTimeForJob(formData.endTime),
      hourly_rate: hourlyRate,
      sia_licence_required: formData.siaLicenceRequired === 'yes',
      required_licence_types: formData.specificLicences?.length > 0 ? formData.specificLicences : null,
      uniform_required: formData.uniformRequired === 'yes',
      uniform_details: (formData.uniformDetails || '').trim() || null,
      experience_level: formData.experienceLevel || '',
      dress_code: (formData.dressCode || '').trim() || null,
      special_instructions: (formData.specialInstructions || '').trim() || null,
      additional_requirements: (formData.additionalRequirements || '').trim() || null,
      urgency: isImmediateBooking ? 'immediate' : (formData.urgency || 'standard'),
      contact_name: contactName,
      contact_phone: formData.contactPhone || '',
      contact_email: contactEmail,
      status: formData.publishAt && new Date(formData.publishAt) > new Date() ? 'draft' : 'open',
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      geocoded_at: geo ? new Date().toISOString() : null,
      repeat_pattern: !formData.repeatShift || formData.repeatShift === 'none' ? 'one-off' : formData.repeatShift,
      repeat_frequency: formData.repeatFrequency || null,
      repeat_end_date: formData.repeatEndDate || null,
      is_recurring: Boolean(formData.repeatShift) && formData.repeatShift !== 'none',
      saved_site_id: formData.savedSiteId || null,
      publish_at: formData.publishAt ? new Date(formData.publishAt).toISOString() : null,
      expires_at: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
      is_featured: formData.isFeatured || false,
      is_urgent: isImmediateBooking
        ? true
        : Boolean(formData.isUrgent || formData.urgency === 'urgent' || formData.urgency === 'immediate'),
      booking_source: isImmediateBooking ? 'homepage_guard_now' : null,
      submission_id: safeSubmissionId,
      notification_status: formData.publishAt && new Date(formData.publishAt) > new Date() ? 'none' : 'pending',
      notification_attempts: 0,
      notified_guard_count: 0,
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
      // The database trigger re-checks the plan limit atomically with the insert.
      if (insertError?.message?.includes('job_post_limit_reached')) {
        return new Response(JSON.stringify({
          error: 'limit_reached',
          message: 'You have reached your monthly job posting limit. Upgrade your plan to post more jobs.',
        }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Concurrent replay: two requests with the same submission id raced and
      // the partial unique index (client_id, submission_id) rejected the loser.
      // Return the job that won instead of a false failure. The consumed usage
      // of the rejected insert was rolled back with its transaction, so the
      // allowance is not spent twice and no notifications were queued.
      const isUniqueConflict = insertError?.code === '23505'
        || /duplicate key value|unique constraint/i.test(insertError?.message || '');
      if (isUniqueConflict && safeSubmissionId) {
        const { data: racedJob } = await supabaseAdmin
          .from('jobs')
          .select('id')
          .eq('client_id', clientId)
          .eq('submission_id', safeSubmissionId)
          .maybeSingle();
        if (racedJob?.id) {
          return new Response(JSON.stringify({
            success: true,
            jobId: racedJob.id,
            idempotent: true,
            warnings: [],
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

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

    // Usage was consumed by trg_enforce_client_job_post_limit in the insert transaction.

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
          'Authorization': `Bearer ${supabaseServiceKey}`,
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

    if (jobPayload.status === 'open') {
      // Emails are durably queued by notify-matching-guards and delivered
      // asynchronously by the existing email worker. The job only records an
      // honest delivery state here: 'delivered' is never set from a queue row.
      const notifyAttemptAt = new Date().toISOString();
      try {
        const notifyRes = await fetchWithTransientRetry(`${supabaseUrl}/functions/v1/notify-matching-guards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
          },
          body: JSON.stringify({ jobId }),
        });

        if (!notifyRes.ok) {
          throw new Error(`notify-matching-guards responded ${notifyRes.status}`);
        }

        const notifyJson = await notifyRes.json().catch(() => null);
        const queued = Number(notifyJson?.queued ?? 0);
        const retried = Number(notifyJson?.retried ?? 0);
        const skipped = Number(notifyJson?.skipped ?? 0);
        const queueFailed = Number(notifyJson?.failed ?? 0);
        const targeted = queued + retried + skipped;

        let deliveryStatus: string;
        if (targeted === 0 && queueFailed === 0) deliveryStatus = 'none';
        else if (targeted === 0) deliveryStatus = 'failed';
        else if (queueFailed > 0) deliveryStatus = 'partially_delivered';
        else deliveryStatus = 'queued';

        await supabaseAdmin.from('jobs').update({
          notification_status: deliveryStatus,
          notification_attempts: 1,
          notified_guard_count: targeted,
          notification_error: queueFailed > 0 ? `${queueFailed} guard notification(s) could not be queued` : null,
          notification_last_attempt_at: notifyAttemptAt,
        }).eq('id', jobId);
      } catch (notifyError) {
        const notifyMessage = notifyError instanceof Error ? notifyError.message : 'notification_failed';
        await supabaseAdmin.from('jobs').update({
          notification_status: 'failed',
          notification_attempts: 1,
          notification_error: notifyMessage.slice(0, 500),
          notification_last_attempt_at: notifyAttemptAt,
        }).eq('id', jobId);
        warnings.push('notification_failed');
      }
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
