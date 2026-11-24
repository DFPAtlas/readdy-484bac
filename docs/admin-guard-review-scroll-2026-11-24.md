# Guard review scrolling repair — 24 November 2026

The published guard-review window was inspected using the labelled synthetic rejection fixture. Its 525px panel held 2,651px of content. A wheel gesture inside the panel moved it to scrollTop 650, but keyboard focus remained on the background View button. Page Down moved the background page from scrollTop 16 to 528 while the review stayed at 650. The independently sticky tab bar also assumed an 88px header while the rendered header measured about 97px.

The review now uses a viewport-bounded flex column. Its header and horizontally scrollable tabs sit outside one focusable details scroll region; the fixed sticky offset and nested vertical scrolling are removed. The scroll region has an explicit scrollbar and contains touch/wheel overscroll. Opening review targets that region through the existing focus-trap dependency, keeps keyboard focus in review and locks background document scrolling. Closing restores the previous overflow value and opener focus; Escape closes review. Changing a tab returns the details region to its start.

The focus trap pauses while rejection, approval, override or request-info dialogs are open, preserving access to those existing dialogs and their higher stacking layers. Escape cannot close the underlying review during a confirmation. Approval/rejection requests, authorization and verification requirements are unchanged. No dependency, database or Edge Function change is needed.

Four new behavioral regressions cover the initial focus target, scroll reset, background-scroll restoration, close/Escape, nested confirmations and request-info access. Existing session, SIA display and approval feedback regressions also run. The focus-trap dependency itself is stubbed in the unit harness; these checks do not replace real-browser layout acceptance.

The browser connection stopped responding after reproduction. Published acceptance of the new wheel/touch/keyboard layout, small viewports and focus return therefore remains pending after merge and Readdy publication. No production guard decision or account data was changed during investigation.
