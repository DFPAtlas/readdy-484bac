# Company portal availability and support actions

The company dashboard still presented six report cards as clickable despite having no action, sent “Manage Billing” to public pricing, labelled a subscription status as the plan and substituted “Free” for a missing status. Its message-count view told users to check an inbox that was not implemented. Company support links also lost their topic because the contact page ignored the query parameter.

## Repair

- Mark report generation/downloads and the six proposed report types as planned. Remove the cards' clickable styling and offer a company-report enquiry link.
- Label the recorded subscription status accurately, show “Not recorded” for absent data, and route billing assistance to contact rather than public pricing. Explain that invoice downloads and subscription changes are unavailable in this portal.
- Explain that the messages tab provides an unread count only, with support assistance for reading/replying; preserve the existing owner-scoped count.
- Resolve the ten known company support topics into readable subjects and existing contact categories on the contact page. The fields remain editable, personal details stay blank, and unrecognised/repeated query values yield the normal empty form. Navigating to a different known topic resets the form to that topic.

## Verification and release

Rendered regression checks exercise reports, billing with recorded/missing status, messages with zero/two unread items and the ten contact destinations. Query boundary cases cover unknown, repeated and inherited-property values. No form is submitted by these tests.

This change does not implement company editing, report generation, an inbox or billing management. No database migration, Edge Function deployment, payment, email or live record change is required. After merge, import current main into Readdy and publish. Signed-in browser UAT and a controlled contact submission remain outstanding.
