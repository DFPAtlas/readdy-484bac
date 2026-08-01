import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationPayload {
  user_id: string;
  verified: boolean;
  license_status: 'valid' | 'expired' | 'revoked' | 'not_found' | 'error';
  name_match: boolean;
  expiry_date: string | null;
  sectors: string[];
  details: string;
  verified_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');
    const expectedApiKey = Deno.env.get('SIA_VERIFICATION_API_KEY');

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: VerificationPayload = await req.json();

    if (!payload.user_id || typeof payload.verified !== 'boolean' || !payload.license_status) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload - missing required fields', required: ['user_id', 'verified', 'license_status'] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validStatuses = ['valid', 'expired', 'revoked', 'not_found', 'error'];
    if (!validStatuses.includes(payload.license_status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid license_status', allowed: validStatuses }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', payload.user_id)
      .maybeSingle();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: logError } = await supabase
      .from('sia_verifications')
      .insert({
        user_id: payload.user_id,
        verified: payload.verified,
        license_status: payload.license_status,
        name_match: payload.name_match,
        expiry_date: payload.expiry_date,
        sectors: payload.sectors,
        details: payload.details,
        verified_at: payload.verified_at
      });

    if (logError) {
      return new Response(
        JSON.stringify({ error: 'Failed to log verification', details: logError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let verificationStatus = 'pending';
    if (payload.verified && payload.license_status === 'valid' && payload.name_match) {
      verificationStatus = 'verified';
    } else if (payload.license_status === 'expired') {
      verificationStatus = 'expired';
    } else if (payload.license_status === 'revoked' || payload.license_status === 'not_found') {
      verificationStatus = 'rejected';
    } else if (!payload.name_match) {
      verificationStatus = 'rejected';
    }

    const updateData: Record<string, unknown> = {
      sia_verification_status: verificationStatus,
      sia_license_status: payload.license_status,
      sia_verification_details: payload.details
    };

    if (payload.expiry_date) updateData.sia_license_expiry = payload.expiry_date;
    if (payload.sectors && payload.sectors.length > 0) updateData.sia_sectors = payload.sectors;
    if (verificationStatus === 'verified') updateData.sia_verified_at = payload.verified_at;

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', payload.user_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update user status', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const guardStatus = verificationStatus === 'verified' ? 'approved' : verificationStatus === 'rejected' ? 'rejected' : 'pending';
    const { error: guardUpdateError } = await supabase
      .from('guards')
      .update({
        verification_status: guardStatus,
        updated_at: payload.verified_at,
      })
      .eq('user_id', payload.user_id);

    if (guardUpdateError) {
      console.error('Failed to update guards table:', guardUpdateError);
    }

    await supabase.from('notifications').insert({
      user_id: payload.user_id,
      title: verificationStatus === 'verified' ? 'SIA License Verified' : 'SIA Verification Update',
      message: verificationStatus === 'verified'
        ? 'Your SIA license has been successfully verified. You can now apply for jobs.'
        : `SIA verification status: ${verificationStatus}. ${payload.details}`,
      type: verificationStatus === 'verified' ? 'success' : 'info',
      is_read: false
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Verification processed successfully', user_id: payload.user_id, verification_status: verificationStatus, guard_status: guardStatus, user_email: user.email, user_name: user.full_name }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
