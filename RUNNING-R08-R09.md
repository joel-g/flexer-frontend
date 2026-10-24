# Running intake and preview slice

Scope: R08/R09 components and local fixture adapter, before live backend wiring. No routes, App authentication, dashboard, layout or strength workflows changed. `RunningDraftFlow` must be mounted keyed by authenticated account and incarnation during later integration. It never bootstraps an account or calls an LLM.

Contract revision2 is vendored exactly:

- `src/running/contract.ts`: SHA256 `0A3BB6E62397AFDEE143392D409C41F8CE4067CC2D2B2F26CA5B8B4958C84707`
- `tests/fixtures/running-contract.json`: SHA256 `61D7ECFB5DD4DF1ED30F44A0AF5452049A0873182E5F1A14E5374E3783B14450`

Components provide all agreed intake fields, including unknown versus zero, optional four weekly totals, aggregate race history, longest run/date, manually confirmed lifting context, dates and named timezone. `intake.ts` builds the exact DTO and validates form fields; server validation remains authoritative. No training readiness score or mileage cap is added.

Prompt review selects explicit intake fields, excludes interruption/limitation notes by default, and requires review of the exact prompt before copy/continue. Copy is a user-triggered clipboard action only. Prompt describes schema, canonical meters/seconds, software limits, requested/proposed goal/date differences and unverified model text. The test-only marathon example is not a UI default.

Import sends raw text through the frozen client, displays API field paths and preserves pasted text on failures. Preview displays the original goal, model echo, proposed goal and individual changes, plus unverified rationale/assumptions/cautions. Activation requires every difference accepted and acknowledgment of the exact plan revision/import/token. Changed previews invalidate consent. Operation IDs remain stable for retry of unchanged payloads and change after edits. Import/activation/refresh are disabled offline. No draft-list contract was invented.

Validation executed:

- All 43 Node tests pass: 14 existing tests, 18 R07 tests, 11 intake/preview tests.
- React server-render checks cover field groups, disabled controls, unverified labeling and escaped hostile text. These are **not** browser interaction/a11y tests.
- Full app and Node TypeScript checks pass, with incremental caches under `.running-cache`.
- Targeted ESLint for `src/running` passes.
- Vite7.3.7 build passes; existing large-chunk warning remains. Output still uses the deployed redesign assets because running routes are intentionally not mounted.

Tests use only `tests/fixtures/running-api.mjs`, an in-memory synthetic adapter; its basic validation is not the production server validator or evidence for D1 semantics. No production requests/data, browser automation, commits, pushes, deployment, installation or credential changes occurred. An approved junction exposes existing reviewed frontend dependencies read-only for compilation; no shared dependency/cache changes were made. Actual browser/positive-auth/online API wiring remain gated on later review.

Independent review correction: activation consent now binds the exact preview to account incarnation, domain generation and expected active running plan. A conflict clears both preview acknowledgment and individual difference acceptance immediately; any account precondition change also invalidates them by identity. The checkbox explicitly accepts current-plan replacement. A regression proves old consent cannot authorize replacement after another tab activates a plan, after a generation change, after archival, or after an account incarnation change. App TypeScript, scoped lint and all 43 tests passed after this correction. Browser interaction proof remains pending.
