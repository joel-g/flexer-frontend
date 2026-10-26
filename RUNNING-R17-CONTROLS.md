# R17 standalone plan controls

Owned files only: RunningPlanActions.tsx, running-plan-actions.test.cjs, this evidence. No client, queue, cache, context, routes, CSS, contract or package edits.

Export `RunningPlanActions` receives identityKey, plan `{id,revision,lifecycle}`, generation, online, enabled, pendingEdits, api adapter and lifecycle callbacks. Types are exported as RunningPlanActionsProps, RunningPlanActionsAdapter and RunningPlanAction (`archive`|`delete`).

Adapter matches existing client:

- archive(planId, body:Archive, operationId) -> Promise<{data:CanonicalPlan,status:number}>
- deletePlan(planId, revision) -> Promise<{data:{deleted:true},status:number}>. Client supplies If-Match and incarnation.

Required callbacks: beforeAction(action, planId) pauses/quiesces the chosen plan's queue; afterArchive(plan) refreshes state without discarding queued result corrections; afterDelete(planId) clears only that plan's private cache/queue and refreshes. These callbacks belong to frontend owner. No blanket cache clearing occurs here. Parent keys by account/session/incarnation; internal guards also prevent stale-owner callbacks.

Confirmation binds current owner, plan, revision, domain generation, pending-edit status and connectivity/feature state. Archive operation ID is stable for unchanged owner/plan/revision/generation across uncertain retries. Archive retains results, permits later result corrections, freezes schedule. Delete confirmation describes only this plan/results and explicitly leaves other plans, strength workouts, account and Clerk identity untouched.

Server acknowledgment is recorded before callback cleanup. If cleanup fails, UI explicitly says server archive/deletion completed but local copies or pending edits may remain, keeps mutations paused and offers local-cleanup-only retry. It never claims an undo or resends deletion for cleanup. Pending edits on archive must remain recoverable; integration must not auto-replay after uncertainty. Feature disabled renders no list/read bypass; existing Profile cleanup remains elsewhere. Offline server actions are disabled.

Validation: six synthetic tests passed with existing Node22, TypeScript transpilation and React static rendering/minimal hook runner. Covered explicit scope/pending confirmation, offline/disabled controls, stable archive retries with expected revision/generation, changed-generation consent invalidation, delete revision, cleanup failure and retry without server resend, pre-action failure, raw-error suppression and account-switch stale acknowledgment. Focused strict TypeScript and ESLint passed. No dependencies installed, real records deleted, production requests, browser or visual/accessibility verification performed. Independent Kipp review and owner integration remain required.

Command: `node --test tests/running-plan-actions.test.cjs` from running-frontend.

Independent review correction: added mounted/lifetime epoch guard invalidated by effect cleanup. Async dispatch after beforeAction, post-API lifecycle callbacks, cleanup-only retries and subsequent state updates are gated. Eight tests now pass, including held-beforeAction unmount with zero dispatch and held archive/delete API responses with zero cleanup callback after unmount. Focused TypeScript and ESLint pass. This covers keyed-unmount behavior that owner-prop guards alone missed.
