-- One service-only source for the admin health counters. Configuration is
-- reported by the Edge Functions; database records do not prove provider health.
CREATE OR REPLACE FUNCTION app.get_admin_service_metrics()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = app, pg_catalog
AS $function$
SELECT jsonb_build_object(
  'stripe',jsonb_build_object(
    'failedEvents24h',(SELECT count(*) FROM app.processed_stripe_events
      WHERE processed_at>=now()-interval '24 hours'
        AND (event_type LIKE '%failed%' OR (metadata->'error' IS NOT NULL AND metadata->'error'<>'null'::jsonb))),
    'pendingEvents',NULL,
    'pendingPayouts',(SELECT count(*) FROM app.guard_payouts WHERE status IN ('pending','initiated','processing','payout_pending','held')),
    'failedPayouts',(SELECT count(*) FROM app.guard_payouts WHERE status='failed'),
    'openDisputes',(SELECT count(*) FROM app.disputes WHERE status IN ('open','under_review')),
    'refunds',(SELECT count(*) FROM app.transactions WHERE refunded_at>=now()-interval '7 days' AND refund_amount>0),
    'latestWebhook',(SELECT max(processed_at) FROM app.processed_stripe_events),
    'webhookStatus',CASE WHEN EXISTS(SELECT 1 FROM app.processed_stripe_events WHERE processed_at>=now()-interval '24 hours') THEN 'Recent activity recorded' ELSE 'No activity recorded in 24h' END,
    'webhookVerification','Not independently checked',
    'webhookLatency','—'),
  'email',jsonb_build_object(
    'queuePending',(SELECT count(*) FROM app.email_queue WHERE status='pending'),
    'failedEmails24h',(SELECT count(*) FROM app.email_send_log WHERE status='failed' AND created_at>=now()-interval '24 hours'),
    'sentToday',(SELECT count(*) FROM app.email_send_log WHERE status='sent' AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
    'bounceRate',NULL,'spfValid',NULL,'dkimValid',NULL,'dmarcValid',NULL,
    'dailySendCount',(SELECT coalesce(sum(sent_count),0) FROM app.email_provider_daily_usage WHERE usage_date=(now() AT TIME ZONE 'UTC')::date)),
  'pendingPayoutAmount',(SELECT coalesce(sum(net_amount),0) FROM app.guard_payouts WHERE status IN ('pending','initiated','processing','payout_pending','held'))
);
$function$;
REVOKE ALL ON FUNCTION app.get_admin_service_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.get_admin_service_metrics() TO service_role;
