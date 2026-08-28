import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*';
  const headers: Record<string,string> = {};
  Object.keys(corsHeaders).forEach(k => { headers[k] = corsHeaders[k]; });
  headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function getAal(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(base64 + pad)).aal || null;
  } catch {
    return null;
  }
}

const DISPOSABLE_DOMAINS = [
  'mailinator.com','guerrillamail.com','10minutemail.com','tempmail.com','throwaway.email',
  'sharklasers.com','trashmail.com','yopmail.com','dispostable.com','maildrop.cc',
  'getnada.com','temp-mail.org','fakeinbox.com','emailondeck.com','spam4.me',
  'wegwerfemail.de','emkei.cz','anonbox.net','bum.net','mailcatch.com'
];

Deno.serve(async function(req) {
  const headers = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    const jwtToken = authHeader.replace('Bearer ', '').trim();
    if (!jwtToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const { data: userData, error: userError } = await supabase.auth.getUser(jwtToken);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    if (getAal(jwtToken) !== 'aal2') {
      return new Response(JSON.stringify({ error: 'MFA required' }), {
        status: 403, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    const verifiedUser = userData.user;

    const { data: adminUser } = await supabase.from('admin_users').select('id, role, is_active').eq('user_id', verifiedUser.id).maybeSingle();

    if (!adminUser || !adminUser.is_active) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action is required' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'create_campaign': {
        const { name, description, target_role, email_subject, email_preview, email_body_html, email_body_text, default_referrer_user_id, send_limit } = body;

        if (!name || !email_subject) {
          return new Response(JSON.stringify({ error: 'name and email_subject are required' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const { data: campaign, error } = await supabase.from('qg_launch_campaigns').insert({
          created_by: verifiedUser.id,
          name,
          description: description || null,
          target_role: target_role || 'mixed',
          email_subject,
          email_preview: email_preview || null,
          email_body_html: email_body_html || null,
          email_body_text: email_body_text || null,
          default_referrer_user_id: default_referrer_user_id || null,
          send_limit: send_limit || 500,
          status: 'draft',
        }).select('*').single();

        if (error) throw new Error(`Failed to create campaign: ${error.message}`);

        return new Response(JSON.stringify({ success: true, campaign }), {
          status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      case 'update_campaign': {
        const { campaign_id, ...updates } = body;
        if (!campaign_id) {
          return new Response(JSON.stringify({ error: 'campaign_id is required' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const allowedFields: Record<string,any> = {};
        ['name','description','target_role','email_subject','email_preview','email_body_html','email_body_text','default_referrer_user_id','send_limit'].forEach(k => {
          if (updates[k] !== undefined) allowedFields[k] = updates[k];
        });
        allowedFields.updated_at = new Date().toISOString();

        const { data: campaign, error } = await supabase.from('qg_launch_campaigns').update(allowedFields).eq('id', campaign_id).select('*').single();
        if (error) throw new Error(`Failed to update campaign: ${error.message}`);

        return new Response(JSON.stringify({ success: true, campaign }), {
          status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      case 'pause_campaign':
      case 'resume_campaign':
      case 'cancel_campaign': {
        const { campaign_id } = body;
        if (!campaign_id) {
          return new Response(JSON.stringify({ error: 'campaign_id is required' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const newStatus = action === 'pause_campaign' ? 'paused' : action === 'resume_campaign' ? 'active' : 'cancelled';
        const { error } = await supabase.from('qg_launch_campaigns').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', campaign_id);
        if (error) throw new Error(`Failed to update campaign status: ${error.message}`);

        return new Response(JSON.stringify({ success: true, status: newStatus }), {
          status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      case 'send_test_email': {
        const { campaign_id, test_email } = body;
        if (!campaign_id || !test_email) {
          return new Response(JSON.stringify({ error: 'campaign_id and test_email are required' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const { data: campaign } = await supabase.from('qg_launch_campaigns').select('*').eq('id', campaign_id).maybeSingle();
        if (!campaign) {
          return new Response(JSON.stringify({ error: 'Campaign not found' }), {
            status: 404, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const htmlBody = campaign.email_body_html || `<p>${campaign.email_preview || ''}</p>`;

        await supabase.from('email_queue').insert({
          to_email: test_email.toLowerCase().trim(),
          subject: campaign.email_subject,
          html_body: htmlBody,
          template_name: 'qg_launch_rewards_campaign_test',
          status: 'pending',
          created_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ success: true, message: `Test email queued to ${test_email}` }), {
          status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      case 'import_recipients': {
        const { campaign_id, recipients } = body;
        if (!campaign_id || !recipients || !Array.isArray(recipients)) {
          return new Response(JSON.stringify({ error: 'campaign_id and recipients array are required' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const skipped: string[] = [];
        const imported: string[] = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        for (const r of recipients.slice(0, 2000)) {
          const email = (r.email || '').toLowerCase().trim();
          if (!email || !emailRegex.test(email)) { skipped.push(email || 'invalid'); continue; }

          const domain = email.split('@')[1];
          if (DISPOSABLE_DOMAINS.includes(domain)) { skipped.push(email); continue; }

          const { data: suppressed } = await supabase.from('email_suppression_list').select('id').eq('email', email).maybeSingle();
          if (suppressed) { skipped.push(email); continue; }

          const { count: existing } = await supabase.from('qg_launch_invites').select('id', { count: 'exact', head: true }).eq('recipient_email', email).eq('campaign_id', campaign_id);
          if (existing && existing > 0) { skipped.push(email); continue; }

          imported.push(email);
        }

        return new Response(JSON.stringify({ success: true, imported: imported.length, skipped: skipped.length, imported_emails: imported, skipped_emails: skipped.slice(0, 20) }), {
          status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      case 'send_campaign_batch': {
        const { campaign_id, recipient_emails } = body;
        if (!campaign_id || !recipient_emails || !Array.isArray(recipient_emails)) {
          return new Response(JSON.stringify({ error: 'campaign_id and recipient_emails array are required' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const { data: campaign } = await supabase.from('qg_launch_campaigns').select('*').eq('id', campaign_id).maybeSingle();
        if (!campaign) {
          return new Response(JSON.stringify({ error: 'Campaign not found' }), {
            status: 404, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        if (campaign.status !== 'active' && campaign.status !== 'draft') {
          return new Response(JSON.stringify({ error: 'Campaign is not active' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const settingsRes = await supabase.from('qg_launch_reward_settings').select('key,value');
        const settings: Record<string,any> = {};
        if (settingsRes.data) {
          settingsRes.data.forEach((r: any) => { try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; } });
        }
        const maxPerDay = parseInt(settings.max_admin_campaign_sends_per_day) || 1000;

        if (campaign.sent_count >= (campaign.send_limit || 500)) {
          return new Response(JSON.stringify({ error: 'Campaign send limit reached' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        if (campaign.sent_count >= maxPerDay) {
          return new Response(JSON.stringify({ error: `Daily campaign send limit reached (${maxPerDay})` }), {
            status: 429, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const htmlBody = campaign.email_body_html || `<p>${campaign.email_preview || ''}</p>`;
        const remaining = Math.min(
          (campaign.send_limit || 500) - campaign.sent_count,
          maxPerDay - campaign.sent_count,
          recipient_emails.length,
          50
        );

        const toSend = recipient_emails.slice(0, remaining);
        let sent = 0;

        for (const email of toSend) {
          const emailLower = email.toLowerCase().trim();

          const { data: suppressed } = await supabase.from('email_suppression_list').select('id').eq('email', emailLower).maybeSingle();
          if (suppressed) continue;

          const referralCode = campaign.default_referrer_user_id
            ? (await supabase.from('qg_referral_codes').select('code').eq('owner_user_id', campaign.default_referrer_user_id).maybeSingle())?.data?.code || ''
            : '';

          const inviteUrl = referralCode
            ? `https://quickguard.uk/qg-launch-rewards?ref=${referralCode}`
            : 'https://quickguard.uk/qg-launch-rewards';

          const { data: invite } = await supabase.from('qg_launch_invites').insert({
            sender_user_id: verifiedUser.id,
            sender_role: 'admin',
            recipient_email: emailLower,
            recipient_role: campaign.target_role === 'mixed' ? 'unknown' : campaign.target_role,
            referral_code: referralCode || null,
            invite_url: inviteUrl,
            campaign_id: campaign_id,
            status: 'queued',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).select('id').single();

          if (invite) {
            await supabase.from('email_queue').insert({
              to_email: emailLower,
              subject: campaign.email_subject,
              html_body: htmlBody,
              template_name: 'qg_launch_rewards_campaign',
              status: 'pending',
              created_at: new Date().toISOString(),
            });

            await supabase.from('qg_launch_invites').update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', invite.id);

            sent++;
          }
        }

        await supabase.from('qg_launch_campaigns').update({
          sent_count: campaign.sent_count + sent,
          status: 'active',
          updated_at: new Date().toISOString(),
        }).eq('id', campaign_id);

        return new Response(JSON.stringify({ success: true, sent, total_sent_now: campaign.sent_count + sent }), {
          status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      case 'export_campaign_stats': {
        const { campaign_id } = body;
        if (!campaign_id) {
          return new Response(JSON.stringify({ error: 'campaign_id is required' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const { data: campaign } = await supabase.from('qg_launch_campaigns').select('*').eq('id', campaign_id).maybeSingle();
        if (!campaign) {
          return new Response(JSON.stringify({ error: 'Campaign not found' }), {
            status: 404, headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const { data: invites } = await supabase.from('qg_launch_invites').select('recipient_email,recipient_name,status,sent_at,clicked_at,signed_up_at,verified_at').eq('campaign_id', campaign_id).order('created_at', { ascending: false });

        return new Response(JSON.stringify({ success: true, campaign, invites: invites || [] }), {
          status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      default: {
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[qg-launch-campaign-admin] Error:', message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
});
