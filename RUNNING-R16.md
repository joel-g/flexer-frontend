# R16 standalone history/totals view

Implemented only `src/running/RunningHistory.tsx` and `tests/running-history-ui.test.cjs`. No routes, context, client, contract, CSS or package changes by Tars. Uses existing running classes and escaped React text. Frontend owner synchronizes/integrates frozen contract independently.

Exports: `RunningHistory`, `RunningTotals`, `RunningHistoryResults`; types `RunningHistoryProps`, `RunningHistoryAdapter`. Main props:

```ts
{ identityKey: string; online: boolean; distanceUnit?: 'mi' | 'km'; api: {
  history(query: RunningHistoryQuery): Promise<{data: RunningHistoryData; status: number}>;
  analytics(query: RunningAnalyticsQuery): Promise<{data: RunningAnalyticsData; status: number}>;
}; initialFrom: string; initialTo: string; planId?: string | null;
  onCorrectResult?: (item: RunningHistoryItem) => void; }
```

Adapter matches the existing unwrapped RunningResponse shape. Parent must supply a stable adapter, key component by account/session epoch/incarnation, and clear/unmount on auth loss. Internal request sequence, effect cancellation, identity and query comparisons also reject stale responses and hide prior-account data immediately. No storage or queue implementation in this view. Online history fetches only; offline messaging points to the separate logging queue without claiming history persistence.

Movable inclusive366-day window; actual/scheduled views;20-item page size. History/analytics generation must agree before display. HISTORY_CHANGED clears rows and resets pagination to first page. Other errors expose safe fixed messages, not raw server content. Current client must validate response DTOs before delivering its adapter results.

Totals show actual distance, timed coverage by run count and distance, timed-only weighted pace, separate planned meters/seconds, weekly plan-local date buckets, and explicitly scheduled-status adherence. Individual results label original/current scheduled/actual dates and pace-derived duration. Correction callback may open the owned plan checklist for archived result correction; this component has no schedule editing action.

Validation executed with existing Node22/TypeScript/React (no installation):

- `node --test tests/running-history-ui.test.cjs`:8/8 passed.
- Focused strict TypeScript no-emit check for RunningHistory.tsx: passed.
- Focused ESLint: passed, zero errors/warnings.

Tests use real React static rendering and a small deterministic hook runner for actual effect callbacks. They cover escaped content, date/pace/coverage labels, duration targets, account-switch late response, generation mismatch, feature-disabled safe errors and stale cursor reset. This is not browser/visual/a11y verification or proof of React scheduling under all conditions. No production request or mutation was performed. Route/client integration and independent review remain with their owners.

Distance preference refinement: optional distanceUnit='mi'|'km', default km, propagates through totals, weekly rows, item distances and weighted pace. Converts seconds/km to seconds/mi using1.609344; canonical server numbers unchanged. Eighth test proves 10000m displays6.21mi and375sec/km displays10:04/mi. Frontend supplies account preferredUnits. Focused typecheck and ESLint remain clean.