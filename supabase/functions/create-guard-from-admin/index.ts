import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_PROFILE_SIZE = 5 * 1024 * 1024;
const MAX_DOC_SIZE = 10 * 1024 * 1024;

function generateRandomPassword(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function safeFileName(original: string): string {
  return original.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeBase64File(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), bytes: base64ToUint8Array(match[2]) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const {
      email,
      first_name,
      last_name,
      phone,
      date_of_birth,
      sia_licence_number,
      license_cardholder_name,
      sia_expiry_date,
      years_experience,
      hourly_rate,
      city,
      postcode,
      bio,
      available_days,
      available_hours_from,
      available_hours_to,
      certifications,
      licence_types,
      auto_approve,
      profile_image_base64,
      profile_image_name,
      sia_front_base64,
      sia_front_name,
      sia_back_base64,
      sia_back_name,
      sia_supporting_base64,
      sia_supporting_name,
    } = body;

    if (!email || !first_name || !last_name || !sia_licence_number || !sia_expiry_date) {
      return new Response(
        JSON.stringify({ error: 'Email, name, SIA licence number and expiry date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app' },
    });

    const storageClient = createClient(supabaseUrl, supabaseServiceKey);

    const password = generateRandomPassword(32);
    const fullName = `${first_name} ${last_name}`.trim();
    const now = new Date().toISOString();
    const timestamp = Date.now();

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'guard',
        first_name: first_name || '',
        last_name: last_name || '',
        email,
      },
    });

    if (userError) {
      if (userError.message?.toLowerCase().includes('already') || userError.message?.toLowerCase().includes('exists')) {
        return new Response(
          JSON.stringify({ error: 'An account with this email already exists.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('Failed to create user: ' + userError.message);
    }

    const userId = userData.user.id;

    const guardRecord: any = {
      user_id: userId,
      email,
      full_name: fullName,
      phone: phone || '',
      date_of_birth: date_of_birth || null,
      sia_licence_number: sia_licence_number || '',
      license_cardholder_name: license_cardholder_name || fullName,
      sia_expiry_date: sia_expiry_date || null,
      years_experience: years_experience ? parseInt(years_experience) : null,
      hourly_rate: hourly_rate ? parseFloat(hourly_rate) : null,
      location: city || '',
      postcode: postcode || '',
      bio: bio || '',
      available_days: available_days && available_days.length > 0 ? available_days : null,
      available_hours_from: available_hours_from || null,
      available_hours_to: available_hours_to || null,
      certifications: certifications && certifications.length > 0 ? certifications : null,
      licence_types: licence_types && licence_types.length > 0 ? licence_types : null,
      profile_completed: true,
      subscription_status: 'trialing',
      subscription_plan: 'guard-basic',
      verification_status: auto_approve ? 'approved' : 'manual_review',
      is_active: auto_approve ? true : false,
      verified_at: auto_approve ? now : null,
      onboarding_status: 'complete',
      availability_status: 'available',
      accepts_direct_bookings: true,
      created_at: now,
      updated_at: now,
    };

    let profileImagePath: string | null = null;
    let siaFrontPath: string | null = null;
    let siaBackPath: string | null = null;
    let siaSupportingPath: string | null = null;
    const uploadErrors: string[] = [];

    if (profile_image_base64 && profile_image_name) {
      try {
        const decoded = decodeBase64File(profile_image_base64);
        if (!decoded) {
          uploadErrors.push('Profile image: invalid base64 format');
        } else if (!ALLOWED_IMAGE_TYPES.includes(decoded.mimeType)) {
          uploadErrors.push('Profile image: invalid file type. Allowed: JPEG, PNG, WebP');
        } else if (decoded.bytes.length > MAX_PROFILE_SIZE) {
          uploadErrors.push('Profile image: file too large (max 5MB)');
        } else {
          const ext = decoded.mimeType.split('/')[1] === 'jpeg' ? 'jpg' : decoded.mimeType.split('/')[1];
          const fileName = `${timestamp}-${safeFileName(profile_image_name.replace(/\.[^.]+$/, ''))}.${ext}`;
          const filePath = `${userId}/profile/${fileName}`;

          const { error: uploadErr } = await storageClient.storage
            .from('guard-profiles')
            .upload(filePath, decoded.bytes, {
              contentType: decoded.mimeType,
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadErr) {
            uploadErrors.push(`Profile image upload failed: ${uploadErr.message}`);
          } else {
            profileImagePath = filePath;
          }
        }
      } catch (err: any) {
        uploadErrors.push(`Profile image error: ${err.message}`);
      }
    }

    async function uploadDocFile(base64: string, name: string, bucket: string, subfolder: string, label: string): Promise<string | null> {
      const decoded = decodeBase64File(base64);
      if (!decoded) {
        uploadErrors.push(`${label}: invalid base64 format`);
        return null;
      }
      if (!ALLOWED_DOC_TYPES.includes(decoded.mimeType)) {
        uploadErrors.push(`${label}: invalid file type. Allowed: JPEG, PNG, WebP, PDF`);
        return null;
      }
      if (decoded.bytes.length > MAX_DOC_SIZE) {
        uploadErrors.push(`${label}: file too large (max 10MB)`);
        return null;
      }
      const ext = decoded.mimeType.split('/')[1] === 'jpeg' ? 'jpg' : decoded.mimeType.split('/')[1];
      const fileName = `${timestamp}-${safeFileName(name.replace(/\.[^.]+$/, ''))}.${ext}`;
      const filePath = `${userId}/${subfolder}/${fileName}`;

      const { error: uploadErr } = await storageClient.storage
        .from(bucket)
        .upload(filePath, decoded.bytes, {
          contentType: decoded.mimeType,
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadErr) {
        uploadErrors.push(`${label} upload failed: ${uploadErr.message}`);
        return null;
      }
      return filePath;
    }

    if (sia_front_base64 && sia_front_name) {
      siaFrontPath = await uploadDocFile(sia_front_base64, sia_front_name, 'sia-licences', 'sia', 'SIA front');
    }
    if (sia_back_base64 && sia_back_name) {
      siaBackPath = await uploadDocFile(sia_back_base64, sia_back_name, 'sia-licences', 'sia', 'SIA back');
    }
    if (sia_supporting_base64 && sia_supporting_name) {
      siaSupportingPath = await uploadDocFile(sia_supporting_base64, sia_supporting_name, 'sia-licences', 'sia', 'Supporting document');
    }

    if (profileImagePath) guardRecord.profile_image_path = profileImagePath;
    if (siaFrontPath) guardRecord.sia_licence_front_path = siaFrontPath;
    if (siaBackPath) guardRecord.sia_licence_back_path = siaBackPath;
    if (siaSupportingPath) guardRecord.sia_supporting_document_path = siaSupportingPath;

    const { error: guardError } = await supabase
      .from('guards')
      .insert(guardRecord);

    if (guardError) {
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: 'Failed to create guard profile', details: guardError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: planData } = await supabase
      .from('plans')
      .select('slug, name, monthly_price_pence')
      .eq('slug', 'guard-basic')
      .maybeSingle();

    if (planData) {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 14);

      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_slug: planData.slug,
        plan_name: planData.name,
        status: 'trialing',
        stripe_subscription_id: null,
        stripe_customer_id: null,
        current_period_start: now,
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        created_at: now,
        updated_at: now,
      }).catch((e: any) => console.error('Subscription insert error (non-blocking):', e));

      await supabase.from('user_entitlements_data').insert({
        user_id: userId,
        plan_slug: planData.slug,
        plan_name: planData.name,
        subscription_status: 'trialing',
        current_period_end: periodEnd.toISOString(),
        created_at: now,
        updated_at: now,
      }).catch((e: any) => console.error('Entitlement insert error (non-blocking):', e));
    }

    if (auto_approve) {
      await supabase.from('notifications').insert({
        user_id: userId,
        user_type: 'guard',
        title: 'Account Created & Approved',
        message: 'Your guard account has been created and approved by the admin. You can now log in and start accepting jobs.',
        type: 'success',
        is_read: false,
        link: '/guard/dashboard',
        created_at: now,
      }).catch(() => {});

      await fetch(`${supabaseUrl}/functions/v1/send-guard-approval-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          guardId: userId,
          guardName: fullName,
          guardEmail: email,
          approved: true,
        }),
      }).catch(() => {});
    }

    const fileCount = (profileImagePath ? 1 : 0) + (siaFrontPath ? 1 : 0) + (siaBackPath ? 1 : 0) + (siaSupportingPath ? 1 : 0);
    const uploadedFiles: string[] = [];
    if (profileImagePath) uploadedFiles.push('profile_image');
    if (siaFrontPath) uploadedFiles.push('sia_front');
    if (siaBackPath) uploadedFiles.push('sia_back');
    if (siaSupportingPath) uploadedFiles.push('sia_supporting');

    await supabase.from('admin_activity_log').insert({
      admin_username: 'admin',
      action_type: 'guard_created',
      action_description: `Admin created guard account for ${fullName} with ${fileCount} file uploads`,
      target_type: 'guard',
      target_name: fullName,
      metadata: {
        guardUserId: userId,
        email,
        auto_approve,
        siaLicence: sia_licence_number,
        uploadedFiles,
        uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined,
      },
      created_at: now,
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        guardId: userId,
        email,
        password,
        profile_image_path: profileImagePath,
        sia_licence_front_path: siaFrontPath,
        sia_licence_back_path: siaBackPath,
        sia_supporting_document_path: siaSupportingPath,
        upload_errors: uploadErrors.length > 0 ? uploadErrors : undefined,
        message: auto_approve
          ? 'Guard created and approved. They can log in immediately.'
          : 'Guard created. They will appear in Guard Verifications for review.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('create-guard-from-admin error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});