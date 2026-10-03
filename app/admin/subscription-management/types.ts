export interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  plan_slug: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: string;
  current_period_end: string;
  current_period_start: string;
  created_at: string;
  updated_at: string;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  last_payment_date: string | null;
  payment_status: string | null;
  payment_failure_count: number;
  last_payment_error: string | null;
  billing_cycle: string | null;
  amount_paid: number | null;
  trial_end_date: string | null;
  currency: string | null;
}
