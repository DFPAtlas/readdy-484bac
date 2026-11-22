# HAL QuickGuard worker query repair — 22 November 2026

Status: prepared handoff; workflow changes have **not** been applied from this workspace.

Paste the following task into the Codex session running on HAL:

---

Repair the three confirmed QuickGuard n8n PostgREST query failures. Discover the installed n8n instance and use its supported workflow export/update interface. Back up each affected workflow before changing it; preserve credentials, workflow IDs, activation, schedules, URLs and unrelated nodes. Never print secrets. Identify workflows by their actual HTTP request nodes and downstream consumers; the agent names below are search hints, not verified workflow IDs.

Production Supabase project: `vnywjfpkepjgclkbcmsj`. Requests with user-agent `n8n` failed every five minutes at approximately `:02` on 22 November. Confirmed request/schema mappings:

| Failing request | Existing database fields | Required repair |
| --- | --- | --- |
| `guards?select=id,average_rating,rating,review_count,total_reviews,completed_jobs,total_completed_jobs,reliability,punctuality,professionalism,communication` | `id,rating,total_reviews,total_jobs_completed` | Select the existing fields. Update downstream normalization to these names. Only derive aliases from equivalent real values. Unavailable reliability/punctuality/professionalism/communication metrics stay unknown. |
| `agent_registry?select=agent_id,agent_name,site,parent_agent,health,status,is_active,last_heartbeat,updated_at&site=eq.quickguard.uk` | `id,agent_id,site,name,enabled,config,created_at,updated_at` | Use `name` and `enabled` where equivalent. Health and heartbeat come from the latest per-agent, per-site `app.agent_state_snapshots` row (`id,agent_id,site,health,state,created_at`), with an explicit freshness threshold. Do not invent unsupported parent/status fields. |
| `job_assignments?select=id,job_id,guard_id,status,payment_status,created_at,assigned_at&status=in.(selected,awaiting_payment,confirmed,in_progress)` | `id,job_id,guard_id,status,payment_status,assigned_at` | Remove nonexistent `created_at`; use the actual `assigned_at` timestamp for assignment-age calculations. Preserve status filtering. |

Search hints: `qg-review-reputation-agent-v01`, `qg-sia-verification-agent-v01`, `qg-diagnostics-recovery-agent-v01`, and `quickguard-master-agent-v01`. Follow actual node references to establish ownership.

At 13:12 UTC there were thirteen fresh subagent snapshots but zero registry rows. The master snapshot on host HAL reported GREEN with zero registered/online agents despite the failed registry request. A failed response must not be treated as a one-row dataset or healthy zero. Validate HTTP success, JSON array shape, expected fields and count values before calculating metrics. Distinguish failed reads, genuinely empty registry, missing telemetry and stale telemetry. Empty registry requires a visible warning; do not fabricate registry rows or force a green master status.

Add focused fixture validation for valid records, genuine empty results, HTTP/PostgREST error objects and stale snapshots. First run affected read/normalization nodes without notification, payment, approval or other write actions. Verify each repaired request returns 200 and the downstream output reflects real counts and unknown values. Observe one normal scheduled cycle and inspect new PostgreSQL logs for SQLSTATE 42703. Retain genuine guard-document, job, finance and review warnings.

Do not add database columns to satisfy stale callers. Do not change guard eligibility, verification evidence, assignments, payment records, Stripe IDs, schedules or outbound email recipients. Do not replay a full workflow if that could send messages or move money. Use isolated fixtures when an end-to-end execution has side effects.

Return the exact workflow IDs/names changed, backup locations, minimal before/after node diffs, validation results, scheduled execution IDs/times, remaining errors and rollback steps. If the supported update interface is unavailable, stop before changing n8n's internal database and report the missing capability.
