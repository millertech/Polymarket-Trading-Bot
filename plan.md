# Polymarket Trading Bot Improvement Plan

Last updated: 2026-04-06
Mode for implementation/testing: PAPER trading only (no live credentials)

## 1. Executive Goals

- Improve live-trading readiness by reducing latency and improving execution reliability.
- Improve tracking quality so restarts do not lose key runtime state and trade visibility.
- Strengthen risk controls so safety mechanisms survive process restarts.
- Improve operational security for dashboard and control endpoints.

## 2. What We Found From Codebase Scan

### Architecture
- Event-driven engine with scheduler tick and market stream flow.
- Strategy runners per wallet, with runtime wallet add/remove support.
- Main flow: market data -> strategy signals -> risk checks -> order routing -> wallet execution.

### Strengths identified
- Strong strategy breadth (8 strategies), including mature convergence and copy-trade logic.
- Robust whale subsystem with SQLite persistence and broad analytics tables.
- Dashboard already has broad API surface and SSE feeds.

### Gaps identified
- Core bot runtime persistence was originally incomplete in storage layer.
- Kill-switch state was originally volatile across restarts.
- Dashboard had kill-switch endpoint but needed tighter integration with global risk state persistence.
- No full E2E test path for signal -> execution -> persistent state recovery.

### Security and reliability risks identified
- Dashboard route access controls are not yet hardened for production.
- Restart edge cases could previously reset risk state unexpectedly.
- Build/tooling drift risk exists from dependency upgrades in workspace.

## 3. Implementation Plan (Phased)

### Phase 1: Persistence and Restart Safety
1. Replace in-memory storage behavior with SQLite-backed runtime persistence.
2. Persist wallet runtime snapshots and recover on startup.
3. Persist kill-switch state and restore before engine trading loop.
4. Keep JSON snapshot fallback for backward compatibility.

### Phase 2: Data Quality and Execution Timing
1. Introduce event-driven market updates with resilient reconnect path.
2. Add order timeout tracking and explicit unresolved-order handling.
3. Record signal/submit/fill timestamps for latency analytics.

### Phase 3: Risk Management Hardening
1. Add portfolio-level exposure controls across wallets.
2. Add persistent drawdown high-water mark tracking.
3. Add correlated cluster circuit-breaker behavior for convergence strategy.
4. Add emergency-exit control path with explicit audit trail.

### Phase 4: Security Hardening
1. Add dashboard auth middleware (token-based).
2. Add endpoint rate limiting.
3. Add sensitive action auditing (kill switch, wallet create/delete/update).

### Phase 5: Tracking and Analytics Expansion
1. Add periodic PnL snapshots for time-series analytics.
2. Add richer strategy and market-level performance breakdown endpoints.
3. Add export endpoints for external analysis workflows.

## 4. Current Progress Snapshot

Overall progress estimate: 95%
## Progress
- Overall completion: 68%
- Phase 1 core implementation started and mostly completed:
  - Runtime snapshot save/load integration at startup/shutdown.
  - Kill-switch onChange persistence wiring.
  - Kill-switch restoration on startup before trading loop.
  - Dashboard kill-switch endpoint now activates global kill-switch object.
- Safety default set for paper testing:
- Learnings captured in project notes.
  - Scanner JSON parsing now supports mocked fetch responses used by tests.
  - Wallet manager now safely falls back LIVE->PAPER when live is disabled.
- Basic hardening (no password/auth yet):
  - Added API per-IP rate limiting for `/api/*` routes.
  - Added security response headers for API and dashboard HTML responses.
  - Dashboard bind host now defaults to `0.0.0.0` for remote access (configurable by env var).
  - Added optional CORS origin control via env var.
- Additional flow quality improvements:
- [x] Make ingestion auth breaker thresholds runtime-configurable per instance for deterministic tests.
  - Added duplicate risk-rejection log throttling per wallet+reason in order routing.
  - Added ingestion auth circuit breaker for repeated 401/403 responses with configurable cooldown.
  - Added runtime persistence tests for snapshot and kill-switch state load/save/clear paths.
  - Added shared runtime counters module and `/api/system/counters` endpoint.
  - Added dashboard counters for API request volume and rate-limit hits.
  - Added order-router counters for risk rejections and dedupe suppression volume.
  - Added ingestion counters for log suppression and auth-circuit open/short-circuit events.
  - Added tests covering counters endpoint and new counter increments.
  - Added dashboard UI links for market IDs to open Polymarket Event and market trade feed in a new window.
  - Added client-side market slug cache refresh to improve direct Event link accuracy across non-markets views.
  - Added Phase 2 execution lifecycle counters (route/submit attempts, success/failure, timeout counts, avg/max latency).
  - Added router tests for execution latency success path and submit-timeout failure path.
  - Added dashboard Execution Health summary cards backed by `/api/system/counters`.
  - Extended counters payload test assertions to include execution metrics shape.
  - Added rolling execution latency trend stats (recent avg, p95, p99) for route and submit paths.
  - Updated Execution Health UI cards to display Avg/P95 and rolling recent averages.
  - Persisted runtime execution counters (including rolling latency samples) into runtime DB for restart-safe trend continuity.
  - Added startup rehydration of persisted runtime counters before engine execution begins.
  - Added runtime counters export/import unit tests and database persistence tests for counters state.
  - Added execution-stage timestamp continuity (last route/submit attempt and latency sample timestamps) to runtime counters.
  - Added execution-health UI visibility for staleness (`last sample` age cards).
  - Added UI percentile trend deltas for execution p95 latency to flag per-refresh regressions quickly.
  - Shutdown persistence path now awaits runtime snapshot and counter writes before DB close/process exit.
  - Dashboard API rate limiting now uses bounded-memory fixed-window buckets with stale-IP cleanup.
  - Runtime counter rehydration now preserves lifetime max latency semantics independently from rolling-window stats.
  - Removed duplicate legacy `.js` tests to reduce maintenance drift and keep test surface single-sourced in `.test.ts`.

### In progress
- Runtime tuning for scanner/ingestion polling noise under heavy market scans.

### Not started
3. Add focused tests for new counters/metrics endpoints.
4. Begin Phase 2 data quality work: order/fill latency timestamps and timeout tracker for execution flow.

## 5. Evidence of Work Completed

Changed files relevant to this plan:
- src/storage/database.ts
- src/risk/kill_switch.ts
- src/cli.ts
- src/reporting/dashboard_server.ts
- config.yaml
- learnings.md

## 6. Current Blockers and Findings

### Current findings after full validation run
- Build: PASS (`npm run build`)
- Tests: PASS (`npm test`) with 163 tests passing.
- Runtime paper-mode flow: PASS for engine/dashboard data flow.
- Hardening behavior validated:
  - `/api/data` and `/api/wallets` return 200 in paper mode.
  - Rate limiter triggered as expected under load (200 + 429 mix).
  - Security headers present (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Resource-Policy`).
  - Dashboard now binds `0.0.0.0` by default for remote access (overridable via `DASHBOARD_BIND_HOST`).
  - UI now supports direct external market navigation from positions/trades/markets views via new-window links.
  - Event links now prefer resolved market slugs from cache, with search fallback when slug is unavailable.
  - Runtime counters now include execution timing and error classification for Phase 2 observability.
  - Execution Health UI now surfaces key route/submit rates and latency stats directly in Dashboard.
  - Execution counters now expose rolling-window latency trends (recent average and p95/p99 percentiles).
  - Runtime counters now survive process restart via DB persistence and startup rehydration.
  - Runtime counters now include restart-safe execution stage timestamps for route/submit activity freshness.
  - Dashboard server helper seams now extracted into a dedicated module for HTTP headers/JSON responses and fixed-window IP rate limiting (`dashboard_http.ts`).
  - Wallet detail analytics builder extracted into dedicated reporting module (`dashboard_wallet_detail.ts`) to reduce DashboardServer surface area.
  - Strategy catalog definitions extracted into `dashboard_strategy_catalog.ts` to keep dashboard routing/service code focused.
  - Request JSON body parsing moved into `dashboard_http.ts` to consolidate dashboard HTTP utility behavior.
  - Dashboard HTML/JS payload extracted into `dashboard_template.ts` to separate UI payload from server routing code.

### Remaining issues observed in logs
- High-volume repetitive risk warnings when strategies keep proposing orders after limits are reached:
  - `Max open trades exceeded`
  - `Max daily loss breached`
  - `Max position size exceeded`
- This is correct risk behavior but noisy and can obscure actionable events.
- Repetitive CLOB 401/403 ingestion failures can still occur under scanner workloads, but are now window-throttled and emitted at lower severity.
- With auth circuit breaker in place, repeated unauthorized bursts are now bounded by cooldown instead of continuously hammering endpoints.

## 7. Next Steps (Immediate)

1. Begin Phase 2 data quality work: order/fill latency timestamps and timeout tracker for execution flow.
2. Add explicit signal->route->submit->fill timestamps to persisted trade/execution records for per-order latency reconstruction.
3. Extend dashboard execution health with persisted multi-window percentile baselines (beyond single-refresh deltas).
4. Add focused tests for graceful startup/shutdown rehydration behavior through CLI integration path.

## 8. PAPER Mode Test Protocol

- Keep `environment.enable_live_trading: false`.
- Keep all wallets in PAPER mode during verification.
- Do not set `ENABLE_LIVE_TRADING=true`.
- Validate:
  - snapshot persistence across restarts,
  - kill-switch persistence across restarts,
  - no live credential path invoked.

## 9. Stability Cleanup Backlog

1. [x] Make startup/shutdown runtime persistence fully awaited with explicit success/failure handling.
2. [x] Replace per-request timestamp-array rate limiting with bounded-memory fixed-window buckets.
3. [x] Preserve lifetime max latency semantics independently from rolling-window recomputation during counters rehydration.
4. [x] Split dashboard server into smaller modules (routing/middleware/api/template/client script) to reduce monolith risk.
  - Progress: extracted HTTP/rate-limiter/body-parser primitives into `src/reporting/dashboard_http.ts`, wallet detail analytics into `src/reporting/dashboard_wallet_detail.ts`, strategy catalog into `src/reporting/dashboard_strategy_catalog.ts`, HTML/JS payload into `src/reporting/dashboard_template.ts`, and completed route delegation via `src/reporting/dashboard_core_routes.ts`, `src/reporting/dashboard_wallet_routes.ts`, `src/reporting/dashboard_strategy_routes.ts`, `src/reporting/dashboard_trade_routes.ts`, and `src/reporting/dashboard_operational_routes.ts`.
5. [x] Remove or migrate duplicate `.js` tests now that Vitest only includes `.test.ts` files.
