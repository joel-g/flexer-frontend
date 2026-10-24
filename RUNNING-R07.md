# R07 running client scaffold

Baseline: deployed redesign commit `792d62ff1b8aae509b92cdf080f23f36da1533a9`, parent fixed source `c687994c6b524ef891237279bf1ab8ef2c55c16c`.

New files are confined to `src/running/` and `tests/running-client.test.mjs` / `tests/fixtures/running-contract.json`. Existing App authentication, layout, strength persistence and production configuration are unchanged. No singleton is mounted or request made by this slice. R04 backend acceptance and R07 review precede actual app wiring.

`RunningClient` requires explicit authenticated identity setup, blocks absent/rejected tokens, and invalidates pending requests on account or incarnation changes. Incarnation is an optimistic concurrency guard, never an authorization credential. Data mutations require the acknowledged incarnation; bootstrap is a separate explicit call and is never automatically invoked. Import sends bounded direct UTF-8 text with the frozen operation/revision/incarnation headers. Errors retain status, machine code, field errors, canonical conflict state and Retry-After. Network/protocol failures never acknowledge a save or include raw transport errors.

`RunningState` keeps only private in-memory data, clears it synchronously on identity changes, rejects superseded loads and wrong-plan/run/stale-revision responses, and distinguishes disabled/error states from an empty account. Pending error classification does not implement a queue, persist, retry, discard, bootstrap or sign out. Those behaviors remain R13 and require its independent tests. Clerk signout/expiry ambiguity is not resolved by this slice.

The vendored normative DTO and synthetic fixtures came from the approved shared `running-contract` snapshot. Tests pin their SHA256:

- DTO: `E176FBA57B793261A991D2FB20160A987A5E1679B7474FF04706414FC92AD39E`
- Fixtures: `617922591AA30F5EA3103544185D136DBD61C40291ABF5E54EE59EBB0EFF4BDF`

Validation executed with existing Node22.23.3 and frontend-fixes development tools (no installation or node_modules junction):

1. `node --experimental-strip-types --test tests/*.test.mjs`: **32 passed**, including14 existing tests and18 running tests.
2. TypeScript5.9.3 standalone `--noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --verbatimModuleSyntax --erasableSyntaxOnly --noUnusedLocals --noUnusedParameters --lib ES2022,DOM src/running/client.ts src/running/state.ts`: pass.
3. Existing ESLint config against `src/running/*.ts`: pass, no errors/warnings.

No full app build, real API integration, browser/preflight execution, signed-in positive path, queue persistence or production test was performed. Browser capability is unavailable in this task; source fixtures do not replace the later browser gate. No commits, pushes, deployments, credential changes or external requests occurred.

Independent review corrections: result/schedule acknowledgments require matching plan/run IDs, expected next revision and coherent canonical result fields, with positive and negative tests. Auth/feature pause clears private run map as well as visible account state.
