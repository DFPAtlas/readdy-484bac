import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const STALE_SUBSCRIPTIONS = [
  { id: "sub_1TcwfqIMkpwfAEDTDMqB2vhu", note: "martin@etc.uk - client-starter" },
  { id: "sub_1TdF39IMkpwfAEDTPWkwukv7", note: "martin@star.uk - guard-pro" },
  { id: "sub_1TdnuLIMkpwfAEDTguKaison", note: "paul@starligth.uk - client-starter" },
];

serve(async (_req: Request) => {
  const results: Array<{ id: string; note: string; status: string; error?: string }> = [];

  for (const sub of STALE_SUBSCRIPTIONS) {
    try {
      await stripe.subscriptions.cancel(sub.id);
      results.push({ id: sub.id, note: sub.note, status: "cancelled" });
    } catch (err: any) {
      if (err.type === "StripeInvalidRequestError" && err.message?.includes("already been canceled")) {
        results.push({ id: sub.id, note: sub.note, status: "already cancelled" });
      } else {
        results.push({ id: sub.id, note: sub.note, status: "failed", error: err.message });
      }
    }
  }

  return new Response(JSON.stringify({ cancelled: results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});