import { describe, expect, it, vi } from 'vitest';
import { WhaleIngestion } from '../src/whales/whale_ingestion';
import { getRuntimeCountersSnapshot, resetRuntimeCounters } from '../src/reporting/runtime_counters';

function makeStubDb(): unknown {
  return {
    listWhales: () => ({ whales: [] }),
    getTradeByTradeId: () => null,
    insertTrades: () => 0,
    updateWhale: () => undefined,
    getWhaleTrades: () => [],
  };
}

describe('WhaleIngestion auth circuit breaker', () => {
  it('opens circuit after repeated 401 responses and short-circuits subsequent requests', async () => {
    const db = makeStubDb();
    const config = {
      pollIntervalMs: 1_000,
      maxRequestsPerMinute: 10_000,
      metadataCacheTtlMs: 60_000,
    };

    process.env.SCANNER_CLOB_AUTH_FAILURE_THRESHOLD = '3';
    process.env.SCANNER_CLOB_AUTH_COOLDOWN_MS = '60000';

    const ingestion = new WhaleIngestion(
      db as never,
      config as never,
      'https://clob.polymarket.com',
      'https://gamma-api.polymarket.com',
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchMock);

    const url = 'https://clob.polymarket.com/trades?maker_address=0xabc&limit=100';

    await (ingestion as any).fetchWithRetry(url, 0, 1000);
    await (ingestion as any).fetchWithRetry(url, 0, 1000);
    await (ingestion as any).fetchWithRetry(url, 0, 1000);

    const callsAfterThreshold = fetchMock.mock.calls.length;

    // This call should be short-circuited by the open circuit breaker.
    await (ingestion as any).fetchWithRetry(url, 0, 1000);

    expect(fetchMock.mock.calls.length).toBe(callsAfterThreshold);

    const counters = getRuntimeCountersSnapshot();
    expect(counters.whaleIngestion.authCircuitOpened).toBe(1);
    expect(counters.whaleIngestion.authCircuitShortCircuits).toBeGreaterThanOrEqual(1);

    vi.unstubAllGlobals();
    resetRuntimeCounters();
    delete process.env.SCANNER_CLOB_AUTH_FAILURE_THRESHOLD;
    delete process.env.SCANNER_CLOB_AUTH_COOLDOWN_MS;
  });
});
