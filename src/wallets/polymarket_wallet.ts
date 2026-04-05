import { WalletConfig, WalletState, Position, TradeRecord, RiskLimits } from '../types';
import { logger } from '../reporting/logs';
import { consoleLog } from '../reporting/console_log';
import { Wallet } from 'ethers';
import { ClobClient, OrderType, Side } from '@polymarket/clob-client';

type LivePreflightResult = {
  ok: boolean;
  reason?: string;
  details?: Record<string, unknown>;
};

type PolyApiCreds = {
  key: string;
  secret: string;
  passphrase: string;
};

export class PolymarketWallet {
  private static readonly MAX_TRADE_HISTORY = 10_000;
  private static hasLoggedL2Credentials = false;
  private state: WalletState;
  private readonly trades: TradeRecord[] = [];
  private readonly clobApi: string;
  private readonly gammaApi: string;
  private readonly chainId: number;
  private readonly logDerivedL2Creds: boolean;
  private displayName: string = '';
  private liveDisabledReason: string | null = null;
  private clobClient: ClobClient | null = null;
  private readonly marketTokenCache = new Map<string, string[]>();

  private static isTruthyEnv(value?: string): boolean {
    if (!value) return false;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  constructor(config: WalletConfig, assignedStrategy: string) {
    this.displayName = config.id;
    this.clobApi = process.env.POLYMARKET_CLOB_API ?? 'https://clob.polymarket.com';
    this.gammaApi = process.env.POLYMARKET_GAMMA_API ?? 'https://gamma-api.polymarket.com';
    this.chainId = Number(process.env.POLYMARKET_CHAIN_ID ?? '137');
    this.logDerivedL2Creds = PolymarketWallet.isTruthyEnv(process.env.POLYMARKET_LOG_DERIVED_L2);
    this.state = {
      walletId: config.id,
      mode: 'LIVE',
      assignedStrategy,
      capitalAllocated: config.capital,
      availableBalance: config.capital,
      openPositions: [],
      realizedPnl: 0,
      riskLimits: {
        maxPositionSize: config.riskLimits?.maxPositionSize ?? 100,
        maxExposurePerMarket: config.riskLimits?.maxExposurePerMarket ?? 200,
        maxDailyLoss: config.riskLimits?.maxDailyLoss ?? 100,
        maxOpenTrades: config.riskLimits?.maxOpenTrades ?? 5,
        maxDrawdown: config.riskLimits?.maxDrawdown ?? 0.2,
      },
    };
  }

  getState(): WalletState {
    return { ...this.state, openPositions: [...this.state.openPositions] };
  }

  getTradeHistory(): TradeRecord[] {
    return [...this.trades];
  }

  updateBalance(delta: number): void {
    this.state.availableBalance += delta;
  }

  getDisplayName(): string {
    return this.displayName;
  }

  setDisplayName(name: string): void {
    this.displayName = name.trim() || this.state.walletId;
  }

  updateRiskLimits(limits: Partial<RiskLimits>): void {
    if (limits.maxPositionSize !== undefined) this.state.riskLimits.maxPositionSize = limits.maxPositionSize;
    if (limits.maxExposurePerMarket !== undefined) this.state.riskLimits.maxExposurePerMarket = limits.maxExposurePerMarket;
    if (limits.maxDailyLoss !== undefined) this.state.riskLimits.maxDailyLoss = limits.maxDailyLoss;
    if (limits.maxOpenTrades !== undefined) this.state.riskLimits.maxOpenTrades = limits.maxOpenTrades;
    if (limits.maxDrawdown !== undefined) this.state.riskLimits.maxDrawdown = limits.maxDrawdown;
    logger.info({ walletId: this.state.walletId, riskLimits: this.state.riskLimits }, 'Risk limits updated');
  }

  async preflightLiveAccess(): Promise<LivePreflightResult> {
    const credValidation = this.validateLiveCredentialInputs();
    if (!credValidation.ok) {
      this.switchToPaperFallback(credValidation.reason);
      return { ok: false, reason: credValidation.reason };
    }

    const clobReachability = await this.safeFetch(`${this.clobApi}/`, { method: 'GET' });
    if (!clobReachability.ok) {
      const reason = `CLOB preflight failed (${clobReachability.error ?? 'unknown'})`;
      this.switchToPaperFallback(reason);
      return { ok: false, reason, details: { clobReachability } };
    }

    try {
      await this.getClobClient();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.switchToPaperFallback(reason);
      return { ok: false, reason };
    }

    logger.info({ walletId: this.state.walletId, clobApi: this.clobApi, chainId: this.chainId }, 'LIVE preflight passed with official CLOB auth flow');
    return {
      ok: true,
      details: {
        clobApi: this.clobApi,
        chainId: this.chainId,
      },
    };
  }

  async placeOrder(request: {
    marketId: string;
    tokenId?: string;
    outcome: 'YES' | 'NO';
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
  }): Promise<void> {
    if (this.state.mode === 'PAPER') {
      this.placePaperFallbackOrder(request, this.liveDisabledReason ?? 'LIVE wallet running in PAPER fallback mode');
      return;
    }

    let tokenId: string;
    try {
      tokenId = await this.resolveOrderTokenId(request);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ walletId: this.state.walletId }, msg);
      consoleLog.error('ORDER', `[${this.state.walletId}] ${msg}`);
      throw new Error(msg);
    }

    let client: ClobClient;
    try {
      client = await this.getClobClient();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ walletId: this.state.walletId, error: msg }, 'LIVE order setup error');
      consoleLog.error('ORDER', `[${this.state.walletId}] LIVE order setup failed: ${msg}`);
      throw new Error(`LIVE order setup error: ${msg}`);
    }

    const orderId = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cost = request.price * request.size;

    logger.info(
      {
        walletId: this.state.walletId,
        orderId,
        marketId: request.marketId,
        tokenId,
        outcome: request.outcome,
        side: request.side,
        price: request.price,
        size: request.size,
        cost,
      },
      `LIVE order submitting ${request.side} ${request.outcome} market=${request.marketId} price=${request.price} size=${request.size}`,
    );

    /* ── Submit order via official Polymarket CLOB client ── */
    let orderResponse: unknown;
    try {
      orderResponse = await this.submitClobOrder(client, {
        tokenID: tokenId,
        price: request.price,
        size: request.size,
        side: request.side === 'BUY' ? Side.BUY : Side.SELL,
      });
    } catch (err) {
      const details = this.stringifyUnknown(err);

      // Some strategies emit marketId without tokenId; if token lookup was stale, refresh once.
      if (details.toLowerCase().includes('market not found')) {
        const refreshed = await this.resolveOrderTokenId(request, true).catch(() => null);
        if (refreshed && refreshed !== tokenId) {
          logger.warn({ walletId: this.state.walletId, orderId, oldTokenId: tokenId, newTokenId: refreshed }, 'Retrying LIVE order with refreshed CLOB token ID');
          try {
            orderResponse = await this.submitClobOrder(client, {
              tokenID: refreshed,
              price: request.price,
              size: request.size,
              side: request.side === 'BUY' ? Side.BUY : Side.SELL,
            });
            tokenId = refreshed;
          } catch {
            // keep original error handling below
          }
        }
      }

      if (orderResponse !== undefined) {
        // Retry succeeded; continue to post-fill state updates.
      } else {
        const msg = `LIVE order rejected by Polymarket: ${details}`;
        logger.error({
          walletId: this.state.walletId,
          orderId,
          tokenId,
          error: details,
        }, msg);
        consoleLog.error('ORDER', `[${this.state.walletId}] ${msg}`);
        if (this.isTradingRestrictedError(details)) {
          this.switchToPaperFallback(`Trading restricted: ${details}`);
          this.placePaperFallbackOrder(request, 'Falling back after LIVE trading restriction');
          return;
        }
        throw new Error(msg);
      }
    }

    /* ── Order accepted — update local state ── */
    const entryPrice = this.getExistingEntryPrice(request.marketId, request.outcome);
    this.applyFill({
      marketId: request.marketId,
      outcome: request.outcome,
      side: request.side,
      price: request.price,
      size: request.size,
    });

    const realizedPnl = request.side === 'SELL' && entryPrice > 0
      ? (request.price - entryPrice) * request.size
      : 0;
    this.state.realizedPnl += realizedPnl;

    const signedCost = cost * (request.side === 'BUY' ? 1 : -1);
    this.state.availableBalance -= signedCost;

    this.trades.push({
      orderId,
      walletId: this.state.walletId,
      marketId: request.marketId,
      outcome: request.outcome,
      side: request.side,
      price: request.price,
      size: request.size,
      cost,
      realizedPnl,
      cumulativePnl: this.state.realizedPnl,
      balanceAfter: this.state.availableBalance,
      timestamp: Date.now(),
    });

    if (this.trades.length > PolymarketWallet.MAX_TRADE_HISTORY) {
      this.trades.splice(0, this.trades.length - PolymarketWallet.MAX_TRADE_HISTORY);
    }

    logger.info(
      {
        walletId: this.state.walletId,
        orderId,
        tokenId,
        marketId: request.marketId,
        side: request.side,
        outcome: request.outcome,
        price: request.price,
        size: request.size,
        realizedPnl,
        balance: this.state.availableBalance,
        clobResponse: orderResponse,
      },
      `LIVE order FILLED ${request.side} ${request.outcome} market=${request.marketId} price=${request.price} size=${request.size}`,
    );

    consoleLog.success('ORDER', `[${this.state.walletId}] ${request.side} ${request.outcome} ×${request.size} @ $${request.price} → PnL $${realizedPnl.toFixed(2)} | Bal $${this.state.availableBalance.toFixed(2)}`, {
      walletId: this.state.walletId,
      strategy: this.state.assignedStrategy,
      orderId,
      marketId: request.marketId,
      outcome: request.outcome,
      side: request.side,
      price: request.price,
      size: request.size,
      realizedPnl: Number(realizedPnl.toFixed(4)),
      cumulativePnl: Number(this.state.realizedPnl.toFixed(4)),
      balanceAfter: Number(this.state.availableBalance.toFixed(2)),
    });
  }

  private getExistingEntryPrice(marketId: string, outcome: 'YES' | 'NO'): number {
    const pos = this.state.openPositions.find(
      (p) => p.marketId === marketId && p.outcome === outcome,
    );
    return pos ? pos.avgPrice : 0;
  }

  private applyFill(fill: {
    marketId: string;
    outcome: 'YES' | 'NO';
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
  }): void {
    const existing = this.state.openPositions.find(
      (pos) => pos.marketId === fill.marketId && pos.outcome === fill.outcome,
    );

    if (!existing) {
      if (fill.side === 'BUY') {
        this.state.openPositions.push({
          marketId: fill.marketId,
          outcome: fill.outcome,
          size: fill.size,
          avgPrice: fill.price,
          realizedPnl: 0,
        });
      }
      return;
    }

    if (fill.side === 'BUY') {
      const newSize = existing.size + fill.size;
      existing.avgPrice =
        (existing.avgPrice * existing.size + fill.price * fill.size) / newSize;
      existing.size = newSize;
    } else {
      existing.size -= Math.min(fill.size, existing.size);
      if (existing.size <= 0) {
        existing.size = 0;
        existing.avgPrice = 0;
      }
    }

    this.state.openPositions = this.state.openPositions.filter((p) => p.size > 0);
  }

  private placePaperFallbackOrder(
    request: {
      marketId: string;
      outcome: 'YES' | 'NO';
      side: 'BUY' | 'SELL';
      price: number;
      size: number;
    },
    reason: string,
  ): void {
    const orderId = `paper-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cost = request.price * request.size;
    const entryPrice = this.getExistingEntryPrice(request.marketId, request.outcome);

    this.applyFill({
      marketId: request.marketId,
      outcome: request.outcome,
      side: request.side,
      price: request.price,
      size: request.size,
    });

    const realizedPnl = request.side === 'SELL' && entryPrice > 0
      ? (request.price - entryPrice) * request.size
      : 0;
    this.state.realizedPnl += realizedPnl;
    const signedCost = cost * (request.side === 'BUY' ? 1 : -1);
    this.state.availableBalance -= signedCost;

    this.trades.push({
      orderId,
      walletId: this.state.walletId,
      marketId: request.marketId,
      outcome: request.outcome,
      side: request.side,
      price: request.price,
      size: request.size,
      cost,
      realizedPnl,
      cumulativePnl: this.state.realizedPnl,
      balanceAfter: this.state.availableBalance,
      timestamp: Date.now(),
    });
    if (this.trades.length > PolymarketWallet.MAX_TRADE_HISTORY) {
      this.trades.splice(0, this.trades.length - PolymarketWallet.MAX_TRADE_HISTORY);
    }

    consoleLog.warn(
      'ORDER',
      `[${this.state.walletId}] Executed in PAPER fallback (${reason}) ${request.side} ${request.outcome} ×${request.size} @ $${request.price}`,
      {
        walletId: this.state.walletId,
        strategy: this.state.assignedStrategy,
        mode: this.state.mode,
        reason,
        marketId: request.marketId,
        outcome: request.outcome,
        side: request.side,
        price: request.price,
        size: request.size,
      },
    );
  }

  private switchToPaperFallback(reason: string): void {
    if (this.state.mode === 'PAPER') return;
    this.state.mode = 'PAPER';
    this.liveDisabledReason = reason;
    logger.warn({ walletId: this.state.walletId, reason }, 'LIVE wallet switched to PAPER fallback');
    consoleLog.warn('ORDER', `[${this.state.walletId}] LIVE disabled; switched to PAPER fallback. Reason: ${reason}`, {
      walletId: this.state.walletId,
      strategy: this.state.assignedStrategy,
      reason,
    });
  }

  private isTradingRestrictedError(body: string): boolean {
    const text = body.toLowerCase();
    return text.includes('trading restricted') || text.includes('geoblock') || text.includes('blocked in your region');
  }

  private validateLiveCredentialInputs(): { ok: true } | { ok: false; reason: string } {
    const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
    if (!privateKey) {
      return { ok: false, reason: 'POLYMARKET_PRIVATE_KEY not set' };
    }

    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      return { ok: false, reason: 'POLYMARKET_PRIVATE_KEY must be a 32-byte hex key prefixed with 0x' };
    }

    const funder = process.env.POLYMARKET_FUNDER_ADDRESS;
    if (!funder) {
      return { ok: false, reason: 'POLYMARKET_FUNDER_ADDRESS not set' };
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(funder)) {
      return { ok: false, reason: 'POLYMARKET_FUNDER_ADDRESS must be a valid 0x-prefixed address' };
    }

    const sigTypeRaw = process.env.POLYMARKET_SIGNATURE_TYPE ?? '2';
    if (!['0', '1', '2'].includes(sigTypeRaw)) {
      return { ok: false, reason: 'POLYMARKET_SIGNATURE_TYPE must be 0 (EOA), 1 (POLY_PROXY), or 2 (GNOSIS_SAFE)' };
    }

    const hasAllL2Creds = Boolean(
      process.env.POLYMARKET_API_KEY
      && process.env.POLYMARKET_API_SECRET
      && process.env.POLYMARKET_API_PASSPHRASE,
    );
    if (!hasAllL2Creds) {
      logger.info(
        { walletId: this.state.walletId },
        'POLYMARKET_API_KEY / SECRET / PASSPHRASE not fully set; deriving credentials via official L1 flow',
      );
    }

    return { ok: true };
  }

  private async getClobClient(): Promise<ClobClient> {
    if (this.clobClient) return this.clobClient;

    const validation = this.validateLiveCredentialInputs();
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    const privateKey = process.env.POLYMARKET_PRIVATE_KEY as string;
    const funder = process.env.POLYMARKET_FUNDER_ADDRESS as string;
    const signatureType = Number(process.env.POLYMARKET_SIGNATURE_TYPE ?? '2');
    const signer = new Wallet(privateKey);

    const providedCreds = this.readProvidedApiCreds();
    const apiCreds = providedCreds ?? await this.deriveApiCreds(signer);
    this.maybeLogL2Credentials(apiCreds, providedCreds ? 'provided' : 'derived');

    this.clobClient = new ClobClient(
      this.clobApi,
      this.chainId,
      signer,
      apiCreds,
      signatureType,
      funder,
    );
    return this.clobClient;
  }

  private readProvidedApiCreds(): PolyApiCreds | null {
    const apiKey = process.env.POLYMARKET_API_KEY;
    const secret = process.env.POLYMARKET_API_SECRET;
    const passphrase = process.env.POLYMARKET_API_PASSPHRASE;
    if (!apiKey || !secret || !passphrase) return null;
    return { key: apiKey, secret, passphrase };
  }

  private async deriveApiCreds(signer: Wallet): Promise<PolyApiCreds> {
    const tempClient = new ClobClient(this.clobApi, this.chainId, signer);
    const derived = await tempClient.createOrDeriveApiKey();
    const creds = derived as Partial<PolyApiCreds> & { apiKey?: string };
    const key = creds.key ?? creds.apiKey;

    if (!key || !creds.secret || !creds.passphrase) {
      throw new Error('Failed to derive valid Polymarket L2 API credentials (key/secret/passphrase)');
    }

    logger.info({ walletId: this.state.walletId }, 'Derived Polymarket L2 API credentials via official CLOB flow');
    return {
      key,
      secret: creds.secret,
      passphrase: creds.passphrase,
    };
  }

  private maybeLogL2Credentials(creds: PolyApiCreds, source: 'derived' | 'provided'): void {
    if (!this.logDerivedL2Creds || PolymarketWallet.hasLoggedL2Credentials) return;

    PolymarketWallet.hasLoggedL2Credentials = true;

    const walletAddress = process.env.POLYMARKET_FUNDER_ADDRESS ?? '(missing)';
    const signatureType = process.env.POLYMARKET_SIGNATURE_TYPE ?? '2';

    logger.warn(
      {
        walletId: this.state.walletId,
        source,
        signerAddress: new Wallet(process.env.POLYMARKET_PRIVATE_KEY as string).address,
        funderAddress: walletAddress,
        signatureType,
      },
      'POLYMARKET_LOG_DERIVED_L2=true: printing full L2 credentials in logs. Treat logs as sensitive secrets.',
    );

    logger.warn(
      {
        walletId: this.state.walletId,
        source,
        POLYMARKET_API_KEY: creds.key,
        POLYMARKET_API_SECRET: creds.secret,
        POLYMARKET_API_PASSPHRASE: creds.passphrase,
      },
      '[SENSITIVE] L2 creds for .env (disable POLYMARKET_LOG_DERIVED_L2 after copying)',
    );

    consoleLog.warn(
      'SYSTEM',
      '[SENSITIVE] L2 creds for .env (keep private):\n'
      + `POLYMARKET_API_KEY=${creds.key}\n`
      + `POLYMARKET_API_SECRET=${creds.secret}\n`
      + `POLYMARKET_API_PASSPHRASE=${creds.passphrase}`,
      {
        walletId: this.state.walletId,
        source,
        signerAddress: new Wallet(process.env.POLYMARKET_PRIVATE_KEY as string).address,
        funderAddress: walletAddress,
        signatureType: Number(signatureType),
      },
    );
  }

  private stringifyUnknown(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.message;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private async resolveOrderTokenId(
    request: { marketId: string; tokenId?: string; outcome: 'YES' | 'NO' },
    forceRefresh = false,
  ): Promise<string> {
    // If strategy provided tokenId explicitly, trust it.
    if (request.tokenId && request.tokenId.trim()) {
      return request.tokenId.trim();
    }

    const marketId = request.marketId?.trim();
    if (!marketId) {
      throw new Error('Missing marketId/tokenId for LIVE order; cannot resolve CLOB token ID');
    }

    let tokenIds = !forceRefresh ? this.marketTokenCache.get(marketId) : undefined;
    if (!tokenIds || tokenIds.length === 0) {
      tokenIds = await this.fetchGammaTokenIds(marketId);
      if (tokenIds.length > 0) this.marketTokenCache.set(marketId, tokenIds);
    }

    if (!tokenIds || tokenIds.length === 0) {
      throw new Error(`No CLOB token IDs found for market ${marketId}; order skipped`);
    }

    const idx = request.outcome === 'YES' ? 0 : 1;
    return tokenIds[idx] ?? tokenIds[0];
  }

  private async fetchGammaTokenIds(marketId: string): Promise<string[]> {
    const candidates = [
      `${this.gammaApi}/markets/${encodeURIComponent(marketId)}`,
      `${this.gammaApi}/markets?id=${encodeURIComponent(marketId)}`,
    ];

    for (const url of candidates) {
      const resp = await this.safeFetch(url, { method: 'GET' });
      if (!resp.ok || !resp.body) continue;

      const parsed = this.safeParseJson(resp.body);
      const tokenIds = this.extractTokenIds(parsed);
      if (tokenIds.length > 0) {
        logger.info({ walletId: this.state.walletId, marketId, tokenIds, source: url }, 'Resolved CLOB token IDs from Gamma');
        return tokenIds;
      }
    }

    logger.warn({ walletId: this.state.walletId, marketId }, 'Failed to resolve CLOB token IDs from Gamma');
    return [];
  }

  private safeParseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private extractTokenIds(payload: unknown): string[] {
    const market = Array.isArray(payload)
      ? (payload[0] as { clobTokenIds?: unknown } | undefined)
      : (payload as { clobTokenIds?: unknown } | null);

    const raw = market?.clobTokenIds;
    if (Array.isArray(raw)) {
      return raw.map((v) => String(v)).filter((v) => v.length > 0);
    }

    if (typeof raw === 'string') {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return arr.map((v) => String(v)).filter((v) => v.length > 0);
        }
      } catch {
        // ignore malformed clobTokenIds
      }
    }

    return [];
  }

  private async submitClobOrder(
    client: ClobClient,
    orderArgs: { tokenID: string; price: number; size: number; side: Side },
  ): Promise<unknown> {
    const response = await client.createAndPostOrder(
      orderArgs,
      {
        tickSize: '0.01',
        negRisk: false,
      },
      OrderType.GTC,
    );

    // Some clob-client versions return `{ error, status }` instead of throwing.
    if (!this.isClobOrderAccepted(response)) {
      const detail = this.stringifyUnknown(response);
      throw new Error(`CLOB rejected order: ${detail}`);
    }

    return response;
  }

  private isClobOrderAccepted(response: unknown): boolean {
    if (!response || typeof response !== 'object') return false;
    const r = response as Record<string, unknown>;

    if (typeof r.status === 'number' && r.status >= 400) return false;
    if (typeof r.error === 'string' && r.error.trim().length > 0) return false;
    if (r.success === false) return false;

    return true;
  }

  private pickDiagnosticHeaders(response: Response): Record<string, string> {
    const keys = [
      'x-request-id',
      'cf-ray',
      'cf-cache-status',
      'server',
      'date',
      'x-envoy-upstream-service-time',
    ];
    const out: Record<string, string> = {};
    for (const k of keys) {
      const v = response.headers.get(k);
      if (v) out[k] = v;
    }
    return out;
  }

  private async safeFetch(
    url: string,
    init: RequestInit,
  ): Promise<{ ok: boolean; status?: number; body?: string; headers?: Record<string, string>; error?: string }> {
    try {
      const response = await fetch(url, init);
      let body = '';
      try { body = await response.text(); } catch { /* ignore */ }
      return {
        ok: response.ok,
        status: response.status,
        body,
        headers: this.pickDiagnosticHeaders(response),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
