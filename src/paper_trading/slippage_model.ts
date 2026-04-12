export class SlippageModel {
  /**
   * Apply realistic market impact slippage to a fill price.
   * BUY  → price goes UP   (you pay more)
   * SELL → price goes DOWN  (you receive less)
   * 
   * Model: impact = baseBps + (sqrt(size) * sizeSensitivity)
   * ~17 bps for size=50 in old model → ~75 bps for size=50 in realistic model
   */
  apply(price: number, size: number, side: 'BUY' | 'SELL' = 'BUY'): number {
    // Base impact: 20 bps floor for any order
    // Size sensitivity: sqrt(size) * 3.5 bps
    // Caps at 200 bps max to prevent outliers
    const baseBps = 20;
    const sizeSensitivityBps = Math.sqrt(size) * 3.5;
    const totalSlippageBps = Math.min(200, baseBps + sizeSensitivityBps);
    const slippageRatio = totalSlippageBps / 10_000;
    
    return side === 'SELL'
      ? price * (1 - slippageRatio)
      : price * (1 + slippageRatio);
  }
}
