import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleClientDocuments } from './core.ts';
const db = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{ db: { schema: 'app' }, auth: { persistSession: false, autoRefreshToken: false } });
serve((req: Request) => handleClientDocuments(req,db));
