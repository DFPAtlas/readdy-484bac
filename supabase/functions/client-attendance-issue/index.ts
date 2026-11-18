import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { AttendanceIssueError, recordClientAttendanceIssue } from '../_shared/client-attendance-issue.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status, headers: {...cors, 'Content-Type': 'application/json'},
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
  if (req.method !== 'POST') return json(405, {error: 'Method not allowed'});
  const bearer = req.headers.get('Authorization');
  if (!bearer?.startsWith('Bearer ') || !bearer.slice(7).trim()) return json(401, {error: 'Authentication required'});
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      db: {schema: 'app'}, auth: {persistSession: false, autoRefreshToken: false},
    });
    const auth = await db.auth.getUser(bearer.slice(7));
    if (auth.error || !auth.data?.user?.id) return json(401, {error: 'Authentication required'});
    let body;
    try { body = await req.json(); } catch { return json(400, {error: 'Invalid request body'}); }
    const assignment = await recordClientAttendanceIssue(db, auth.data.user.id, body);
    return json(200, {success: true, assignment});
  } catch (error) {
    if (error instanceof AttendanceIssueError) return json(error.status, {error: error.message});
    return json(503, {error: 'Attendance change could not be confirmed'});
  }
});
