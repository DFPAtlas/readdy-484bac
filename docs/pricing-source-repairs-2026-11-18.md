# Pricing source and annual billing repairs

The help calculator and printable guide kept their own membership prices, fees and allowances. The upgrade page could label the entire annual charge as a monthly amount and invent a discount when no annual Stripe price was configured. These were remaining maintenance risks after the consistency audit.

## Result

- Main pricing, upgrade, help and printable pricing use one validated loader for active `app.plans` and the existing narrow `app.get_public_client_pricing_fees()` RPC.
- Prices, plan names/descriptions, feature lists and posting/application allowances come from the catalogue. The help guard section includes the free account. Inactive plans and contradictory copied exclusions are removed from these views.
- The help calculator includes percentage and fixed per-guard fees through the existing checkout-compatible estimate helper. A missing, invalid, duplicated or failed fee lookup never becomes a free-fee estimate.
- One price component separates annual total from monthly equivalent and formats GBP to two decimal places. Client Pro, for example, is £990 upfront per year, equivalent to £82.50 per month. Annual pricing follows the existing checkout validator's ten-month-price contract; no server billing rule was changed.
- A paid plan with no configured annual Stripe price displays annual billing as unavailable and cannot be subscribed to with that option from pricing or upgrade.
- The printable guide loads a dated current catalogue snapshot; printing is disabled until prices and fees load successfully. Monthly/annual selection applies consistently to guard and client plans. Service-fee summaries are dynamic. Hourly budget ranges are explicitly illustrative rather than platform prices or guard quotes.
- Feature wording is shared, including the planned status of boost placement and integration availability by arrangement.
- Loading failures offer retry. Retried or unmounted requests ignore late responses instead of showing superseded pricing.

## Validation

Ten new regression tests cover changed prices and limits across the rendered pages, fixed fees and per-guard rounding, annual amounts against the checkout validator, unavailable annual prices, missing/invalid fee data, failed loads, retries and late-response handling.

The shared loader was also exercised anonymously against QuickGuard's live read API: all eight active plans loaded with the expected fees and allowances. No account, subscription, promotion or payment records were modified. This is a frontend repair; no database migration or Edge Function deployment is required. The December Pro offer schedule is unchanged.

Full-suite, TypeScript, ESLint, admin/financial type gate and production-build results are recorded in the pull request. A source-link scan found no missing destinations among 869 literal internal links across 840 source files and 180 route files.

## Scope

This does not implement rewards redemption or company management CRUD. Those remain separate development/UAT work. Frontend changes require merge, Readdy import and publication before appearing live. No real checkout payment or refund was performed.
