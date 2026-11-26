# Scheduled job confirmations

A job with a future publication time is saved as a draft, but `create-job` still invokes the same confirmation sender. The active `job_posted` template says the job is "now live". The sender previously had no saved-publication-state check, so scheduled clients could receive that incorrect claim before their job was visible or guard notifications were queued.

The sender now reads the saved job's `status`, `is_draft` and `publish_at`. A consistent scheduled draft uses a separate `job_scheduled` template, which says the job is not yet visible, guards have not been notified and the client should check the dashboard for publication. Its scheduled time is formatted in `Europe/London`, including GMT/BST. Published open jobs retain the existing `job_posted` template, even when a historical scheduling date remains. Caller-supplied publication fields cannot override stored state. Missing, unreadable, inactive or inconsistent jobs fail before the renderer is invoked; job creation retains its existing honest email-warning behavior.

The additive migration inserts the scheduled template with `ON CONFLICT DO NOTHING`. It changes neither the live-job template nor an existing administrator-edited scheduled template, and does not reactivate a disabled one. There are no billing, payout, subscription, permission or scheduling-worker changes.

## Validation

Execution regressions cover live/scheduled routing, forged caller fields, UK summer/winter time, unavailable and inconsistent state, private preview mode, successful provider acceptance and creation continuing with an email warning. A real PostgreSQL-compatible migration test invokes the actual template preview handler, verifies resolved scheduled content with no provider call, and replays the migration after administrator editing/deactivation to prove preservation.

All 10 focused regressions and all 1,384 repository unit tests passed. Repository TypeScript, the admin/financial gate, strict Edge typing for the sender and repository lint passed; lint retains 12 existing warnings and no errors.

## Rollout

This change stacks on the existing onboarding repair branch. Review and merge its prerequisites first. Apply the scheduled-template migration before deploying `send-job-posted-email`; retain the environment's existing delivery setting. Missing or inactive scheduled templates produce a visible confirmation-delivery warning rather than a false live-job message. No frontend publication is needed for these two backend changes.

No production deployment or outgoing confirmation email was performed for this repair. Test the active templates and an explicitly authorized recipient before marking delivery acceptance complete. A dry-run preview confirms rendering only, not inbox delivery or eventual scheduled publication.
