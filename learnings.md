# Learnings (Implementation Session)

## Scope and Safety
- Kept testing scope in PAPER mode only; no live credential flow was exercised.
- Runtime persistence changes were implemented to improve restart safety without requiring Polymarket connectivity.
- Continued with basic hardening only (no password/auth layer yet), per request.

## What Worked
- Reusing `better-sqlite3` for bot runtime state worked cleanly because it is already a project dependency (used by whale storage).
- A single SQLite file at `.runtime/bot-state.sqlite` is enough to persist:
  - wallet runtime snapshot payloads
  - kill-switch state
- Keeping the existing JSON snapshot (`.runtime/wallet-runtime.snapshot.json`) as fallback preserves backward compatibility for existing environments.
- Scanner JSON parsing now works with both real streaming `Response` bodies and mock test responses exposing only `json()`.
- Dashboard API hardening without auth was effective:
  - per-IP rate limiting on `/api/*`
  - remote-friendly default bind host (`0.0.0.0`) with explicit override via `DASHBOARD_BIND_HOST`
  - additional response security headers
- Log-noise reduction by deduping repetitive warning/error patterns materially improved operator readability during paper-mode runs.
- A bounded auth-failure circuit breaker in ingestion prevented endless 401/403 loops and reduced needless endpoint churn.
- Shared runtime counters provided a low-friction way to expose hardening behavior in one API payload without broad dependency wiring.
- A shared link-render helper in dashboard script kept external navigation behavior consistent across multiple tables.
- A lightweight market slug cache (TTL refresh) improved event-link accuracy without adding backend route complexity.
- Instrumenting route and submit latency at the order-router boundary provided good phase-2 signal with minimal cross-module changes.
- Surfacing execution counters in the dashboard made latency/error regressions visible without requiring log scraping or manual API calls.
- Rolling latency windows plus p95/p99 percentiles made short-term execution regressions visible that cumulative averages can hide.
- Persisting rolling latency sample windows alongside counters was necessary for meaningful percentile continuity after restart.
- Storing last-attempt and last-latency timestamps alongside aggregate metrics makes stale execution telemetry obvious after quiet periods.
- Showing p95 deltas between refreshes gives faster operator signal for sudden latency regressions than absolute p95 alone.
- Awaiting persistence writes during shutdown avoids silent final-snapshot loss and makes shutdown behavior deterministic.
- Fixed-window rate-limit buckets are simpler and more stable under load than filtering timestamp arrays per request.
- Rehydration should treat lifetime maxima as authoritative values and only recompute rolling-derived metrics from sample windows.
- Keeping only `.test.ts` files removed stale duplicate behavior definitions and made test intent clearer.
- Extracting HTTP/rate-limit helpers from the dashboard server reduced monolith risk without changing route behavior.
- Extracting wallet detail analytics (`buildWalletDetail`) into its own module keeps dashboard routing code focused and easier to test.
- Extracting the large strategy catalog into its own module reduces DashboardServer size while preserving API behavior.
- Centralizing request JSON body parsing in the shared dashboard HTTP helper avoids duplicated error/size handling logic.
- Extracting the dashboard HTML/JS template into its own module makes server-side routing and API logic much easier to navigate.
- Extracting wallet-related dashboard routes into a dedicated handler module keeps DashboardServer routing focused while preserving endpoint behavior.
- Extracting strategy and copy-trade dashboard routes into a dedicated handler module further reduced DashboardServer monolith surface with no endpoint behavior change.
- Extracting trade endpoints and operational market/whale/console/SSE routes into dedicated modules keeps DashboardServer focused on orchestration and shared middleware concerns.
- Extracting core dashboard routes (HTML/data/counters/kill-switch) into a dedicated handler completed DashboardServer route modularization and left the server class focused on lifecycle, shared state, and delegation.
- Lightweight periodic memory sampling in runtime counters (`process.memoryUsage` + `v8.getHeapStatistics`) gives early warning for sustained heap growth without requiring separate profiling sessions.
- Dedupe/suppression maps that key by dynamic values must include TTL cleanup and max-size caps, otherwise memory grows slowly but unbounded over long live sessions.
- Trade history retention should be enforced during rehydration, not only during append, to prevent snapshot restore from reintroducing oversized in-memory arrays.
- Heavy dashboard endpoints should bound both serialization output and intermediate aggregation structures; limiting only the final response is not enough to prevent peak heap spikes.

## Design Choices
- Added `runtime_wallet_snapshot` table for one-row latest snapshot storage.
- Added `runtime_state` key/value table for small durable flags (kill switch and future runtime metadata).
- Added kill-switch change listeners so persistence happens on every state transition, not only during shutdown.
- Restored kill-switch state before engine start to prevent accidental order flow after an unsafe restart.
- Used conservative hardening that does not change existing API contracts or require frontend auth changes yet.
- Implemented LIVE->PAPER fallback in wallet registration when live trading is disabled to preserve flow safety.
- Chose windowed dedupe (instead of dropping logs entirely) so each window still emits one representative event with a suppressed count.
- Implemented circuit breaker as a local, in-process guard with env-configurable threshold/cooldown to keep behavior tunable without code edits.

## Trade-offs
- Persistence currently stores the latest snapshot rather than a full historical timeline. This is fast and simple, but not enough for time-series analytics yet.
- Snapshot writes are periodic (10 seconds), so an abrupt crash can lose up to one interval of runtime changes.
- Snapshot payload is JSON in SQLite for flexibility; this avoids schema churn but makes ad-hoc SQL analytics harder.
- Current rate limiter is in-memory and per-process; restart resets counters.
- Security headers/rate limits improve baseline exposure but are not a substitute for real auth.
- Type casting for upgraded clob signer API restores build compatibility but should be revisited with stronger SDK-typed adapter.

## Validation Outcomes (this iteration)
- `npm run build`: PASS
- `npm test`: PASS (163 tests)
- Paper-mode runtime smoke checks:
  - `/api/data` returns 200
  - `/api/wallets` returns 200
  - burst test produced mixed `200` and `429` as expected
  - security headers confirmed in API responses
- Added tests for dashboard hardening:
  - API response headers
  - API rate-limit behavior (200 + 429 mix)
- Focused regression check after modularization:
  - `tests/dashboard_server_hardening.test.ts` remains green after helper extraction.
  - `tests/dashboard_server_hardening.test.ts` remains green after wallet-detail module extraction.
  - `tests/dashboard_server_hardening.test.ts` remains green after strategy-catalog module extraction.
  - `tests/dashboard_server_hardening.test.ts` remains green after moving request body parsing into shared HTTP helpers.
  - `tests/dashboard_server_hardening.test.ts` remains green after extracting dashboard template module.
  - `tests/dashboard_server_hardening.test.ts` remains green after extracting wallet route handlers into `dashboard_wallet_routes.ts`.
  - `tests/dashboard_server_hardening.test.ts` remains green after extracting strategy/copy-trade route handlers into `dashboard_strategy_routes.ts`.
  - `tests/dashboard_server_hardening.test.ts` remains green after extracting trade routes and operational routes into dedicated handler modules.
  - `tests/dashboard_server_hardening.test.ts` remains green after extracting core dashboard routes into `dashboard_core_routes.ts`.
- Added tests for persistence and reliability:
  - runtime SQLite snapshot persistence/load/clear
  - kill-switch state persistence/load
  - ingestion auth circuit-breaker behavior
- Added counters + visibility tests:
  - dashboard `/api/system/counters` response
  - dashboard rate-limit hit counter increments
  - order-router risk rejection/suppression counters
  - ingestion auth-circuit open/short-circuit counters
- Added remote-access bind validation:
  - dashboard defaults to `0.0.0.0` when no explicit bind host is configured
- Added UI external-link support:
  - market IDs in dashboard/trade tables now include `Event ↗` and `Trades ↗` links opening a new window/tab.
  - event links now resolve exact slugs more often (cached from `/api/markets`) and safely fall back to search when unknown.
- Added Phase 2 execution observability counters:
  - route attempts/success/failure
  - submit attempts/failures/timeouts
  - route and submit avg/max latency
  - tests for success and timeout-failure paths
- Added execution health dashboard cards:
  - route attempt/failure rate
  - submit timeout count and submit failure rate
  - route and submit average latency
- Expanded execution health latency telemetry:
  - rolling recent average latency for route and submit stages
  - p95/p99 latency percentiles for route and submit stages
  - dashboard cards now show Avg/P95 plus recent averages for faster anomaly detection
- Added execution-stage freshness telemetry:
  - `routeLastAttemptAtMs` / `routeLastLatencyAtMs`
  - `submitLastAttemptAtMs` / `submitLastLatencyAtMs`
  - dashboard execution health now surfaces route/submit `last sample` age cards
- Added restart-safe execution trend continuity:
  - runtime counters now export/import persisted state
  - counters state is saved in runtime DB during periodic snapshots and on shutdown
  - startup now rehydrates counters state before engine execution starts
- Stabilized runtime persistence and throttling internals:
  - startup/shutdown persistence now awaits database writes before process exit
  - periodic snapshot persistence now avoids overlapping save cycles
  - dashboard API limiter now uses bounded-memory fixed-window buckets with periodic stale-IP cleanup

## Runtime Observations
- Risk controls are functioning, but logs are noisy under high signal volume:
  - repeated `Max open trades exceeded`
  - repeated `Max daily loss breached`
  - repeated `Max position size exceeded`
- Next quality improvement should be risk-log dedupe/throttling so operational logs remain actionable.
- After implementing risk-log dedupe, repeated risk rejection spam dropped and now includes `suppressedInWindow` counts.
- Whale ingestion produced frequent CLOB 401/403 responses in paper-mode scanner paths; throttling reduced duplicate error floods and changed 401/403 to warning level.
- After circuit-breaker addition, unauthorized bursts are constrained by cooldown windows, reducing repeated noisy failure loops.

## Next Technical Steps
- Add snapshot history table for PnL time-series and post-run analytics.
- Persist risk-engine rate-limit windows to avoid post-restart burst loopholes.
- Add DB-level startup lock to prevent dual process writers.
- Add authenticated dashboard APIs and endpoint rate limiting before any internet-exposed deployment.
- Add tests for dashboard rate-limit behavior and response security headers.
- Add risk warning dedupe window by wallet + reason to reduce log spam.
- Add ingestion circuit-breaker/backoff behavior for sustained 401/403 responses.
- Add persistence tests covering runtime snapshot restore and kill-switch restore path.
- Add hardening counters surfaced in API/dashboard for operational visibility (suppressed logs, rate-limit hits, breaker open/close events).
- Begin execution-latency instrumentation (signal->submit->fill) and timeout handling.
- Add phase-2 latency counters into the same runtime counters payload to keep observability shape consistent.
