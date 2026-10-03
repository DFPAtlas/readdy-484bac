-- Enlarge the shared email action buttons without changing template variables.
UPDATE app.email_templates
SET body_html=replace(
  replace(body_html,'padding:14px 24px;border-radius:6px;font-weight:bold;font-size:16px;line-height:1.4;text-decoration:none;text-align:center',
  'padding:16px 28px;border-radius:8px;border:1px solid #115E59;font-weight:bold;font-size:17px;line-height:1.4;text-decoration:none;text-align:center'),
  '>Go to Dashboard</a>', '>Open Your Dashboard</a>')
WHERE is_active=true AND body_html LIKE '%background:#0B1933%';