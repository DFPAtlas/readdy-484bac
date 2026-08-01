-- Migration: Transform app.email_templates to standardised schema
-- Renames columns, adds audience/email_type/sender fields, timestamptz, trigger, RLS
-- Seeds 15 default QuickGuard-branded templates

BEGIN;

-- 1. Drop existing RLS policy
DROP POLICY IF EXISTS "email_templates_admin_all" ON app.email_templates;

-- 2. Add new columns before renaming
ALTER TABLE app.email_templates
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS email_type text,
  ADD COLUMN IF NOT EXISTS from_name text DEFAULT 'QuickGuard Notifications',
  ADD COLUMN IF NOT EXISTS from_email text DEFAULT 'noreply@quickguard.uk',
  ADD COLUMN IF NOT EXISTS reply_to text DEFAULT 'support@quickguard.uk',
  ADD COLUMN IF NOT EXISTS preheader text,
  ADD COLUMN IF NOT EXISTS text_body text;

-- 3. Migrate data: category -> audience
UPDATE app.email_templates
  SET audience = CASE
    WHEN category IN ('guard', 'client', 'admin', 'all') THEN category
    ELSE 'all'
  END
  WHERE audience IS NULL;

-- 4. Derive email_type from template_slug patterns
UPDATE app.email_templates
  SET email_type = CASE
    WHEN template_slug LIKE '%welcome%' OR template_slug LIKE '%promo%' THEN 'welcome'
    WHEN template_slug LIKE '%verification%' OR template_slug LIKE '%approval%' OR template_slug LIKE '%rejection%' THEN 'verification'
    WHEN template_slug LIKE '%job_match%' OR template_slug LIKE '%job_posted%' OR template_slug LIKE '%job_application%' OR template_slug LIKE '%job_completed%' OR template_slug LIKE '%job_deleted%' OR template_slug LIKE '%job_cancelled%' OR template_slug LIKE '%job_payment%' THEN 'job'
    WHEN template_slug LIKE '%payment%' OR template_slug LIKE '%invoice%' OR template_slug LIKE '%refund%' OR template_slug LIKE '%receipt%' THEN 'payment'
    WHEN template_slug LIKE '%subscription%' OR template_slug LIKE '%tier%' THEN 'subscription'
    WHEN template_slug LIKE '%password%' OR template_slug LIKE '%reset%' THEN 'auth'
    WHEN template_slug LIKE '%digest%' THEN 'digest'
    WHEN template_slug LIKE '%complaint%' OR template_slug LIKE '%alert%' THEN 'alert'
    WHEN template_slug LIKE '%contact%' OR template_slug LIKE '%accessibility%' OR template_slug LIKE '%maintenance%' THEN 'system'
    WHEN template_slug LIKE '%booking%' THEN 'booking'
    WHEN template_slug LIKE '%nudge%' THEN 'nudge'
    ELSE 'notification'
  END
  WHERE email_type IS NULL;

-- 5. Rename columns
ALTER TABLE app.email_templates RENAME COLUMN template_slug TO template_key;
ALTER TABLE app.email_templates RENAME COLUMN body_html TO html_body;

-- 6. Make new required columns NOT NULL after data migration
ALTER TABLE app.email_templates
  ALTER COLUMN audience SET NOT NULL,
  ALTER COLUMN email_type SET NOT NULL,
  ALTER COLUMN from_name SET NOT NULL,
  ALTER COLUMN from_email SET NOT NULL;

-- 7. Add audience check constraint
ALTER TABLE app.email_templates
  ADD CONSTRAINT email_templates_audience_check
  CHECK (audience IN ('guard', 'client', 'admin', 'all'));

-- 8. Make template_key UNIQUE (it was already functionally unique)
ALTER TABLE app.email_templates
  ADD CONSTRAINT email_templates_template_key_unique UNIQUE (template_key);

-- 9. Drop deprecated columns
ALTER TABLE app.email_templates
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS variables,
  DROP COLUMN IF EXISTS last_edited_by;

-- 10. Convert timestamps to timestamptz
ALTER TABLE app.email_templates
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE app.email_templates
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

-- 11. Make is_active NOT NULL (was nullable)
ALTER TABLE app.email_templates
  ALTER COLUMN is_active SET NOT NULL;

-- 12. Add updated_at trigger
CREATE OR REPLACE FUNCTION app.update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON app.email_templates;
CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON app.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION app.update_email_templates_updated_at();

-- 13. Enable RLS (idempotent)
ALTER TABLE app.email_templates ENABLE ROW LEVEL SECURITY;

-- 14. RLS Policies: super_admin and admin can do all; guards/clients denied
CREATE POLICY "email_templates_admin_select"
  ON app.email_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  );

CREATE POLICY "email_templates_admin_insert"
  ON app.email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  );

CREATE POLICY "email_templates_admin_update"
  ON app.email_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  );

CREATE POLICY "email_templates_admin_delete"
  ON app.email_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
        AND admin_users.is_active = true
    )
  );

-- ============================================================
-- 15. Seed 15 default QuickGuard-branded templates
-- ============================================================

INSERT INTO app.email_templates (template_key, name, audience, email_type, from_name, from_email, reply_to, subject, preheader, html_body, text_body, is_active)
VALUES

-- GUARD TEMPLATES ---------------------------------------------------

('guard_welcome',
 'Guard Welcome',
 'guard',
 'welcome',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'Welcome to QuickGuard, {{first_name}}!',
 'Your security career starts here.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">Welcome aboard, {{first_name}}!</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">You have successfully joined QuickGuard — the UK trusted security staffing platform. We are excited to have you as part of our professional guard network.</p>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">Complete your profile verification to start receiving job matches tailored to your skills, location, and SIA licence.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Go to Your Dashboard</a>
        </div>
        <p style="color:#94a3b8;font-size:14px;margin:0;">Need help? Reply to this email or contact {{support_email}}.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 'Welcome aboard, {{first_name}}! You have joined QuickGuard. Complete your profile verification to start receiving job matches: {{dashboard_url}}. Support: {{support_email}}',
 true),

('guard_verification_submitted',
 'Guard Verification Submitted',
 'guard',
 'verification',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'Verification documents received — QuickGuard',
 'We are reviewing your documents.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">Verification submitted, {{first_name}}</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">We have received your verification documents and our team is reviewing them. This typically takes 1–2 business days.</p>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">We will notify you as soon as your verification is complete.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">View Status</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 'Your verification documents have been received, {{first_name}}. Our team will review them within 1-2 business days. Track progress: {{dashboard_url}}',
 true),

('guard_verification_approved',
 'Guard Verification Approved',
 'guard',
 'verification',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'Your QuickGuard profile is verified!',
 'You are now eligible to receive job matches.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">Congratulations, {{first_name}}!</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">Your QuickGuard profile has been verified and approved. You are now eligible to receive job matches and apply for security positions across the UK.</p>
        <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:16px;margin:0 0 20px;">
          <p style="color:#0f766e;margin:0;font-size:14px;font-weight:500;">Your profile is live and visible to clients searching for guards in your area.</p>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Browse Available Jobs</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 'Congratulations {{first_name}}! Your QuickGuard profile is verified. You are now eligible for job matches: {{dashboard_url}}',
 true),

('guard_verification_rejected',
 'Guard Verification Rejected',
 'guard',
 'verification',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'Update needed — QuickGuard verification',
 'Your profile requires additional information.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">Action required, {{first_name}}</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">We reviewed your verification documents and some updates are needed before your profile can be approved.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 20px;">
          <p style="color:#991b1b;margin:0;font-size:14px;font-weight:500;">Please log in to your dashboard to see what needs to be corrected and resubmit your documents.</p>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Update Your Profile</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 'Action required {{first_name}}. Your verification needs updates. Log in to see what to correct: {{dashboard_url}}',
 true),

('guard_new_job_match',
 'New Job Match',
 'guard',
 'job',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'New job match: {{job_title}} — QuickGuard',
 'A new security job matches your profile.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">New job match, {{first_name}}!</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 8px;">A new security job matches your profile:</p>
        <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
          <p style="color:#1e293b;font-size:16px;font-weight:600;margin:0 0 8px;">{{job_title}}</p>
          <p style="color:#64748b;font-size:14px;margin:0 0 4px;">{{location}}</p>
          <p style="color:#64748b;font-size:14px;margin:0 0 4px;">{{date}} &middot; {{start_time}}</p>
          <p style="color:#14b8a6;font-size:14px;font-weight:600;margin:0;">{{pay_rate}}/hr</p>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">View &amp; Apply</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 'New job match {{first_name}}: {{job_title}} at {{location}} on {{date}}, {{pay_rate}}/hr. Apply now: {{dashboard_url}}',
 true),

-- CLIENT TEMPLATES ---------------------------------------------------

('client_welcome',
 'Client Welcome',
 'client',
 'welcome',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'Welcome to QuickGuard, {{first_name}}!',
 'Your security staffing solution is ready.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">Welcome, {{first_name}}!</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">Your QuickGuard account is set up and ready. You can now post security jobs and connect with verified SIA-licensed guards across the UK.</p>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">Post your first job in minutes — our platform matches you with the best available guards for your requirements.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Go to Dashboard</a>
        </div>
        <p style="color:#94a3b8;font-size:14px;margin:0;">Questions? Contact {{support_email}}</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 'Welcome {{first_name}}! Your QuickGuard account is ready. Post your first security job: {{dashboard_url}}. Support: {{support_email}}',
 true),

('client_job_posted',
 'Job Posted Confirmation',
 'client',
 'job',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'Job posted: {{job_title}} — QuickGuard',
 'Your job is live and visible to guards.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">Job posted successfully!</h2>
        <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
          <p style="color:#1e293b;font-size:16px;font-weight:600;margin:0 0 8px;">{{job_title}}</p>
          <p style="color:#64748b;font-size:14px;margin:0 0 4px;">{{location}} &middot; {{date}}</p>
          <p style="color:#64748b;font-size:14px;margin:0;">{{start_time}} — {{end_time}}</p>
        </div>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">Your job is now live. Verified guards matching your requirements will be notified and can apply. You will receive updates as applications come in.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">View Applications</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 'Your job "{{job_title}}" has been posted. View applications: {{dashboard_url}}',
 true),

('client_guard_applied',
 'Guard Application Received',
 'client',
 'job',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'New application for {{job_title}} — QuickGuard',
 'A guard has applied to your job posting.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">New application received</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">{{guard_name}} has applied for <strong>{{job_title}}</strong>. Review their profile, experience, and ratings to decide if they are the right fit for your job.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Review Application</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 '{{guard_name}} applied for {{job_title}}. Review their profile: {{dashboard_url}}',
 true),

('client_job_completed',
 'Job Completed',
 'client',
 'job',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'Job completed: {{job_title}} — QuickGuard',
 'Your job has been marked as complete.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">Job completed</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;"><strong>{{job_title}}</strong> has been marked as complete. Please take a moment to review the guard and confirm completion.</p>
        <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:16px;margin:0 0 20px;">
          <p style="color:#0f766e;margin:0;font-size:14px;">Reviewing helps maintain quality standards and gives valuable feedback to your guard.</p>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Confirm &amp; Review</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 '{{job_title}} has been marked complete. Please review and confirm: {{dashboard_url}}',
 true),

-- PAYMENT & SUBSCRIPTION TEMPLATES -----------------------------------

('payment_received',
 'Payment Received',
 'client',
 'payment',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'Payment confirmed — {{amount}} received',
 'Your payment has been processed successfully.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">Payment confirmed</h2>
        <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="color:#0f766e;margin:0;font-size:18px;font-weight:700;">{{amount}}</p>
        </div>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 8px;">Job: <strong>{{job_title}}</strong></p>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">Your payment has been processed and the guard will be confirmed for the shift.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">View Receipt</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 'Payment of {{amount}} for {{job_title}} has been confirmed. View receipt: {{dashboard_url}}',
 true),

('subscription_activated',
 'Subscription Activated',
 'client',
 'subscription',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'Your {{plan_name}} plan is active — QuickGuard',
 'Welcome to your new QuickGuard plan.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">Subscription activated!</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">Your <strong>{{plan_name}}</strong> plan is now active. You have full access to all features included in your plan.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Start Using QuickGuard</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 'Your {{plan_name}} plan is active. Start using QuickGuard: {{dashboard_url}}',
 true),

-- AUTH TEMPLATE -----------------------------------------------------

('password_reset',
 'Password Reset',
 'all',
 'auth',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'Reset your QuickGuard password',
 'Follow the link to reset your password.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">Password reset request</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">Hi {{first_name}}, we received a request to reset your QuickGuard password. Click the button below to set a new password.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{reset_link}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Reset Password</a>
        </div>
        <p style="color:#94a3b8;font-size:14px;margin:0;">If you did not request this, you can safely ignore this email. The link expires in 1 hour.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 'Reset your QuickGuard password: {{reset_link}}. If you did not request this, ignore this email.',
 true),

-- ADMIN TEMPLATES ---------------------------------------------------

('admin_new_guard_verification',
 'New Guard Verification Pending',
 'admin',
 'verification',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'New guard verification: {{guard_name}} — QuickGuard Admin',
 'A guard has submitted verification documents.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard Admin</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">New verification pending</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;"><strong>{{guard_name}}</strong> has submitted verification documents for review. Their SIA licence and identity documents are ready for inspection.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Review Now</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard Admin &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 '{{guard_name}} submitted verification documents. Review now: {{dashboard_url}}',
 true),

('admin_payment_failure',
 'Payment Failure Alert',
 'admin',
 'payment',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'Payment failure — {{client_name}} — QuickGuard Admin',
 'A client payment has failed.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard Admin</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">Payment failure</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">A payment of <strong>{{amount}}</strong> for <strong>{{job_title}}</strong> by <strong>{{client_name}}</strong> has failed. The guard has not been confirmed for this shift.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 20px;">
          <p style="color:#991b1b;margin:0;font-size:14px;font-weight:500;">Action may be required — review the payment in the admin dashboard.</p>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">View Payment</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard Admin &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
  'Payment failure: {{amount}} for {{job_title}} by {{client_name}}. Review: {{dashboard_url}}',
 true),

('admin_complaint_alert',
 'Complaint Alert',
 'admin',
 'alert',
 'QuickGuard Notifications',
 'noreply@quickguard.uk',
 'support@quickguard.uk',
 'New complaint filed — QuickGuard Admin',
 'A complaint has been submitted.',
 '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <tr><td style="background:#0f172a;padding:36px 40px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">QuickGuard Admin</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#1e293b;margin:0 0 12px;font-size:22px;">New complaint filed</h2>
        <p style="color:#475569;font-size:16px;line-height:1.7;margin:0 0 20px;">A new complaint has been submitted regarding <strong>{{job_title}}</strong>. The complaint was filed by {{complainant}} and requires admin review.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{dashboard_url}}" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">Review Complaint</a>
        </div>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:13px;color:#94a3b8;">
        QuickGuard Admin &copy; 2026. All rights reserved.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>',
 'New complaint for {{job_title}} by {{complainant}}. Review now: {{dashboard_url}}',
 true)

ON CONFLICT (template_key) DO NOTHING;

COMMIT;