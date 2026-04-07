import { describe, expect, it } from 'vitest';
import {
  exportRuntimeCountersState,
  getRuntimeCountersSnapshot,
  importRuntimeCountersState,
  recordDashboardApiRateLimited,
  recordDashboardApiRequest,
  recordExecutionRouteAttempt,
  recordExecutionRouteFailure,
  recordExecutionRouteLatency,
  recordExecutionSubmitAttempt,
  recordExecutionSubmitFailure,
  recordExecutionSubmitLatency,
  resetRuntimeCounters,
} from '../src/reporting/runtime_counters';

describe('Runtime counters persistence state', () => {
  it('exports and restores execution trend metrics', () => {
    resetRuntimeCounters();

    recordDashboardApiRequest();
    recordDashboardApiRateLimited();

    recordExecutionRouteAttempt();
    recordExecutionRouteFailure();
    recordExecutionRouteLatency(10);
    recordExecutionRouteLatency(50);
    recordExecutionRouteLatency(100);

    recordExecutionSubmitAttempt();
    recordExecutionSubmitFailure(true);
    recordExecutionSubmitLatency(20);
    recordExecutionSubmitLatency(80);

    const exported = exportRuntimeCountersState();
    const beforeReset = getRuntimeCountersSnapshot();

    resetRuntimeCounters();
    const restored = importRuntimeCountersState(exported);
    expect(restored).toBe(true);

    const afterRestore = getRuntimeCountersSnapshot();
    expect(afterRestore.dashboard.apiRequests).toBe(beforeReset.dashboard.apiRequests);
    expect(afterRestore.dashboard.apiRateLimited).toBe(beforeReset.dashboard.apiRateLimited);
    expect(afterRestore.execution.routeAttempts).toBe(beforeReset.execution.routeAttempts);
    expect(afterRestore.execution.routeFailures).toBe(beforeReset.execution.routeFailures);
    expect(afterRestore.execution.routeLastAttemptAtMs).toBeGreaterThan(0);
    expect(afterRestore.execution.routeLastLatencyAtMs).toBeGreaterThan(0);
    expect(afterRestore.execution.submitAttempts).toBe(beforeReset.execution.submitAttempts);
    expect(afterRestore.execution.submitTimeouts).toBe(beforeReset.execution.submitTimeouts);
    expect(afterRestore.execution.submitLastAttemptAtMs).toBeGreaterThan(0);
    expect(afterRestore.execution.submitLastLatencyAtMs).toBeGreaterThan(0);
    expect(afterRestore.execution.routeLatencyAvgMs).toBeCloseTo(beforeReset.execution.routeLatencyAvgMs, 6);
    expect(afterRestore.execution.routeLatencyRecentAvgMs).toBeCloseTo(beforeReset.execution.routeLatencyRecentAvgMs, 6);
    expect(afterRestore.execution.routeLatencyP95Ms).toBeCloseTo(beforeReset.execution.routeLatencyP95Ms, 6);
    expect(afterRestore.execution.submitLatencyP95Ms).toBeCloseTo(beforeReset.execution.submitLatencyP95Ms, 6);
  });

  it('rejects invalid persisted payloads', () => {
    resetRuntimeCounters();
    expect(importRuntimeCountersState(null)).toBe(false);
    expect(importRuntimeCountersState({ version: 999 })).toBe(false);
  });

  it('preserves lifetime max latency during rehydration', () => {
    resetRuntimeCounters();

    const restored = importRuntimeCountersState({
      version: 1,
      counters: {
        dashboard: { apiRequests: 0, apiRateLimited: 0 },
        orderRouter: { riskRejections: 0, riskLogSuppressed: 0 },
        whaleIngestion: {
          clob4xxLogSuppressed: 0,
          authCircuitOpened: 0,
          authCircuitShortCircuits: 0,
        },
        execution: {
          routeAttempts: 0,
          routeSuccesses: 0,
          routeFailures: 0,
          routeLastAttemptAtMs: 0,
          routeLastLatencyAtMs: 0,
          routeLatencyAvgMs: 0,
          routeLatencyMaxMs: 250,
          routeLatencyRecentAvgMs: 0,
          routeLatencyP95Ms: 0,
          routeLatencyP99Ms: 0,
          submitAttempts: 0,
          submitFailures: 0,
          submitTimeouts: 0,
          submitLastAttemptAtMs: 0,
          submitLastLatencyAtMs: 0,
          submitLatencyAvgMs: 0,
          submitLatencyMaxMs: 400,
          submitLatencyRecentAvgMs: 0,
          submitLatencyP95Ms: 0,
          submitLatencyP99Ms: 0,
        },
      },
      executionStats: {
        routeLatencyTotalMs: 40,
        routeLatencySamples: 2,
        routeLatencyRolling: [10, 30],
        submitLatencyTotalMs: 70,
        submitLatencySamples: 2,
        submitLatencyRolling: [20, 50],
      },
    });

    expect(restored).toBe(true);
    const snapshot = getRuntimeCountersSnapshot();
    expect(snapshot.execution.routeLatencyMaxMs).toBe(250);
    expect(snapshot.execution.submitLatencyMaxMs).toBe(400);
  });
});
