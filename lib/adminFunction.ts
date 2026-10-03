import {supabase} from '@/lib/supabase';
export async function adminFunction(name: string, body: Record<string,unknown>) {
  const {data:{session}} = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Admin session expired. Sign in again.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''},
      body:JSON.stringify(body),signal:controller.signal,
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'Admin operation failed');
    return data;
  } catch(error) {
    if (controller.signal.aborted) throw new Error('The operation timed out. Check payments and audit before retrying; it may still be processing.');
    throw error;
  } finally {clearTimeout(timer);}
}
