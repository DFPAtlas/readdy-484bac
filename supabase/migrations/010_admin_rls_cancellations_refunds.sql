-- Admin RLS policies for job_cancellations and refund_requests
-- Run this in your Supabase SQL Editor

-- ============================================================
-- app.job_cancellations
-- ============================================================

-- Admin can view all job cancellations
CREATE POLICY "admin_all_cancellations_select" ON app.job_cancellations
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM app.admin_users au
    WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true
  ));

-- Admin can update all job cancellations (e.g. approve/review status)
CREATE POLICY "admin_all_cancellations_update" ON app.job_cancellations
  FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM app.admin_users au
    WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.admin_users au
    WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true
  ));

-- ============================================================
-- app.refund_requests
-- ============================================================

-- Admin can view all refund requests
CREATE POLICY "admin_all_refund_requests_select" ON app.refund_requests
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM app.admin_users au
    WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true
  ));

-- Admin can update all refund requests (e.g. approve/reject)
CREATE POLICY "admin_all_refund_requests_update" ON app.refund_requests
  FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM app.admin_users au
    WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.admin_users au
    WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true
  ));