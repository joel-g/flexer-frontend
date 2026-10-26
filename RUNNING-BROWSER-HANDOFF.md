# Local running browser QA

Frontend: http://127.0.0.1:5189/fixture.html?transport=mock

Host-visible Vite session 63060; launched with reviewed `vite.fixture.config.ts`, no dependency installation. Earlier sandbox session 22585 was stopped because it was not host-visible. HTTP GET `/running`, `/dashboard`, `/profile`, `/fixture.html` each returned 200 with `/tests/ui/fixture.tsx`, never `/src/main.tsx`. Fixture build passed. Ports 5187/5193 untouched.

Mock mode uses only synthetic localStorage fixtures and replaces fetch with a fixture-origin-only handler. It has no production network transport. It supports dashboard state, existing active checklist, result updates, reschedule, simple saved-draft reads, profile display/delete and fault injection. Mock BYOL creation/import/activation/history are **unsupported** and must not be counted as passing acceptance. Offline toolbar is a simulation, not a browser network-disconnect test.

Actual Worker mode: `/fixture.html?transport=worker&api=<URL-encoded loopback Worker origin>`. Case supplies the Worker origin. Test-only transport fetches `/__fixture/session`, keeps synthetic signed tokens only in memory and permits only that loopback API origin with real CORS/custom headers and no cookies/redirects. Subject A is `synthetic-clerk-a`, subject B `browser-synthetic-b`. Browser fixture Clerk hooks are synthetic; this proves real Worker token verification for test accounts, not a production Clerk positive login. Transport choice persists in sessionStorage across route reload; “Reset to mock transport” clears it. No credential or real user data is used.

Initial mock checks:

1. At desktop and mobile widths use neither/strength/running/both. Dashboard states remain independent; running-only never redirects to strength setup. Keyboard focus, readable labels, no horizontal overflow, text/contrast checks.
2. Open Running; log a past/current date, positive distance, optional duration OR pace, RPE 0 and notes. Observe device-pending state then canonical save. Reopen editor: current measurements remain, derived duration is labeled. Undo, skip, edit again. Timed prescription still requires actual distance; no fabricated target distance.
3. Toggle simulated offline, log, reload. Queue stays stored; page requires connection/revalidation to reopen plan. Reconnect/reload, explicitly recover pending edits; no automatic replay on identity recovery.
4. Choose next request lost response, save: stable mutation retry must not duplicate. Conflict: fetch current server result, explicitly accept correction, save. Reconnect/new edits must not bypass Retry-After (controller unit test covers timer, mock does not inject429).
5. Reschedule pending run online; check original date preserved/current Monday group changes. Completed/skipped, pending-queue and archived schedules cannot reschedule.
6. Pending edits then explicit Header/Profile signout: cancel retains edits; accept clears only that account. Switch A/B and ambiguous loss: no foreign/private replay. Open two tabs for cross-tab writer/signout checks. Storage clear failure must pause and visibly stop signout, never claim cleared.
7. Actual Worker mode: intake/copy-only prompt, JSON import field errors, requested/proposed changes, activation consent/CAS, API preflight custom headers, same-user and cross-user isolation. Use only disposable synthetic Worker data.

Gates not yet claimed: actual browser interactions/a11y, real Web Locks multi-tab behavior, Worker mode acceptance, production signed-in login, complete offline app reload. No production deploy/push/commit occurred.
