# Cron Job Setup

The three cron-gated functions read `CRON_SECRET` from Supabase Edge Function Secrets
and require the same value to be sent in the `x-cron-secret` header on every request.

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
| auto-release-guard-payments | `https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/auto-release-guard-payments` | every hour |
| run-cleanup-now | `https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/run-cleanup-now` | daily |

All three are `POST` requests with header:

```
x-cron-secret: <YOUR-CRON-SECRET>
```

## Example: cron-job.org

Create three monitors, one per endpoint, each with:
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
    - cron: "0 * * * *"
    - cron: "0 2 * * *"
jobs:
  cron:
    runs-on: ubuntu-latest
    steps:
      - name: publish-scheduled-posts
        run: curl -fsS -X POST https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/publish-scheduled-posts -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
      - name: auto-release-guard-payments
        run: curl -fsS -X POST https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/auto-release-guard-payments -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
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

Hit any endpoint from the Supabase "Invoke" panel with the `x-cron-secret` header set.
A `200` with a JSON body means you're wired up; `{"error":"Unauthorized"}` means the
header value does not match `CRON_SECRET`.