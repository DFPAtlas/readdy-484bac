-- Migration: add the signup verification email template
-- First message new guards/clients receive: confirm email with a one-time sign-in link.
-- Layout and styling copied from the existing guard_welcome template.
-- Safe to re-run.

BEGIN;

INSERT INTO app.email_templates (template_slug, name, subject, body_html, category, description, is_active)
VALUES (
  'signup_verification',
  'Signup Verification',
  'Confirm your email to finish joining QuickGuard',
  '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Confirm your email | QuickGuard</title></head><body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;color:#334155"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E2E8F0;border-radius:8px"><tr><td style="background:#0B1933;padding:24px 28px;border-bottom:4px solid #14B8A6"><p style="margin:0;color:#ffffff;font-size:24px;font-weight:bold">QuickGuard</p></td></tr><tr><td style="padding:28px"><h1 style="margin:0 0 20px;color:#0B1933;font-size:26px;line-height:1.3">Confirm your email</h1><table cellpadding="0" cellspacing="0" role="presentation" style="" width="100%"><tr style=""><td style="padding:16px 0"><h2 style="font-size:18px;margin:0 0 16px;line-height:1.3;color:#0B1933">Hi {{user_name}},</h2><p style="font-size:16px;line-height:1.65;color:#334155">Thanks for signing up to QuickGuard. Click the button below to confirm your email and sign in for the first time. This link can only be used once.</p><div style="text-align:center;margin:30px 0"><a href="{{verify_url}}" style="display:inline-block;background:#0F766E;color:#ffffff;padding:14px 24px;border-radius:6px;font-weight:bold;font-size:16px;line-height:1.4;text-decoration:none;text-align:center">Confirm email and sign in</a></div><p style="font-size:16px;line-height:1.65;color:#334155">If you didn''t sign up for QuickGuard, you can ignore this email.</p></td></tr></table></td></tr><tr><td style="padding:22px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0"><p style="margin:0;color:#475569;font-size:13px;line-height:1.6">QuickGuard · Professional security staffing<br><a href="https://quickguard.uk" style="color:#0F766E">quickguard.uk</a></p></td></tr></table></td></tr></table><p style="text-align:center;font-size:13px;color:#475569">{{year}}</p></body></html>',
  'all',
  'Signup email verification with a one-time sign-in link.',
  true
)
ON CONFLICT (template_slug) DO NOTHING;

COMMIT;