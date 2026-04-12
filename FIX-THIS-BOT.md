# FIX THIS BOT

## Objective

Make live trading truth the source of record so the dashboard reflects real exchange behavior, restarts do not break continuity, exits are actually enforced, and strategy performance is measured by live realized outcomes instead of paper-only wins.

## Current Progress

- [x] Added runtime execution ledger schema and write/read methods in SQLite.
- [x] Wired order routing to persist intent, submit lifecycle events, and fill records.
- [x] Wired runtime DB into order router from bot startup path.
- [x] Added dashboard endpoint to inspect execution ledger records.
- [x] Added tests for execution ledger persistence/query behavior.
- [x] Added startup reconciliation pass with persisted red/yellow/green report.
- [x] Added startup block-on-red gate with kill-switch activation.
- [x] Added system reconciliation API endpoint for dashboard/ops visibility.
- [x] Added emergency close unresolved-position reporting in audit trail.
- [x] Added ledger-vs-runtime drift checks during startup reconciliation.
- [x] Added exchange balance checks during live startup reconciliation.
- [x] Added live reconciliation status to dashboard payload and wallet cards.
- [x] Added position_lifecycle table with entry_open, scale_in, partial_exit, flat, exit_failed events.
- [x] Wired lifecycle writes into OrderRouter on every confirmed fill (BUY → entry_open/scale_in, SELL → partial_exit/flat based on net size).
- [x] Added exit completion retry loop in closeAllPositions (EXIT_COMPLETION_MAX_RETRIES, EXIT_COMPLETION_RETRY_DELAY_MS).
- [x] Exit failures write exit_failed lifecycle rows for every unresolved position.
- [x] Added /api/wallets/:id/lifecycle endpoint exposing timeline, open positions, and unresolved exits.
- [x] Added dashboard Reconciliation panel (click the summary card to expand; shows per-wallet drift details, exchange balance, unresolved exits).
- [x] Added Lifecycle tab in the wallet detail overlay (timeline, open positions, unresolved exits).
- [x] Added strategy_run_id (per-startup UUID) to all order intent records for full strategy attribution.
- [x] Unresolved exits surfaced in /api/system/reconciliation and dashboard reconciliation panel.
- [x] Added idempotency columns and unique constraints for submission dedupe_key and order_events exchange_event_id.
- [x] Made submission/event writes idempotent with INSERT OR IGNORE at the ledger layer.
- [x] Added persisted per-wallet sync cursor runtime state and wired startup reconciliation to save/load it.
- [x] Added walletSyncCursors visibility to /api/system/reconciliation.
- [x] Added persisted unresolved work queue runtime state (pending/resolved + attempts).
- [x] Added startup unresolved queue drain before engine start, with audit trail and optional block-on-pending gate.
- [x] Exposed unresolvedWorkQueue in /api/system/reconciliation.
- [x] Added unresolved order queue runtime state (pending/resolved + attempts + order IDs when available).
- [x] Startup now enqueues orphan/open-order mismatches into unresolved order queue from reconciliation.
- [x] Startup unresolved drain now re-runs reconciliation and accounts unresolved order queue resolution before live start.
- [x] Exposed unresolvedOrderWorkQueue in /api/system/reconciliation.
- [x] Standardized strategy exit orders onto canonical exit_reason values in the shared OrderRequest path.
- [x] Lifecycle SELL/exit rows now persist exit policy branch notes and correlate to the active entry intent.
- [x] Added wallet-detail Execution tab that reconstructs intent → submit/event → fill → lifecycle close chain from /api/execution/ledger + /api/wallets/:id/lifecycle.
- [x] Execution tab now classifies intent state (pending/partial/filled/rejected/canceled/timeout/closed) and surfaces weighted slippage + execution edge versus intended price.

## Non-Negotiable Rules

- [ ] Live wallet PnL must come from exchange-confirmed fills, not internal assumptions.
- [ ] No live position is considered open or closed without reconciliation against exchange state.
- [ ] No exit is considered complete until position-flat confirmation succeeds.
- [ ] No restart may resume trading if reconciliation status is red.
- [ ] Strategy health decisions for live mode must use live execution metrics.

## Phase 1 - Canonical Live Execution Ledger

### 1.1 Add canonical execution tables in SQLite

- [x] Add order_intents table (strategy signal intent).
- [x] Add order_submissions table (payload sent to exchange).
- [x] Add order_events table (accepted, rejected, canceled, timeout, error).
- [x] Add fill_events table (partial fills and full fills).
- [x] Add position_lifecycle table (entry_open, scale_in, partial_exit, flat, exit_failed).

### 1.2 Add stable identifiers and lineage

- [x] Generate deterministic client_order_id for every order intent.
- [x] Persist strategy_run_id and wallet_id with every row.
- [ ] Persist market_id, side, outcome, size, price, and timestamps at every stage.
- [x] Persist exchange_order_id mapping when available.

### 1.3 Wire intent -> submit -> exchange event -> fill

- [x] Record intent before submit attempt.
- [x] Record submit attempt and request payload metadata.
- [x] Record exchange ack/reject with reason codes.
- [x] Record every fill event and cumulative filled quantity.

### 1.4 Acceptance criteria

- [ ] Every dashboard trade row can be traced to a full ledger chain.
- [ ] No row is marked filled without at least one persisted fill event.
- [ ] Replayed process startup does not duplicate ledger entries.

## Phase 2 - Startup Reconciliation and Drift Control

### 2.1 Build startup reconciliation flow

- [x] On startup, fetch exchange open orders for each live wallet.
- [x] On startup, fetch recent fills for each live wallet.
- [x] On startup, fetch live balances for each live wallet.
- [x] Compare exchange state to local ledger and wallet state.

### 2.2 Reconciliation outcomes

- [x] Green: all key counts and quantities match within tolerance.
- [x] Yellow: delayed or partial data, continue sync-only mode.
- [x] Red: material mismatch, activate kill switch and block new entries.

### 2.3 Persist reconciliation state

- [ ] Store last successful reconcile timestamp.
- [ ] Store mismatch summary and affected wallets.
- [ ] Store unresolved entities (orphan order, orphan fill, orphan position).

### 2.4 Acceptance criteria

- [ ] Restart never resumes live entries without a completed reconciliation pass.
- [ ] Mismatches are visible in dashboard and audit log immediately.
- [ ] Unknown exchange positions are surfaced and tagged for action.

## Phase 3 - Exit Reliability and Position-Flat Guarantees

### 3.1 Standardize exit intents

- [x] Support explicit exit_reason values: take_profit, stop_loss, max_hold, stale_market, kill_switch, drawdown_breaker, manual.
- [x] Persist exit intent with correlation to original entry intent.

### 3.2 Enforce exit completion loop

- [x] Submit exit order and track its exchange lifecycle.
- [ ] If partially filled, resubmit or amend based on policy.
- [x] If timeout/cancel, retry with capped attempt policy.
- [x] Confirm flat position before marking exit complete.

### 3.3 Emergency path hardening

- [x] Keep emergency close path but require final flat confirmation.
- [x] Record attempted, succeeded, failed, and unresolved counts.
- [x] Log unresolved position IDs for immediate operator review.

### 3.4 Acceptance criteria

- [x] Exit completion requires exchange-confirmed flat state.
- [x] Every unresolved exit is visible in dashboard with action state.
- [ ] Kill switch creates a complete audit chain from trigger to final flat check.

## Phase 4 - Dashboard as Live Execution Console

### 4.1 Add live order and fill views

- [x] Show pending, partial, filled, rejected, canceled, timeout states.
- [x] Show order timeline with timestamps for intent, submit, ack, fill, close.
- [x] Show cumulative slippage versus intended entry and exit.

### 4.2 Add reconciliation panel

- [x] Show current reconciliation status (green, yellow, red).
- [x] Show per-wallet drift summary and unresolved entities.
- [x] Show last successful exchange sync timestamp.

### 4.3 Add strategy attribution for live trades

- [x] Every fill row shows strategy name and strategy_run_id.
- [x] Every close row shows triggering exit rule and policy branch.
- [x] Add quick links from dashboard position to full ledger chain.

### 4.4 Acceptance criteria

- [ ] Operator can trace any live fill to strategy signal and exchange records.
- [ ] Dashboard never labels simulated outcomes as live realized PnL.
- [ ] Reconciliation warnings are prominent and cannot be ignored.

## Phase 5 - Restart Safety and Idempotency

### 5.1 Idempotent event ingestion

- [x] Add unique constraints for exchange event IDs and fill IDs.
- [x] Add dedupe keys for submit retries to prevent duplicate ledger writes.
- [x] Make startup replay safe and repeatable.

### 5.2 Resume checkpoints

- [x] Persist per-wallet resume token for exchange sync cursor.
- [x] Persist unresolved order and position work queue across restarts.
- [x] Resume from checkpoint before allowing new strategy entries.

### 5.3 Acceptance criteria

- [x] Repeated restarts do not duplicate fills or distort realized PnL.
- [x] Open orders and open positions survive restart with correct status.
- [x] Unresolved queue is preserved and drained deterministically.

## Phase 6 - Live Profitability Governance

### 6.1 Add live-only strategy health metrics

- [ ] Track fill_ratio, reject_ratio, cancel_ratio, timeout_ratio.
- [ ] Track realized edge versus intended edge.
- [ ] Track realized slippage and time-to-fill distribution.
- [ ] Track drawdown contribution and capital efficiency per strategy.

### 6.2 Add automatic live strategy guardrails

- [ ] Auto-pause strategy if live edge degrades beyond threshold.
- [ ] Auto-pause strategy if reject/timeout rates exceed threshold.
- [ ] Auto-pause strategy if reconciliation health remains yellow/red.

### 6.3 Acceptance criteria

- [ ] A strategy can be profitable in paper and still be auto-paused in live if execution quality is poor.
- [ ] Live strategy status changes are fully auditable and reversible.
- [ ] Dashboard shows why a strategy is active, paused, or blocked.

## Immediate Priority Backlog (Do First)

- [x] Implement canonical execution ledger schema and writes.
- [x] Implement startup reconciliation gate before live entries.
- [x] Implement exit completion loop with position-flat confirmation.
- [x] Implement dashboard reconciliation and order lifecycle panels.
- [x] Add idempotency constraints and replay-safe startup sync.

## Definition of Done

- [ ] For any live trade, you can trace signal -> submit -> exchange ack/reject -> fill(s) -> exit -> realized PnL in one chain.
- [ ] After restart, dashboard and exchange state remain aligned without manual correction.
- [ ] Kill switch and auto-exit paths result in verified flat states or explicit unresolved alerts.
- [ ] Live strategy decisions are governed by real execution outcomes, not paper performance.
