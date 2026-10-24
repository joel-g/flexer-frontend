# R10 integration slice — pending independent review

Uses deployed redesign baseline 792d62ff and frozen contract revision 3. Exact vendored DTO SHA256 is 7AE1CCD69C156DE9064D67FE0516E5DFE48D2A71FA0A741C340EB557EFF7DA0F; golden fixture hash is unchanged. No commit, push, deploy or production requests.

Adds an independently loaded running card, authenticated running route, desktop/mobile running links, explicit empty-account setup, draft creation and reopening via the frozen paginated list endpoint. Account setup is a button action, never automatic or queued. List refresh detects history-generation changes; server HISTORY_CHANGED drops stale pagination and requires refresh. Imported drafts retain the reviewed R08/R09 exact-preview and replacement consent flow.

The strength dashboard keeps its existing onboarded workflow. An incomplete strength onboarding status now offers a strength setup action without redirecting running-only users. Strength lookup failures remain errors, and malformed onboarding status cannot be treated as incomplete setup. Running loading, disabled, error, no-plan and active states are independently rendered; neither, strength-only, running-only and both domains can coexist without a combined readiness gate.

The new running provider remains inside the existing API authentication boundary. Private running components are keyed by account and Clerk session; session rotation/unmount invalidates requests and removes private UI. getToken function identity changes do not recreate the client. Running account incarnation additionally keys private draft state. No durable replay exists in this slice. R13 must retain the agreed pause/recovery guard across ambiguous auth loss and add explicit app-signout warning/clear before release; provider-null/same-user recovery needs interaction tests.

Validation: 45 Node tests passed (14 baseline, 31 running), app TypeScript passed, changed-file ESLint passed, Vite build passed with existing >500k chunk warning. Static rendering covers running-card loading/disabled/error/none/draft/active states. Client test checks exact listing query, opaque cursor escaping and no mutation. These are not browser interaction, actual signed-in authentication or local Worker/CORS proof.

Pending: Kipp review; fixture browser entry and four-state desktop/mobile interaction matrix; real local Worker integration; R12 checklist and R13 queue/signout. Active-plan route explicitly identifies checklist/logging as not integrated yet. This slice is not release-ready and was not deployed.
