# Polymarket Trading Bot Improvement Plan

Last updated: 2026-04-08
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
- Overall completion: 85%
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
  - Added runtime memory telemetry in `/api/system/counters` (heap used/limit %, RSS/external, in-process peaks, threshold levels, GC pause stats).
  - Added bounded-retention cleanup for long-lived dedupe maps in order routing and whale ingestion to prevent unbounded key growth.
  - Added bounded-retention cleanup for scanner `crossReferencedAddresses` and `walletBalances` caches, including normalized lower-case wallet keys to prevent duplicate-case cache growth.
  - Added LIVE CLOB error sanitization/truncation to avoid retaining/logging oversized nested error objects during repeated order failures.
  - Added bounded `marketTokenCache` retention in LIVE wallet token resolution to prevent unbounded market-id cache growth.
  - Added console-log per-entry payload truncation so in-memory dashboard log ring cannot retain very large structured error objects.
  - Added scanner high-memory guard (`SCANNER_HIGH_MEMORY_UTILIZATION_PCT`) to skip cross-reference/cluster heavy phases for a batch when heap pressure is elevated.
  - Made wallet trade history cap configurable via `WALLET_MAX_TRADE_HISTORY` and enforced cap during runtime rehydration.
  - Added bounded trade endpoint paging (`limit`/`offset`) and switched dashboard trade-log polling to capped fetches to reduce `/api/trades/all` memory spikes.
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
  - Removed `stripe` dependency (was never used; dead supply-chain risk, now purged).
  - Fixed copy-trade strategy critical bugs (see Section 11):
    - Corrected API query parameter from `maker_address` to `proxyWallet` (confirmed from whale_scanner.ts usage).
    - Implemented `min_whale_win_rate` gate in `passesFilters()` (was defined in config but never enforced).
    - Added debug logging when a whale signal is dropped because the market is not in the stream cache.
    - Fixed `onTimer()` not being awaited in the engine tick — async whale trade fetches now complete before signal processing in the same tick.
  - Added `Engine.closeAllPositions(reason)` for emergency position unwinding:
    - Bypasses the risk engine (correct, since kill switch is active for emergency scenarios).
    - Calls `placeOrder()` directly on each wallet for every tracked open position.
    - Wired to `killSwitch.onChange` in cli.ts so kill-switch activation immediately triggers close attempts.
    - Works for both PAPER and LIVE wallets; LIVE creates SELL limit orders on CLOB.
    - Returns `{ attempted, succeeded }` counts; failed orders are logged but do not block other closes.
  - Added `runtime_audit` table (SQLite, append-only):
    - Captures kill_switch_on, kill_switch_off, emergency_close events with actor, details, timestamp.
    - `Database.appendAuditEvent()` and `loadAuditEvents(limit)` methods.
    - `GET /api/audit?limit=N` dashboard endpoint.
  - Added `pnl_snapshots` table (time-series PnL per wallet):
    - Written every 10-second persist interval (same timer as wallet snapshot).
    - Stores wallet_id, balance, realized_pnl, open_positions_count, drawdown_pct, snapshot_at.
    - `GET /api/pnl/history?wallet_id=<id>&limit=N` dashboard endpoint.
    - Enables historical PnL chart/analysis without external tooling.
  - Promoted portfolio-level market exposure check to `OrderRouter.route()`:
    - `WalletManager.getTotalMarketExposure(marketId)` aggregates across all wallets.
    - Checked in OrderRouter on every BUY before submission.
    - Configurable via `MAX_PORTFOLIO_EXPOSURE_PER_MARKET` env var (default $1000).
    - Rejection is dedupe-throttled and counted in risk rejection counters.
  - Added `DashboardServer.setDatabase(db)` to pass runtime DB reference for audit/PnL endpoints.
  - Added tests for `TradeExecutor` and `PositionManager` (both were untested black boxes on the execution hot path):
    - `tests/trade_executor.test.ts`: 4 tests covering call shape, error propagation, tokenId forwarding, SELL side.
    - `tests/position_manager.test.ts`: 5 tests covering isolation, overwrite, empty case, multi-wallet.
  - Test count: 174 passing (was 164).

### In progress
- Runtime tuning for scanner/ingestion polling noise under heavy market scans.
- Copy-trade: whale addresses still need to be configured in config.yaml to produce signals.

### Not started
3. Add focused tests for new counters/metrics endpoints.
4. Dashboard token-based auth (jwt/bcryptjs are in deps but not wired — deferred until internal-only dashboard confirmed insufficient).

## 5. Evidence of Work Completed

Changed files relevant to this plan:
- src/storage/database.ts
- src/risk/kill_switch.ts
- src/cli.ts
- src/reporting/dashboard_server.ts
- src/reporting/dashboard_operational_routes.ts
- src/execution/order_router.ts
- src/execution/trade_executor.ts (tested)
- src/execution/position_manager.ts (tested)
- src/core/engine.ts
- src/wallets/wallet_manager.ts
- src/strategies/copy_trading/copy_trade_strategy.ts
- config.yaml
- learnings.md
- package.json (stripe removed)

## 6. Current Blockers and Findings

### Current findings after full validation run
- Build: PASS (`npm run build`)
- Tests: PASS (`npm test`) with 164 tests passing.
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
  - Runtime counters now include memory pressure telemetry with threshold crossings and GC duration stats for OOM early warning.
  - Risk dedupe and ingestion error-dedupe state maps now prune stale keys and enforce max key caps.
  - Scanner cross-reference and wallet-balance caches now enforce max-entry caps, reducing long-session retained-set/map growth risk.
  - Wallet runtime rehydration now trims restored trades to configured in-memory retention cap.
  - `/api/trades/all` now avoids unbounded response construction by maintaining a bounded recent-trade window during aggregation.

### Remaining issues observed in logs
- High-volume repetitive risk warnings when strategies keep proposing orders after limits are reached:
  - `Max open trades exceeded`
  - `Max daily loss breached`
  - `Max position size exceeded`
- This is correct risk behavior but noisy and can obscure actionable events.
- Repetitive CLOB 401/403 ingestion failures can still occur under scanner workloads, but are now window-throttled and emitted at lower severity.
- With auth circuit breaker in place, repeated unauthorized bursts are now bounded by cooldown instead of continuously hammering endpoints.
- LIVE runtime memory pressure incident observed (OOM crash):
  - V8 old-space near heap limit (`~1.79-1.81 GB` after mark-compact)
  - repeated long GC pauses (`~5.8-5.9s`) with low mutator utilization
  - fatal exit: `Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`
  - incident occurred during live order submission flow, indicating memory growth under sustained runtime rather than startup-only burst.

## 7. Next Steps (Immediate)

1. Prioritize memory-stability work before additional feature expansion (see Section 10).
2. Add runtime memory telemetry and alerting (heap used, RSS, external, GC pause, high-water marks) to counters and dashboard.
3. Bound or prune long-lived in-memory collections (logs/caches/trade arrays/maps) with explicit retention limits.
4. Run targeted heap profiling during live-like burn-in and identify top retained objects by growth slope.
5. After memory baseline is stable, resume Phase 2 data quality work.

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

## 10. Memory Stability Plan (NEW)

### 10.1 Incident Summary
- A production-like LIVE run aborted with V8 OOM after sustained operation.
- GC behavior indicates old-space saturation and ineffective compaction, consistent with retained-object growth (leak or unbounded retention).

### 10.2 Primary Risk Areas to Investigate
1. Unbounded in-memory collections (runtime logs, per-wallet trade arrays, map-based caches, suppression trackers).
2. Request/stream payload fan-out paths that materialize large arrays repeatedly (e.g., all-trades payloads and high-frequency SSE broadcast).
3. Long-lived scanner/ingestion caches that may not prune stale keys aggressively.

### 10.3 Implementation Track
1. Add memory observability:
  - periodic snapshots of `process.memoryUsage()` and `v8.getHeapStatistics()` into runtime counters.
  - peak trackers and warning thresholds (70% / 85% / 95% of heap limit).
  - dashboard/system endpoint visibility for live memory trend.
2. Add bounded-retention controls:
  - explicit max-entry caps for in-memory logs/caches/maps.
  - TTL-based cleanup for stale keys in scanner/ingestion state maps.
  - optional trade-history retention window in memory with persisted backing for long history.
3. Reduce high-allocation response paths:
  - add paging/limit parameters for heavy list endpoints (especially all-trades).
  - avoid full-array rebuilds when incremental updates are sufficient.
4. Add operational safeguards:
  - conservative process memory limit configuration and supervised restart policy.
  - pre-OOM diagnostic dump/heap snapshot trigger when threshold is crossed.

### 10.4 Validation Gates
1. 6-hour paper/live-like soak: no monotonic heap growth trend beyond configured envelope.
2. 24-hour soak: no OOM, no repeated multi-second GC pause clusters.
3. Endpoint correctness and dashboard behavior unchanged under retention caps (covered by regression tests).

## 11. Copy-Trade Signal Investigation (NEW — 2026-04-08)

### 11.1 Root Cause Analysis
Copy-trade strategy never fired a signal despite running continuously.  Four bugs found:

| Bug | Severity | Fix |
|---|---|---|
| Wrong API param: `maker_address` instead of `proxyWallet` | Critical | Fixed — confirmed correct from `whale_scanner.ts` line 1760 |
| `onTimer()` not awaited in engine tick | Critical | Fixed — async whale fetch completes before signal processing |
| `min_whale_win_rate` configured but never checked | Medium | Fixed — gate added in `passesFilters()` after 5+ trade history |
| Market not in stream cache causes silent signal drop | Medium | Added debug log for every dropped signal |

### 11.2 Remaining Operational Requirement
**`whale_addresses: []` in config.yaml** — copy-trade will not poll any whale without at least one valid Ethereum address configured.  The address must be a Polymarket **proxy wallet** address (not EOA).  These can be found by:
1. Going to a market on Polymarket and clicking a large position.
2. Copying the wallet address from the profile URL.
3. Validating it is a 40-char hex address (0x...).
4. Adding it to `strategy_config.copy_trade.whale_addresses` in config.yaml.

### 11.3 Known Limitation
The market stream caches only the markets that the Gamma API returns (trending/active markets up to the cache cap).  A whale trading a niche or newly created market may not be in the stream at poll time.  The debug log now reports these misses so the pattern can be evaluated.  If misses are high, consider: increasing the stream's market poll coverage, or adding a targeted market fetch for the whale's trade market ID.

### 11.4 Validation
- Build: PASS
- Tests: PASS (174) — existing copy-trade test updated to assert correct `proxyWallet` param
