import { SlippageModel } from './slippage_model';
import { consoleLog } from '../reporting/console_log';

export class FillSimulator {
  private readonly slippage = new SlippageModel();
  private readonly POLYMARKET_TAKER_FEE_BPS = 20; // 0.2% per fill

  /**
   * Simulate fill with realistic slippage and fees.
   * Returns filled price after slippage, but fee is tracked separately
   * for wallet balance deduction.
   */
  simulate(request: {
    marketId: string;
    outcome: 'YES' | 'NO';
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
  }): {
    orderId: string;
    marketId: string;
    outcome: 'YES' | 'NO';
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
    timestamp: number;
    slippageBps: number;
    feeUsd: number;
  } {
    const adjusted = this.slippage.apply(request.price, request.size, request.side);
    const slippageBps = Math.abs(adjusted - request.price) / request.price * 10000;
    const notionalUsd = adjusted * request.size;
    const feeUsd = (this.POLYMARKET_TAKER_FEE_BPS / 10_000) * notionalUsd;
    
    const fill = {
      orderId: `paper-${Date.now()}`,
      marketId: request.marketId,
      outcome: request.outcome,
      side: request.side,
      price: Number(adjusted.toFixed(4)),
      size: request.size,
      timestamp: Date.now(),
      slippageBps: Number(slippageBps.toFixed(1)),
      feeUsd: Number(feeUsd.toFixed(4)),
    };

    consoleLog.info('FILL', `Paper fill: ${fill.side} ${fill.outcome} ×${fill.size} @ $${fill.price} (slip ${fill.slippageBps.toFixed(1)} bps, fee $${fill.feeUsd.toFixed(2)}) — ${fill.orderId}`, {
      orderId: fill.orderId,
      marketId: fill.marketId,
      outcome: fill.outcome,
      side: fill.side,
      requestedPrice: request.price,
      filledPrice: fill.price,
      size: fill.size,
      slippageBps: fill.slippageBps,
      feeUsd: fill.feeUsd,
      cost: Number((fill.price * fill.size).toFixed(4)),
    });

    return fill;
  }
}
