-- Scheduled jobs need their own confirmation; preserve existing edited templates.
INSERT INTO app.email_templates (
  name, template_slug, subject, body_html, description, category, variables, is_active
) VALUES (
  'Scheduled Job Confirmation',
  'job_scheduled',
  'Job saved for scheduled publication — {{job_title}}',
  $html$<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Job saved for scheduled publication | QuickGuard</title></head>
<body style="margin:0;padding:24px 12px;background:#0b1628;font-family:Arial,Helvetica,sans-serif;color:#d7e1ef">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#142238;border:1px solid #30425b;border-radius:8px">
<tr><td style="padding:24px 28px;background:#0b1930"><p style="margin:0;color:#ffffff;font-size:24px;font-weight:bold">QuickGuard</p></td></tr>
<tr><td style="padding:28px;line-height:1.65"><h1 style="margin:0 0 20px;color:#ffffff;font-size:26px">Job saved for scheduled publication</h1>
<p>Dear {{client_name}},</p><p>Your security job has been saved as a draft for scheduled publication. It is not yet visible to guards, and matching guards have not been notified.</p>
<p><strong>Scheduled publication:</strong> {{publish_at}} (UK time).</p>
<p>Check the job status in your dashboard to confirm when it has been published.</p>
<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="background:#0b1628;border:1px solid #30425b">
<tr><td><strong>Title</strong></td><td>{{job_title}}</td></tr>
<tr><td><strong>Venue</strong></td><td>{{venue}}</td></tr>
<tr><td><strong>Shift date</strong></td><td>{{start_date}}</td></tr>
<tr><td><strong>Shift time</strong></td><td>{{start_time}}</td></tr>
<tr><td><strong>Guards needed</strong></td><td>{{number_of_guards}}</td></tr>
<tr><td><strong>Rate</strong></td><td>£{{hourly_rate}}/hr</td></tr></table>
<p><a href="{{dashboard_url}}" style="color:#39d3c5">Open your dashboard</a></p></td></tr>
<tr><td style="padding:22px 28px;background:#0b1930;border-top:1px solid #30425b;font-size:13px;color:#b9c8db">QuickGuard · Professional security staffing · {{year}}</td></tr>
</table></td></tr></table></body></html>$html$,
  'Acknowledges a scheduled draft without claiming that it is live or guards have been notified.',
  'client',
  '["client_name","job_title","publish_at","venue","start_date","start_time","number_of_guards","hourly_rate","dashboard_url","year"]'::jsonb,
  true
) ON CONFLICT (template_slug) DO NOTHING;
