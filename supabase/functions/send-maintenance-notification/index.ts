
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface NotificationPayload {
  recipients: 'all' | 'clients' | 'guards';
  startTime: string;
  endTime: string;
  message: string;
  noticeMinutes: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'POST only' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const body: NotificationPayload = await req.json();
    const { recipients, startTime, endTime, message, noticeMinutes } = body;

    if (!recipients || !startTime || !endTime) {
      return new Response(JSON.stringify({ success: false, error: 'recipients, startTime, and endTime are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startDate = new Date(startTime).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    const endDate = new Date(endTime).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    let userQuery = supabase.from('users').select('email, full_name, user_type');
    if (recipients === 'clients') {
      userQuery = userQuery.eq('user_type', 'client');
    } else if (recipients === 'guards') {
      userQuery = userQuery.eq('user_type', 'guard');
    } else {
      userQuery = userQuery.in('user_type', ['client', 'guard']);
    }

    const { data: users, error: usersError } = await userQuery;

    if (usersError) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch users', detail: usersError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No matching users found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const user of users) {
      if (!user.email) continue;

      try {
        const variables: Record<string, string> = {
          user_name: user.full_name || 'there',
          maintenance_date: startDate,
          maintenance_window: `${startDate} - ${endDate}`,
          impact_description: message || 'Scheduled maintenance is planned.',
          notice_minutes: String(noticeMinutes || 60),
          year: String(new Date().getFullYear()),
        };

        const res = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            template_slug: 'maintenance_notification',
            to: user.email,
            variables,
            from: 'QuickGuard <info@quickguard.uk>',
          }),
        });

        if (res.ok) {
          sent++;
        } else {
          failed++;
          const errData = await res.json().catch(() => null);
          errors.push(`${user.email}: ${errData?.error || 'Send failed'}`);
        }
      } catch (e: any) {
        failed++;
        errors.push(`${user.email}: ${e.message}`);
      }
    }

    const responsePayload: Record<string, unknown> = {
      success: true,
      sent,
      total: users.length,
      failed,
    };

    if (errors.length > 0 && errors.length <= 10) {
      responsePayload.errors = errors;
    } else if (errors.length > 10) {
      responsePayload.errors = errors.slice(0, 10);
      responsePayload.errors_truncated = errors.length - 10;
    }

    return new Response(JSON.stringify(responsePayload), {
      status: sent > 0 ? 200 : (failed > 0 ? 502 : 200),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
