-- The public catalog contains active plans. Billing staff and subscribers can
-- still read retired plans needed for reporting and existing subscriptions.
SET LOCAL lock_timeout = '500ms';

ALTER POLICY plans_select_all ON app.plans TO anon, authenticated
  USING (active IS TRUE);
ALTER POLICY plans_select_all ON app.plans RENAME TO plans_select_active;

CREATE POLICY plans_select_admin ON app.plans
  FOR SELECT TO authenticated USING ((SELECT app.is_active_admin()));

CREATE POLICY plans_select_own_subscription ON app.plans
  FOR SELECT TO authenticated
  USING (
    active IS NOT TRUE AND EXISTS (
      SELECT 1 FROM app.subscriptions AS subscription
      WHERE subscription.plan_slug = plans.slug
        AND subscription.user_id = (SELECT auth.uid())
    )
  );
