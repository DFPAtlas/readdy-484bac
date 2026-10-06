# Cron Job Setup

The publishing and cleanup functions read `CRON_SECRET` from Supabase Edge Function
Secrets and require the same value in `x-cron-secret`. Guard payout auto-release uses
a separate generated Vault token and is installed by the database migration.

## Secrets to add

1. Supabase Dashboard -> Edge Functions -> Secrets -> New secret
   - Name: `CRON_SECRET`
   - Value: the value you already saved

2. In your scheduler (cron-job.org, GitHub Actions, pg_cron, etc.), store the same
   value so it can be sent as the `x-cron-secret` header.

## Endpoints

| Function | URL | Suggested cadence |
| --- | --- | --- |
| publish-scheduled-posts | `https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/publish-scheduled-posts` | every 10 minutes |
| process-overdue-guard-payouts | `https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/process-overdue-guard-payouts` | hourly at minute 7 (installed by migration) |
| run-cleanup-now | `https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/run-cleanup-now` | daily |

The publishing and cleanup endpoints are `POST` requests with header:

```
x-cron-secret: <YOUR-CRON-SECRET>
```

## Example: cron-job.org

Create monitors only for publishing and cleanup when an external scheduler is used:
- Request type: POST
- Header: `x-cron-secret` = `<YOUR-CRON-SECRET>`

## Example: GitHub Actions (.github/workflows/cron.yml)

Create this file in your own GitHub repo (outside this project, since this project
blocks the workflows directory):

```yaml
name: cron-jobs
on:
  schedule:
    - cron: "*/10 * * * *"
    - cron: "0 2 * * *"
jobs:
  cron:
    runs-on: ubuntu-latest
    steps:
      - name: publish-scheduled-posts
        run: curl -fsS -X POST https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/publish-scheduled-posts -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
      - name: run-cleanup-now
        run: curl -fsS -X POST https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/run-cleanup-now -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

## Example: pg_cron (if available in Supabase)

```sql
select cron.schedule('publish-scheduled-posts', '*/10 * * * *',
  $$select net.http_post(
    url := 'https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/publish-scheduled-posts',
    headers := '{"x-cron-secret": "<YOUR-CRON-SECRET>"}'::jsonb
  )$$);
```

## Verify

Hit either publishing or cleanup endpoint from the Supabase "Invoke" panel with the
`x-cron-secret` header set.
A `200` with a JSON body means you're wired up; `{"error":"Unauthorized"}` means the
header value does not match `CRON_SECRET`.

For guard payouts, verify that `cron.job` contains one active
`process-overdue-guard-payouts` entry. Its token is stored as
`qg_payout_worker_token` in Vault and must not be copied into frontend code. The retired
`auto-release-guard-payments` endpoint intentionally remains HTTP 410.
