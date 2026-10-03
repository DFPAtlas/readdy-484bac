import { supabase } from './supabase';
export async function loadMapsEmbedKey(): Promise<string> {
 const { data, error } = await supabase.functions.invoke('maps-embed-config', { body: {} });
 if (error || !data?.apiKey) throw new Error('Map preview unavailable. Please retry or contact support.');
 return data.apiKey;
}
