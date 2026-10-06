import { supabase } from '@/lib/supabase';

// Every client support ticket — ordinary, complaint, refund review and guard
// replacement — is handed to the DFP Command Centre through the same bridge.
// The bridge is idempotent (upstream x-idempotency-key + local 'synced' state), so
// calling it again for the same ticket never creates a duplicate. If the hand-over
// fails, the QuickGuard ticket remains with dfp_sync_status = 'failed' (or unset)
// and is picked up by the bridge's service-mode retry sweep.

export const COMMAND_CENTRE_PENDING_MESSAGE =
  'Your request was saved, but central support synchronisation is still pending. Our team can still see your QuickGuard ticket.';

export async function routeTicketToCommandCentre(ticketId: string): Promise<{ ok: boolean; ticketNumber?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('dfp-support-ticket-bridge', { body: { ticketId } });
    if (error || data?.success !== true) return { ok: false };
    return { ok: true, ticketNumber: data.ticketNumber };
  } catch {
    return { ok: false };
  }
}
