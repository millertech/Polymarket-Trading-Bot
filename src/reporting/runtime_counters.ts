import v8 from 'v8';
import { PerformanceObserver } from 'perf_hooks';

export type RuntimeCountersSnapshot = {
  dashboard: {
    apiRequests: number;
    apiRateLimited: number;
  };
  orderRouter: {
    riskRejections: number;
    riskLogSuppressed: number;
  };
  whaleIngestion: {
    clob4xxLogSuppressed: number;
    authCircuitOpened: number;
    authCircuitShortCircuits: number;
  };
  execution: {
    routeAttempts: number;
    routeSuccesses: number;
    routeFailures: number;
    routeLastAttemptAtMs: number;
    routeLastLatencyAtMs: number;
    routeLatencyAvgMs: number;
    routeLatencyMaxMs: number;
    routeLatencyRecentAvgMs: number;
    routeLatencyP95Ms: number;
    routeLatencyP99Ms: number;
    submitAttempts: number;
    submitFailures: number;
    submitTimeouts: number;
    submitLastAttemptAtMs: number;
    submitLastLatencyAtMs: number;
    submitLatencyAvgMs: number;
    submitLatencyMaxMs: number;
    submitLatencyRecentAvgMs: number;
    submitLatencyP95Ms: number;
    submitLatencyP99Ms: number;
  };
  runtime?: {
    memory: {
      rssBytes: number;
      heapUsedBytes: number;
      heapTotalBytes: number;
      externalBytes: number;
      arrayBuffersBytes: number;
      heapLimitBytes: number;
      heapUsedPct: number;
      peakHeapUsedBytes: number;
      peakRssBytes: number;
      sampleCount: number;
      lastSampleAtMs: number;
      thresholdLevel: 'ok' | 'warn70' | 'warn85' | 'critical95';
      thresholdCrossings: {
        warn70: number;
        warn85: number;
        critical95: number;
      };
      gc: {
        eventCount: number;
        totalDurationMs: number;
        avgDurationMs: number;
        maxDurationMs: number;
      };
    };
  };
};

export type RuntimeCountersPersistedState = {
  version: 1;
  counters: RuntimeCountersSnapshot;
  executionStats: {
    routeLatencyTotalMs: number;
    routeLatencySamples: number;
    routeLatencyRolling: number[];
    submitLatencyTotalMs: number;
    submitLatencySamples: number;
    submitLatencyRolling: number[];
  };
};

const counters: RuntimeCountersSnapshot = {
  dashboard: {
    apiRequests: 0,
    apiRateLimited: 0,
  },
  orderRouter: {
    riskRejections: 0,
    riskLogSuppressed: 0,
  },
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
    routeLatencyMaxMs: 0,
    routeLatencyRecentAvgMs: 0,
    routeLatencyP95Ms: 0,
    routeLatencyP99Ms: 0,
    submitAttempts: 0,
    submitFailures: 0,
    submitTimeouts: 0,
    submitLastAttemptAtMs: 0,
    submitLastLatencyAtMs: 0,
    submitLatencyAvgMs: 0,
    submitLatencyMaxMs: 0,
    submitLatencyRecentAvgMs: 0,
    submitLatencyP95Ms: 0,
    submitLatencyP99Ms: 0,
  },
};

const executionStats = {
  routeLatencyTotalMs: 0,
  routeLatencySamples: 0,
  routeLatencyRolling: [] as number[],
  submitLatencyTotalMs: 0,
  submitLatencySamples: 0,
  submitLatencyRolling: [] as number[],
};

const runtimeStats = {
  rssBytes: 0,
  heapUsedBytes: 0,
  heapTotalBytes: 0,
  externalBytes: 0,
  arrayBuffersBytes: 0,
  heapLimitBytes: 0,
  heapUsedPct: 0,
  peakHeapUsedBytes: 0,
  peakRssBytes: 0,
  sampleCount: 0,
  lastSampleAtMs: 0,
  thresholdLevel: 'ok' as 'ok' | 'warn70' | 'warn85' | 'critical95',
  thresholdCrossings: {
    warn70: 0,
    warn85: 0,
    critical95: 0,
  },
  gc: {
    eventCount: 0,
    totalDurationMs: 0,
    avgDurationMs: 0,
    maxDurationMs: 0,
  },
};

let gcObserverInitialized = false;
const MEMORY_SAMPLE_INTERVAL_MS = Math.max(1000, Number(process.env.RUNTIME_MEMORY_SAMPLE_MS ?? '10000'));

const EXECUTION_ROLLING_WINDOW_SAMPLES = 200;

function ensureGcObserver(): void {
  if (gcObserverInitialized) return;
  gcObserverInitialized = true;

  try {
    const gcObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const durationMs = Math.max(0, Number(entry.duration) || 0);
        runtimeStats.gc.eventCount += 1;
        runtimeStats.gc.totalDurationMs += durationMs;
        runtimeStats.gc.maxDurationMs = Math.max(runtimeStats.gc.maxDurationMs, durationMs);
      }
      runtimeStats.gc.avgDurationMs = runtimeStats.gc.eventCount > 0
        ? runtimeStats.gc.totalDurationMs / runtimeStats.gc.eventCount
        : 0;
    });
    gcObserver.observe({ entryTypes: ['gc'] });
  } catch {
    // Some runtimes may not support GC performance entries.
  }
}

function getThresholdLevel(heapUsedPct: number): 'ok' | 'warn70' | 'warn85' | 'critical95' {
  if (heapUsedPct >= 95) return 'critical95';
  if (heapUsedPct >= 85) return 'warn85';
  if (heapUsedPct >= 70) return 'warn70';
  return 'ok';
}

function sampleRuntimeMemory(): void {
  ensureGcObserver();

  const usage = process.memoryUsage();
  const heap = v8.getHeapStatistics();
  const heapLimitBytes = Math.max(0, Number(heap.heap_size_limit) || 0);
  const heapUsedBytes = Math.max(0, Number(usage.heapUsed) || 0);
  const heapUsedPct = heapLimitBytes > 0 ? (heapUsedBytes / heapLimitBytes) * 100 : 0;

  runtimeStats.rssBytes = Math.max(0, Number(usage.rss) || 0);
  runtimeStats.heapUsedBytes = heapUsedBytes;
  runtimeStats.heapTotalBytes = Math.max(0, Number(usage.heapTotal) || 0);
  runtimeStats.externalBytes = Math.max(0, Number(usage.external) || 0);
  runtimeStats.arrayBuffersBytes = Math.max(0, Number(usage.arrayBuffers) || 0);
  runtimeStats.heapLimitBytes = heapLimitBytes;
  runtimeStats.heapUsedPct = heapUsedPct;
  runtimeStats.peakHeapUsedBytes = Math.max(runtimeStats.peakHeapUsedBytes, runtimeStats.heapUsedBytes);
  runtimeStats.peakRssBytes = Math.max(runtimeStats.peakRssBytes, runtimeStats.rssBytes);
  runtimeStats.sampleCount += 1;
  runtimeStats.lastSampleAtMs = Date.now();

  const nextLevel = getThresholdLevel(heapUsedPct);
  if (nextLevel !== runtimeStats.thresholdLevel) {
    if (nextLevel === 'warn70') runtimeStats.thresholdCrossings.warn70 += 1;
    if (nextLevel === 'warn85') runtimeStats.thresholdCrossings.warn85 += 1;
    if (nextLevel === 'critical95') runtimeStats.thresholdCrossings.critical95 += 1;
  }
  runtimeStats.thresholdLevel = nextLevel;
}

ensureGcObserver();
sampleRuntimeMemory();
const memorySampler = setInterval(() => {
  sampleRuntimeMemory();
}, MEMORY_SAMPLE_INTERVAL_MS);
memorySampler.unref();

function clampMetric(value: unknown): number {
  return Math.max(0, Number(value) || 0);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.max(0, Math.min(sorted.length - 1, rank));
  return sorted[index] ?? 0;
}

function pushRollingSample(samples: number[], value: number): void {
  samples.push(value);
  if (samples.length > EXECUTION_ROLLING_WINDOW_SAMPLES) {
    samples.shift();
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, current) => sum + current, 0);
  return total / values.length;
}

function sanitizeRollingSamples(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => clampMetric(v))
    .filter((v) => Number.isFinite(v))
    .slice(-EXECUTION_ROLLING_WINDOW_SAMPLES);
}

function recomputeExecutionDerivedMetrics(): void {
  const routeRollingMax = executionStats.routeLatencyRolling.length > 0
    ? Math.max(...executionStats.routeLatencyRolling)
    : 0;
  counters.execution.routeLatencyAvgMs = executionStats.routeLatencySamples > 0
    ? executionStats.routeLatencyTotalMs / executionStats.routeLatencySamples
    : 0;
  counters.execution.routeLatencyMaxMs = Math.max(counters.execution.routeLatencyMaxMs, routeRollingMax);
  counters.execution.routeLatencyRecentAvgMs = average(executionStats.routeLatencyRolling);
  counters.execution.routeLatencyP95Ms = percentile(executionStats.routeLatencyRolling, 95);
  counters.execution.routeLatencyP99Ms = percentile(executionStats.routeLatencyRolling, 99);

  const submitRollingMax = executionStats.submitLatencyRolling.length > 0
    ? Math.max(...executionStats.submitLatencyRolling)
    : 0;
  counters.execution.submitLatencyAvgMs = executionStats.submitLatencySamples > 0
    ? executionStats.submitLatencyTotalMs / executionStats.submitLatencySamples
    : 0;
  counters.execution.submitLatencyMaxMs = Math.max(counters.execution.submitLatencyMaxMs, submitRollingMax);
  counters.execution.submitLatencyRecentAvgMs = average(executionStats.submitLatencyRolling);
  counters.execution.submitLatencyP95Ms = percentile(executionStats.submitLatencyRolling, 95);
  counters.execution.submitLatencyP99Ms = percentile(executionStats.submitLatencyRolling, 99);
}

export function recordDashboardApiRequest(): void {
  counters.dashboard.apiRequests += 1;
}

export function recordDashboardApiRateLimited(): void {
  counters.dashboard.apiRateLimited += 1;
}

export function recordOrderRouterRiskRejection(): void {
  counters.orderRouter.riskRejections += 1;
}

export function recordOrderRouterRiskSuppressed(): void {
  counters.orderRouter.riskLogSuppressed += 1;
}

export function recordWhaleIngestionClob4xxSuppressed(): void {
  counters.whaleIngestion.clob4xxLogSuppressed += 1;
}

export function recordWhaleIngestionAuthCircuitOpened(): void {
  counters.whaleIngestion.authCircuitOpened += 1;
}

export function recordWhaleIngestionAuthCircuitShortCircuit(): void {
  counters.whaleIngestion.authCircuitShortCircuits += 1;
}

export function recordExecutionRouteAttempt(): void {
  counters.execution.routeAttempts += 1;
  counters.execution.routeLastAttemptAtMs = Date.now();
}

export function recordExecutionRouteSuccess(): void {
  counters.execution.routeSuccesses += 1;
}

export function recordExecutionRouteFailure(): void {
  counters.execution.routeFailures += 1;
}

export function recordExecutionRouteLatency(durationMs: number): void {
  const normalized = Math.max(0, Number(durationMs) || 0);
  counters.execution.routeLastLatencyAtMs = Date.now();
  executionStats.routeLatencyTotalMs += normalized;
  executionStats.routeLatencySamples += 1;
  pushRollingSample(executionStats.routeLatencyRolling, normalized);
  counters.execution.routeLatencyAvgMs = executionStats.routeLatencyTotalMs / executionStats.routeLatencySamples;
  counters.execution.routeLatencyMaxMs = Math.max(counters.execution.routeLatencyMaxMs, normalized);
  counters.execution.routeLatencyRecentAvgMs = average(executionStats.routeLatencyRolling);
  counters.execution.routeLatencyP95Ms = percentile(executionStats.routeLatencyRolling, 95);
  counters.execution.routeLatencyP99Ms = percentile(executionStats.routeLatencyRolling, 99);
}

export function recordExecutionSubmitAttempt(): void {
  counters.execution.submitAttempts += 1;
  counters.execution.submitLastAttemptAtMs = Date.now();
}

export function recordExecutionSubmitFailure(isTimeout: boolean): void {
  counters.execution.submitFailures += 1;
  if (isTimeout) counters.execution.submitTimeouts += 1;
}

export function recordExecutionSubmitLatency(durationMs: number): void {
  const normalized = Math.max(0, Number(durationMs) || 0);
  counters.execution.submitLastLatencyAtMs = Date.now();
  executionStats.submitLatencyTotalMs += normalized;
  executionStats.submitLatencySamples += 1;
  pushRollingSample(executionStats.submitLatencyRolling, normalized);
  counters.execution.submitLatencyAvgMs = executionStats.submitLatencyTotalMs / executionStats.submitLatencySamples;
  counters.execution.submitLatencyMaxMs = Math.max(counters.execution.submitLatencyMaxMs, normalized);
  counters.execution.submitLatencyRecentAvgMs = average(executionStats.submitLatencyRolling);
  counters.execution.submitLatencyP95Ms = percentile(executionStats.submitLatencyRolling, 95);
  counters.execution.submitLatencyP99Ms = percentile(executionStats.submitLatencyRolling, 99);
}

export function getRuntimeCountersSnapshot(): RuntimeCountersSnapshot {
  sampleRuntimeMemory();

  return {
    dashboard: { ...counters.dashboard },
    orderRouter: { ...counters.orderRouter },
    whaleIngestion: { ...counters.whaleIngestion },
    execution: { ...counters.execution },
    runtime: {
      memory: {
        rssBytes: runtimeStats.rssBytes,
        heapUsedBytes: runtimeStats.heapUsedBytes,
        heapTotalBytes: runtimeStats.heapTotalBytes,
        externalBytes: runtimeStats.externalBytes,
        arrayBuffersBytes: runtimeStats.arrayBuffersBytes,
        heapLimitBytes: runtimeStats.heapLimitBytes,
        heapUsedPct: runtimeStats.heapUsedPct,
        peakHeapUsedBytes: runtimeStats.peakHeapUsedBytes,
        peakRssBytes: runtimeStats.peakRssBytes,
        sampleCount: runtimeStats.sampleCount,
        lastSampleAtMs: runtimeStats.lastSampleAtMs,
        thresholdLevel: runtimeStats.thresholdLevel,
        thresholdCrossings: {
          warn70: runtimeStats.thresholdCrossings.warn70,
          warn85: runtimeStats.thresholdCrossings.warn85,
          critical95: runtimeStats.thresholdCrossings.critical95,
        },
        gc: {
          eventCount: runtimeStats.gc.eventCount,
          totalDurationMs: runtimeStats.gc.totalDurationMs,
          avgDurationMs: runtimeStats.gc.avgDurationMs,
          maxDurationMs: runtimeStats.gc.maxDurationMs,
        },
      },
    },
  };
}

export function exportRuntimeCountersState(): RuntimeCountersPersistedState {
  return {
    version: 1,
    counters: getRuntimeCountersSnapshot(),
    executionStats: {
      routeLatencyTotalMs: executionStats.routeLatencyTotalMs,
      routeLatencySamples: executionStats.routeLatencySamples,
      routeLatencyRolling: executionStats.routeLatencyRolling.slice(),
      submitLatencyTotalMs: executionStats.submitLatencyTotalMs,
      submitLatencySamples: executionStats.submitLatencySamples,
      submitLatencyRolling: executionStats.submitLatencyRolling.slice(),
    },
  };
}

export function importRuntimeCountersState(state: unknown): boolean {
  if (!state || typeof state !== 'object') return false;
  const persisted = state as Partial<RuntimeCountersPersistedState>;
  if (persisted.version !== 1 || !persisted.counters || !persisted.executionStats) return false;

  const persistedCounters = persisted.counters;
  const persistedStats = persisted.executionStats;

  counters.dashboard.apiRequests = clampMetric(persistedCounters.dashboard?.apiRequests);
  counters.dashboard.apiRateLimited = clampMetric(persistedCounters.dashboard?.apiRateLimited);
  counters.orderRouter.riskRejections = clampMetric(persistedCounters.orderRouter?.riskRejections);
  counters.orderRouter.riskLogSuppressed = clampMetric(persistedCounters.orderRouter?.riskLogSuppressed);
  counters.whaleIngestion.clob4xxLogSuppressed = clampMetric(persistedCounters.whaleIngestion?.clob4xxLogSuppressed);
  counters.whaleIngestion.authCircuitOpened = clampMetric(persistedCounters.whaleIngestion?.authCircuitOpened);
  counters.whaleIngestion.authCircuitShortCircuits = clampMetric(persistedCounters.whaleIngestion?.authCircuitShortCircuits);

  counters.execution.routeAttempts = clampMetric(persistedCounters.execution?.routeAttempts);
  counters.execution.routeSuccesses = clampMetric(persistedCounters.execution?.routeSuccesses);
  counters.execution.routeFailures = clampMetric(persistedCounters.execution?.routeFailures);
  counters.execution.routeLastAttemptAtMs = clampMetric(persistedCounters.execution?.routeLastAttemptAtMs);
  counters.execution.routeLastLatencyAtMs = clampMetric(persistedCounters.execution?.routeLastLatencyAtMs);
  counters.execution.routeLatencyMaxMs = clampMetric(persistedCounters.execution?.routeLatencyMaxMs);
  counters.execution.submitAttempts = clampMetric(persistedCounters.execution?.submitAttempts);
  counters.execution.submitFailures = clampMetric(persistedCounters.execution?.submitFailures);
  counters.execution.submitTimeouts = clampMetric(persistedCounters.execution?.submitTimeouts);
  counters.execution.submitLastAttemptAtMs = clampMetric(persistedCounters.execution?.submitLastAttemptAtMs);
  counters.execution.submitLastLatencyAtMs = clampMetric(persistedCounters.execution?.submitLastLatencyAtMs);
  counters.execution.submitLatencyMaxMs = clampMetric(persistedCounters.execution?.submitLatencyMaxMs);

  executionStats.routeLatencyTotalMs = clampMetric(persistedStats.routeLatencyTotalMs);
  executionStats.routeLatencySamples = clampMetric(persistedStats.routeLatencySamples);
  executionStats.routeLatencyRolling = sanitizeRollingSamples(persistedStats.routeLatencyRolling);
  executionStats.submitLatencyTotalMs = clampMetric(persistedStats.submitLatencyTotalMs);
  executionStats.submitLatencySamples = clampMetric(persistedStats.submitLatencySamples);
  executionStats.submitLatencyRolling = sanitizeRollingSamples(persistedStats.submitLatencyRolling);

  recomputeExecutionDerivedMetrics();
  return true;
}

export function resetRuntimeCounters(): void {
  counters.dashboard.apiRequests = 0;
  counters.dashboard.apiRateLimited = 0;
  counters.orderRouter.riskRejections = 0;
  counters.orderRouter.riskLogSuppressed = 0;
  counters.whaleIngestion.clob4xxLogSuppressed = 0;
  counters.whaleIngestion.authCircuitOpened = 0;
  counters.whaleIngestion.authCircuitShortCircuits = 0;
  counters.execution.routeAttempts = 0;
  counters.execution.routeSuccesses = 0;
  counters.execution.routeFailures = 0;
  counters.execution.routeLastAttemptAtMs = 0;
  counters.execution.routeLastLatencyAtMs = 0;
  counters.execution.routeLatencyAvgMs = 0;
  counters.execution.routeLatencyMaxMs = 0;
  counters.execution.routeLatencyRecentAvgMs = 0;
  counters.execution.routeLatencyP95Ms = 0;
  counters.execution.routeLatencyP99Ms = 0;
  counters.execution.submitAttempts = 0;
  counters.execution.submitFailures = 0;
  counters.execution.submitTimeouts = 0;
  counters.execution.submitLastAttemptAtMs = 0;
  counters.execution.submitLastLatencyAtMs = 0;
  counters.execution.submitLatencyAvgMs = 0;
  counters.execution.submitLatencyMaxMs = 0;
  counters.execution.submitLatencyRecentAvgMs = 0;
  counters.execution.submitLatencyP95Ms = 0;
  counters.execution.submitLatencyP99Ms = 0;

  executionStats.routeLatencyTotalMs = 0;
  executionStats.routeLatencySamples = 0;
  executionStats.routeLatencyRolling = [];
  executionStats.submitLatencyTotalMs = 0;
  executionStats.submitLatencySamples = 0;
  executionStats.submitLatencyRolling = [];

  runtimeStats.rssBytes = 0;
  runtimeStats.heapUsedBytes = 0;
  runtimeStats.heapTotalBytes = 0;
  runtimeStats.externalBytes = 0;
  runtimeStats.arrayBuffersBytes = 0;
  runtimeStats.heapLimitBytes = 0;
  runtimeStats.heapUsedPct = 0;
  runtimeStats.peakHeapUsedBytes = 0;
  runtimeStats.peakRssBytes = 0;
  runtimeStats.sampleCount = 0;
  runtimeStats.lastSampleAtMs = 0;
  runtimeStats.thresholdLevel = 'ok';
  runtimeStats.thresholdCrossings.warn70 = 0;
  runtimeStats.thresholdCrossings.warn85 = 0;
  runtimeStats.thresholdCrossings.critical95 = 0;
  runtimeStats.gc.eventCount = 0;
  runtimeStats.gc.totalDurationMs = 0;
  runtimeStats.gc.avgDurationMs = 0;
  runtimeStats.gc.maxDurationMs = 0;

  sampleRuntimeMemory();
}