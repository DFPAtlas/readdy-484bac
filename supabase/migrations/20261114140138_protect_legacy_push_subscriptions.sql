-- Restrict the legacy read policy even if the public schema is exposed later.
SET LOCAL lock_timeout = '500ms';

DROP POLICY IF EXISTS "Service role can read all push subscriptions"
  ON public.push_subscriptions;

ALTER POLICY "Users can manage their own push subscriptions"
  ON public.push_subscriptions TO authenticated;
