import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

serve(async (req: Request) => {
  const xCron = req.headers.get("x-cron-secret") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || "";

  if (!cronSecret || xCron !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: "app" } });
  const now = new Date().toISOString();

  const results = {
    released: [] as string[],
    skipped: [] as { assignment_id: string; reason: string }[],
    failed: [] as { assignment_id: string; error: string }[],
  };

  const { data: rules, error: rulesErr } = await supabase
    .from("plan_fee_rules")
    .select("plan_slug, auto_release_hours")
    .gt("auto_release_hours", 0);

  if (rulesErr) {
    return new Response(JSON.stringify({ error: "failed to fetch plan_fee_rules", detail: rulesErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hoursLookup = new Map<string, number>();
  for (const r of rules) {
    hoursLookup.set(r.plan_slug, r.auto_release_hours || 72);
  }
  const defaultHours = 72;

  const { data: assignments, error: assignErr } = await supabase
    .from("job_assignments")
    .select("id, job_id, guard_id, payment_status, completed_at, guard_net_payout, gross_guard_amount, client_total_amount")
    .eq("payment_status", "awaiting_client_release")
    .not("completed_at", "is", null);

  if (assignErr) {
    return new Response(JSON.stringify({ error: "failed to fetch assignments", detail: assignErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!assignments || assignments.length === 0) {
    return new Response(JSON.stringify({
      message: "no assignments awaiting release",
      timestamp: now,
      results,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const assignmentIds = assignments.map((a) => a.id);
  const jobIds = [...new Set(assignments.map((a) => a.job_id))];
  const guardIds = [...new Set(assignments.map((a) => a.guard_id).filter(Boolean))];

  const { data: jobs, error: jobsErr } = await supabase
    .from("jobs")
    .select("id, job_title, disputed, payment_status, client_id")
    .in("id", jobIds);

  if (jobsErr) {
    return new Response(JSON.stringify({ error: "failed to fetch jobs", detail: jobsErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const jobMap = new Map(jobs?.map((j) => [j.id, j]) || []);

  const { data: existingPayouts, error: payoutsErr } = await supabase
    .from("guard_payouts")
    .select("assignment_id, status")
    .in("assignment_id", assignmentIds);

  if (payoutsErr) {
    return new Response(JSON.stringify({ error: "failed to fetch payouts", detail: payoutsErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const existingPayoutSet = new Set((existingPayouts || []).map((p) => p.assignment_id));

  const { data: guards, error: guardsErr } = await supabase
    .from("guards")
    .select("id, stripe_account_id, email, full_name")
    .in("id", guardIds);

  if (guardsErr) {
    return new Response(JSON.stringify({ error: "failed to fetch guards", detail: guardsErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const guardMap = new Map((guards || []).map((g) => [g.id, g]));

  const clientIds = [...new Set((jobs || []).map((j) => j.client_id).filter(Boolean))];

  const { data: clientSubs } = await supabase
    .from("subscriptions")
    .select("user_id, plan_slug, status")
    .in("user_id", clientIds)
    .in("status", ["active", "trialing"]);

  const { data: guardSubs } = await supabase
    .from("subscriptions")
    .select("user_id, plan_slug, status")
    .in("user_id", guardIds)
    .in("status", ["active", "trialing"]);

  const clientSubMap = new Map((clientSubs || []).map((s) => [s.user_id, s.plan_slug]));
  const guardSubMap = new Map((guardSubs || []).map((s) => [s.user_id, s.plan_slug]));

  for (const assignment of assignments) {
    const aid = assignment.id;
    const job = jobMap.get(assignment.job_id);

    if (!job) {
      results.skipped.push({ assignment_id: aid, reason: "job_not_found" });
      continue;
    }

    if (job.disputed) {
      results.skipped.push({ assignment_id: aid, reason: "job_disputed" });
      continue;
    }

    if (job.payment_status === "refunded") {
      results.skipped.push({ assignment_id: aid, reason: "job_refunded" });
      continue;
    }

    if (job.payment_status === "failed") {
      results.skipped.push({ assignment_id: aid, reason: "payment_failed" });
      continue;
    }

    if (existingPayoutSet.has(aid)) {
      results.skipped.push({ assignment_id: aid, reason: "payout_already_exists" });
      continue;
    }

    const clientPlan = clientSubMap.get(job.client_id) || "payg";
    const guardPlan = guardSubMap.get(assignment.guard_id) || "guard-starter";

    const clientHours = hoursLookup.get(clientPlan) || defaultHours;
    const guardHours = hoursLookup.get(guardPlan) || defaultHours;
    const autoHours = Math.min(clientHours, guardHours);

    const completedAt = new Date(assignment.completed_at);
    const deadline = new Date(completedAt.getTime() + autoHours * 60 * 60 * 1000);

    if (new Date() < deadline) {
      results.skipped.push({
        assignment_id: aid,
        reason: "deadline_not_reached_" + autoHours + "h",
      });
      continue;
    }

    const { data: issues } = await supabase
      .from("support_tickets")
      .select("id")
      .eq("job_id", assignment.job_id)
      .eq("status", "open")
      .limit(1);

    if (issues && issues.length > 0) {
      results.skipped.push({ assignment_id: aid, reason: "open_support_ticket" });
      continue;
    }

    const guard = guardMap.get(assignment.guard_id);
    if (!guard || !guard.stripe_account_id) {
      results.skipped.push({ assignment_id: aid, reason: "guard_no_stripe_account" });
      continue;
    }

    const payoutAmount = assignment.guard_net_payout
      ? Number(assignment.guard_net_payout)
      : Number(assignment.gross_guard_amount || 0);

    if (payoutAmount <= 0) {
      results.skipped.push({ assignment_id: aid, reason: "zero_payout_amount" });
      continue;
    }

    const account = await stripe.accounts.retrieve(guard.stripe_account_id);
    if (!account.charges_enabled || !account.payouts_enabled) {
      results.skipped.push({ assignment_id: aid, reason: "stripe_account_not_ready" });
      continue;
    }

    const idempotencyKey = "auto_release_" + aid;

    const { error: updateErr } = await supabase
      .from("job_assignments")
      .update({
        payment_status: "client_released",
        payout_released: true,
        payout_released_at: now,
      })
      .eq("id", aid)
      .eq("payment_status", "awaiting_client_release");

    if (updateErr) {
      results.failed.push({ assignment_id: aid, error: "status_update_failed: " + updateErr.message });
      continue;
    }

    await supabase.from("jobs").update({
      payment_status: "client_released",
      updated_at: now,
    }).eq("id", assignment.job_id);

    const netAmountInPence = Math.round(payoutAmount * 100);

    const { data: payoutRecord } = await supabase
      .from("guard_payouts")
      .upsert({
        guard_id: assignment.guard_id,
        assignment_id: aid,
        job_id: assignment.job_id,
        amount: payoutAmount,
        fee_deducted: 0,
        net_amount: payoutAmount,
        status: "pending",
        platform_fee: 0,
        notes: "Auto-released after client non-response",
        created_at: now,
        updated_at: now,
      }, { onConflict: "assignment_id", ignoreDuplicates: false })
      .select("id")
      .maybeSingle();

    try {
      const transfer = await stripe.transfers.create({
        amount: netAmountInPence,
        currency: "gbp",
        destination: guard.stripe_account_id,
        description: "QuickGuard auto-release: " + (job.job_title || "Job"),
        metadata: {
          guardId: assignment.guard_id,
          jobId: assignment.job_id,
          assignmentId: aid,
          jobTitle: job.job_title || "",
          netAmount: payoutAmount.toString(),
          source: "auto_release_72h",
        },
      }, { idempotencyKey });

      await supabase.from("guard_payouts").update({
        status: "payout_processing",
        stripe_transfer_id: transfer.id,
        stripe_transfer_status: "created",
        updated_at: new Date().toISOString(),
      }).eq("assignment_id", aid);

      await supabase.from("job_assignments").update({
        payment_status: "payout_processing",
        stripe_transfer_id: transfer.id,
        updated_at: new Date().toISOString(),
      }).eq("id", aid);

      await supabase.from("jobs").update({
        payment_status: "payout_processing",
        updated_at: new Date().toISOString(),
      }).eq("id", assignment.job_id);

      await supabase.from("audit_log").insert({
        actor_id: "system",
        actor_role: "system",
        action: "auto_release_payment",
        target_type: "job_assignment",
        target_id: aid,
        metadata: {
          job_id: assignment.job_id,
          guard_id: assignment.guard_id,
          auto_release_hours: autoHours,
          completed_at: assignment.completed_at,
          transfer_id: transfer.id,
          idempotency_key: idempotencyKey,
          net_amount: payoutAmount,
        },
        created_at: now,
      });

      results.released.push(aid);
    } catch (transferError: any) {
      await supabase.from("guard_payouts").update({
        status: "failed",
        failure_reason: transferError.message || "Stripe transfer creation failed",
        updated_at: new Date().toISOString(),
      }).eq("assignment_id", aid);

      await supabase.from("audit_log").insert({
        actor_id: "system",
        actor_role: "system",
        action: "auto_release_failed",
        target_type: "job_assignment",
        target_id: aid,
        metadata: {
          job_id: assignment.job_id,
          guard_id: assignment.guard_id,
          error: transferError.message || "Stripe transfer failed",
          idempotency_key: idempotencyKey,
        },
        created_at: now,
      });

      results.failed.push({ assignment_id: aid, error: "stripe_transfer_failed: " + (transferError.message || "unknown") });
    }
  }

  return new Response(JSON.stringify({
    message: "auto-release complete",
    timestamp: now,
    results,
    summary: {
      total: assignments.length,
      released: results.released.length,
      skipped: results.skipped.length,
      failed: results.failed.length,
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
