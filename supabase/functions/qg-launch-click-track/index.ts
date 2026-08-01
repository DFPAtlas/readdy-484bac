
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async function(req) {
  const url = new URL(req.url);
  const inviteId = url.searchParams.get('invite');
  const refCode = url.searchParams.get('ref') || '';

  if (!inviteId) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, 'Location': '/qg-launch-rewards' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

      const { data: invite } = await supabase
        .from('qg_launch_invites')
        .select('id, status')
        .eq('id', inviteId)
        .maybeSingle();

      if (invite && invite.status !== 'clicked' && invite.status !== 'signed_up' && invite.status !== 'verified') {
        await supabase.from('qg_launch_invites').update({
          status: 'clicked',
          clicked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', inviteId);
      }

      if (invite?.referral_code_id) {
        const { data: campaignInvites } = await supabase
          .from('qg_launch_invites')
          .select('campaign_id')
          .eq('id', inviteId)
          .maybeSingle();

        if (campaignInvites?.campaign_id) {
          await supabase.rpc('increment_campaign_metric', {
            campaign_id_param: campaignInvites.campaign_id,
            metric: 'clicked',
          }).catch(() => {});
        }
      }
    }

    const redirectUrl = refCode
      ? `/qg-launch-rewards?ref=${encodeURIComponent(refCode)}`
      : '/qg-launch-rewards';

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, 'Location': redirectUrl }
    });

  } catch (err) {
    console.error('[qg-launch-click-track] Error:', err);
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, 'Location': `/qg-launch-rewards${refCode ? '?ref=' + encodeURIComponent(refCode) : ''}` }
    });
  }
});
