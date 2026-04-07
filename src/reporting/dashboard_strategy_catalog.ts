/* ──────────────────────────────────────────────────────────────
   Strategy catalog — rich metadata used by the Strategies tab
   ────────────────────────────────────────────────────────────── */
interface FilterInfo {
  name: string;
  label: string;
  description: string;
  configKeys: string[];
}

interface ExitRule {
  name: string;
  description: string;
  configKeys: string[];
}

interface RiskControl {
  name: string;
  description: string;
  configKey?: string;
}

interface ConfigParam {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'string';
  default: string | number | boolean;
  unit?: string;
  description: string;
  group: string;
}

interface StrategyCatalogEntry {
  id: string;
  name: string;
  category: string;
  riskLevel: string;
  description: string;
  longDescription?: string;
  howItWorks: string[];
  parameters: Record<string, string>;
  idealFor: string;
  /** Deep-dive metadata for the detail view */
  filters?: FilterInfo[];
  entryLogic?: string[];
  exitRules?: ExitRule[];
  positionSizing?: string[];
  riskControls?: RiskControl[];
  configSchema?: ConfigParam[];
  version?: string;
  author?: string;
  tags?: string[];
}

export function getStrategyCatalog(): StrategyCatalogEntry[] {
  return [
    {
      id: 'cross_market_arbitrage',
      name: 'Cross-Market Arbitrage',
      category: 'Arbitrage',
      riskLevel: 'Low-Medium',
      description:
        'Detects pricing inconsistencies between related prediction markets. If "Will X happen by March?" is priced higher than "Will X happen by June?", that is an arbitrage opportunity.',
      howItWorks: [
        'Scans all active markets for related pairs (same event, different timeframes)',
        'Compares prices across correlated outcomes',
        'When mispricing exceeds threshold (default 2%), generates buy/sell signals on both legs',
        'Profits when prices converge to their correct relationship',
      ],
      parameters: {
        minSpread: '2% \u2014 minimum price divergence to trigger',
        maxExposure: 'Per-wallet configurable',
        scanInterval: '30 seconds',
      },
      idealFor: 'Conservative traders seeking market-neutral returns',
    },
    {
      id: 'mispricing_arbitrage',
      name: 'Mispricing Detector',
      category: 'Arbitrage',
      riskLevel: 'Low',
      description:
        'Identifies outcomes whose probabilities don\'t sum correctly. In a binary market (Yes/No), prices should sum to ~$1.00. When they don\'t, there is a risk-free profit.',
      howItWorks: [
        'Fetches all outcomes for each market',
        'Sums the prices (e.g., Yes $0.55 + No $0.40 = $0.95)',
        'If sum < $1.00, buy both sides for guaranteed profit at resolution',
        'If sum > $1.00, identifies the overpriced side to sell',
      ],
      parameters: {
        mispricingThreshold: '1.5% deviation from $1.00',
        minLiquidity: '$50 order-book depth required',
      },
      idealFor: 'Risk-averse traders seeking near-guaranteed returns',
    },
    {
      id: 'ai_forecast',
      name: 'AI Research Forecast',
      category: 'Research / AI',
      riskLevel: 'Medium-High',
      description:
        'Uses web research and data analysis to estimate the true probability of an event, then trades when the market price diverges significantly from the AI estimate.',
      howItWorks: [
        'Runs a web research pipeline to gather news, data, and expert opinions',
        'Feeds research into a forecasting model to estimate true probability',
        'Compares AI estimate to current market price',
        'If market is mispriced (>5% divergence), generates a trading signal',
        'Sizes position via Kelly criterion based on confidence and edge',
      ],
      parameters: {
        minEdge: '5% divergence between estimate and market price',
        confidenceThreshold: '0.6 minimum model confidence',
        researchInterval: '5 minutes',
      },
      idealFor: 'Traders who want AI-driven alpha on event markets',
    },
    {
      id: 'market_making',
      name: 'Market Making (Spread)',
      category: 'Market Making',
      riskLevel: 'Medium',
      description:
        'Places bid and ask orders around estimated fair value to capture the spread. Profits from the difference between buy and sell prices.',
      howItWorks: [
        'Estimates fair value from order-book midpoint and recent trades',
        'Places buy order below fair value (bid) and sell order above (ask)',
        'When both sides fill, captures the spread as profit',
        'Continuously adjusts quotes as the market moves',
        'Includes inventory management to limit directional risk',
      ],
      parameters: {
        spreadWidth: '3% distance between bid and ask',
        orderSize: '5% of capital per order',
        maxInventory: '20% of capital in one direction',
        requoteInterval: '10 seconds',
      },
      idealFor: 'Traders who want steady income from providing liquidity',
    },
    {
      id: 'momentum',
      name: 'Momentum / Trend',
      category: 'Trend Following',
      riskLevel: 'High',
      description:
        'Trades in the direction of recent price movement. Buys when market is trending up, sells when trending down.',
      howItWorks: [
        'Tracks price changes over configurable lookback windows (1h, 4h, 24h)',
        'Calculates momentum score from rate of change and volume',
        'Buy signal when momentum exceeds positive threshold',
        'Sell signal when momentum drops below negative threshold',
        'Uses trailing stops to protect profits',
      ],
      parameters: {
        lookbackPeriods: '1h, 4h, 24h',
        momentumThreshold: '3% move to trigger',
        trailingStop: '5% reversal to exit',
      },
      idealFor: 'Traders who want to ride big moves in event markets',
    },
    {
      id: 'copy_trade',
      name: 'Copy Trade (Whale Mirroring)',
      category: 'Copy Trading',
      riskLevel: 'Medium',
      version: '1.0.0',
      author: 'Built-in',
      tags: ['whale-tracking', 'copy-trading', 'address-based', 'configurable-risk', 'mirror-or-inverse'],
      description:
        'Automatically mirrors (or inverses) trades made by specified whale wallet addresses on Polymarket. Polls the data API for new whale trades and replicates them with full risk management.',
      longDescription:
        'This strategy watches one or more whale wallet addresses and copies their trades in real-time. ' +
        'When a whale buys YES on a market, the strategy opens a corresponding position. When the whale exits, the strategy can automatically close. ' +
        'Supports two copy modes: "mirror" (trade the same direction) or "inverse" (fade the whale). ' +
        'Three sizing modes let you control position size: fixed dollar amount, proportional to whale size, or Kelly criterion. ' +
        'Comprehensive risk controls include per-whale performance tracking, consecutive-loss cooldowns, drawdown pauses, daily volume caps, and per-market exposure limits. ' +
        'Whales with poor win rates are automatically paused. All whale addresses can be managed live from the dashboard.',
      howItWorks: [
        'Polls the Polymarket data API every N seconds for trades by tracked whale addresses',
        'Filters trades by age, market blacklist, and minimum size',
        'Generates BUY/SELL signals matching (or inversing) each whale trade',
        'Sizes positions using fixed, proportional, or Kelly criterion modes',
        'Tracks per-whale performance (win rate, PnL, consecutive losses)',
        'Manages exits via take-profit, stop-loss, trailing stop, time exit, and whale-exit detection',
        'Pauses copying whales that fall below minimum win rate threshold',
      ],
      parameters: {
        copyMode: 'mirror or inverse — follow or fade the whale',
        sizeMode: 'fixed / proportional / kelly — how to size positions',
        fixedSize: '$10 per copy trade (fixed mode)',
        pollInterval: '30 seconds between whale trade polls',
        stopLoss: '500 bps (5%) — maximum loss before auto-exit',
        takeProfit: '300 bps (3%) — profit target for auto-exit',
        trailingStop: '150 bps — trailing stop after activation',
        maxDrawdown: '15% — pause all trading if drawdown exceeds this',
      },
      idealFor: 'Traders who want to leverage whale alpha by following profitable wallets',
      entryLogic: [
        'Fetches recent trades from each tracked whale address via the Polymarket data API',
        'Filters out trades older than max_trade_age_seconds (default 5 minutes)',
        'Skips trades on blacklisted markets or below minimum size',
        'In mirror mode: copies the whale\'s exact direction (BUY YES → BUY YES)',
        'In inverse mode: takes the opposite side (whale BUY YES → SELL / BUY NO)',
        'Checks per-whale performance — skips whales below min_whale_win_rate',
        'Checks daily volume cap and max open positions before entering',
      ],
      exitRules: [
        {
          name: 'Take Profit',
          description: 'Closes position when PnL exceeds take_profit_bps above entry price.',
          configKeys: ['take_profit_bps'],
        },
        {
          name: 'Stop Loss',
          description: 'Closes position when PnL drops below stop_loss_bps from entry price.',
          configKeys: ['stop_loss_bps'],
        },
        {
          name: 'Trailing Stop',
          description: 'Activates after trailing_activate_bps profit, then exits if price retraces by trailing_stop_bps from the high-water mark.',
          configKeys: ['trailing_stop_bps', 'trailing_activate_bps'],
        },
        {
          name: 'Time Exit',
          description: 'Closes position after time_exit_minutes regardless of PnL to prevent capital lock-up.',
          configKeys: ['time_exit_minutes'],
        },
        {
          name: 'Whale Exit Detection',
          description: 'When the whale exits their position (detected via API polling), automatically closes the copy position.',
          configKeys: ['exit_on_whale_exit'],
        },
      ],
      positionSizing: [
        'Fixed mode: every copy trade uses a flat dollar amount (fixed_size)',
        'Proportional mode: position size = whale_size × proportional_factor',
        'Kelly mode: sizes based on whale win rate and average edge',
        'All sizes capped at max_position_size_usd per trade',
        'Per-market exposure capped at max_exposure_per_market_usd',
        'Total daily volume capped at max_daily_volume_usd',
        'Maximum simultaneous positions enforced by max_open_positions',
      ],
      riskControls: [
        { name: 'Per-Whale Win Rate', description: 'Pauses copying a whale if their win rate drops below threshold', configKey: 'min_whale_win_rate' },
        { name: 'Consecutive Loss Cooldown', description: 'Pauses a whale after N consecutive losing trades for a configurable cooldown period', configKey: 'max_consecutive_losses' },
        { name: 'Max Drawdown', description: 'Pauses all copy trading if total drawdown exceeds threshold', configKey: 'max_drawdown_pct' },
        { name: 'Daily Volume Cap', description: 'Stops opening new positions once daily volume limit is reached', configKey: 'max_daily_volume_usd' },
        { name: 'Max Open Positions', description: 'Limits concurrent open positions to prevent overexposure', configKey: 'max_open_positions' },
        { name: 'Per-Market Exposure', description: 'Caps exposure to any single market', configKey: 'max_exposure_per_market_usd' },
        { name: 'Trade Age Filter', description: 'Ignores whale trades older than max_trade_age_seconds to avoid stale signals', configKey: 'max_trade_age_seconds' },
        { name: 'Market Blacklist', description: 'Skip specific markets that should not be copied' },
      ],
      configSchema: [
        { key: 'copy_mode', label: 'Copy Mode', type: 'string', default: 'mirror', description: 'mirror = follow whale, inverse = fade whale', group: 'General' },
        { key: 'size_mode', label: 'Size Mode', type: 'string', default: 'fixed', description: 'How to size copy positions: fixed, proportional, or kelly', group: 'General' },
        { key: 'fixed_size', label: 'Fixed Size', type: 'number', default: 10, unit: 'USD', description: 'Dollar amount per trade in fixed mode', group: 'Sizing' },
        { key: 'proportional_factor', label: 'Proportional Factor', type: 'number', default: 0.1, description: 'Fraction of whale size to copy in proportional mode', group: 'Sizing' },
        { key: 'max_position_size_usd', label: 'Max Position Size', type: 'number', default: 200, unit: 'USD', description: 'Hard cap on any single copy trade', group: 'Sizing' },
        { key: 'max_exposure_per_market_usd', label: 'Max Market Exposure', type: 'number', default: 500, unit: 'USD', description: 'Max total exposure per market', group: 'Sizing' },
        { key: 'max_daily_volume_usd', label: 'Max Daily Volume', type: 'number', default: 2000, unit: 'USD', description: 'Daily volume cap across all copy trades', group: 'Sizing' },
        { key: 'max_open_positions', label: 'Max Open Positions', type: 'number', default: 10, description: 'Maximum concurrent positions', group: 'Sizing' },
        { key: 'poll_interval_seconds', label: 'Poll Interval', type: 'number', default: 30, unit: 'sec', description: 'Seconds between whale trade API polls', group: 'Polling' },
        { key: 'max_trade_age_seconds', label: 'Max Trade Age', type: 'number', default: 300, unit: 'sec', description: 'Ignore whale trades older than this', group: 'Polling' },
        { key: 'min_trade_size_usd', label: 'Min Trade Size', type: 'number', default: 10, unit: 'USD', description: 'Ignore whale trades smaller than this', group: 'Polling' },
        { key: 'stop_loss_bps', label: 'Stop Loss', type: 'number', default: 500, unit: 'bps', description: 'Close position on this much loss', group: 'Exit' },
        { key: 'take_profit_bps', label: 'Take Profit', type: 'number', default: 300, unit: 'bps', description: 'Close position on this much profit', group: 'Exit' },
        { key: 'trailing_stop_bps', label: 'Trailing Stop', type: 'number', default: 150, unit: 'bps', description: 'Trailing stop distance from high-water mark', group: 'Exit' },
        { key: 'trailing_activate_bps', label: 'Trailing Activation', type: 'number', default: 200, unit: 'bps', description: 'Profit needed before trailing stop activates', group: 'Exit' },
        { key: 'time_exit_minutes', label: 'Time Exit', type: 'number', default: 120, unit: 'min', description: 'Close position after this many minutes', group: 'Exit' },
        { key: 'min_whale_win_rate', label: 'Min Whale Win Rate', type: 'number', default: 0.50, description: 'Pause copying whale if win rate drops below this', group: 'Risk' },
        { key: 'max_drawdown_pct', label: 'Max Drawdown', type: 'number', default: 0.15, description: 'Pause all trading if drawdown exceeds this %', group: 'Risk' },
        { key: 'max_consecutive_losses', label: 'Max Consecutive Losses', type: 'number', default: 5, description: 'Pause whale after this many losses in a row', group: 'Risk' },
        { key: 'cooldown_after_loss_seconds', label: 'Loss Cooldown', type: 'number', default: 300, unit: 'sec', description: 'Cooldown period after consecutive loss limit', group: 'Risk' },
      ],
    },
    {
      id: 'user_defined',
      name: 'User-Defined Strategy',
      category: 'Custom',
      riskLevel: 'Depends on implementation',
      description:
        'A blank framework for implementing your own trading logic. Provides all the hooks (market data, order submission, position management) \u2014 you supply the logic.',
      howItWorks: [
        'Extend the BaseStrategy class in src/strategies/custom/user_defined_strategy.ts',
        'Implement generateSignals() with your custom logic',
        'The framework handles execution, risk checks, and position tracking',
        'Full access to market data, order books, and wallet state',
      ],
      parameters: { custom: 'Defined by your implementation' },
      idealFor: 'Developers who want full control over trading logic',
    },
    {
      id: 'filtered_high_prob_convergence',
      name: 'Filtered High-Probability Convergence',
      category: 'Convergence / Mean-Reversion',
      riskLevel: 'Low-Medium',
      version: '1.0.0',
      author: 'Built-in',
      tags: ['rule-based', 'no-AI', 'microstructure', 'passive-entry', 'prop-style-risk'],
      description:
        'Enters high-probability prediction markets ONLY when market microstructure supports a favorable risk/return profile. Uses 7 cascading filters to reject bad setups, then sizes conservatively via a composite Setup Score.',
      longDescription:
        'This strategy targets markets where the implied probability of the leading outcome is between 65\u201396% (configurable) and the market is likely to converge further toward resolution \u2014 or at least not mean-revert against us. ' +
        'Unlike naive approaches ("buy anything > 69%"), it applies strict liquidity, spread, time-horizon, anti-chasing, flow-confirmation, and correlation filters before ever placing an order. ' +
        'Entry uses passive limit orders near the best bid to avoid paying the spread. Position sizing is driven by a 0\u20131 Setup Score that rewards tight spreads, deep books, supportive order flow, and short time-to-resolution. ' +
        'Three exit rules (take-profit, stop-loss, time-exit) ensure capital is not locked in stale positions. All decisions are explainable with market data and rules \u2014 no AI, no web research, no black boxes.',
      howItWorks: [
        'Scans all active markets every tick (default 5 seconds)',
        'Applies 7 cascading filters: Liquidity \u2192 Probability Band \u2192 Spread \u2192 Time-to-Resolution \u2192 Anti-Chasing \u2192 Flow/Pressure \u2192 Cluster Exposure',
        'Markets that pass all 7 filters generate a BUY signal on the leading outcome',
        'Computes a Setup Score (0\u20131) from spread tightness, depth, order flow, and time horizon',
        'Sizes position: base_risk_pct \u00d7 capital \u00d7 setup_score, capped by per-market and MLE limits',
        'Places passive limit order near best bid (post-only style) with configurable TTL',
        'Monitors open positions for take-profit (+200 bps), stop-loss (-150 bps), and time exit',
        'Tracks daily/weekly PnL, cluster exposure, and rate limits per wallet',
      ],
      parameters: {
        'min_prob / max_prob': '65\u201396% — probability band for the leading outcome',
        'max_spread_bps': '200 bps — maximum bid-ask spread allowed',
        'max_days_to_resolution': '14 days — prefer short/medium horizons',
        'spike_pct': '8% — reject markets with recent price spikes',
        'min_imbalance': '10% — minimum orderbook imbalance or net flow required',
        'base_risk_pct': '0.5% of capital per trade (before Setup Score scaling)',
        'take_profit / stop_loss': '+200 / -150 bps from entry',
        'time_exit_hours': '48h — close stale positions',
      },
      idealFor: 'Conservative traders who want rule-based, explainable entries on high-probability markets without AI/research dependencies',
      filters: [
        {
          name: 'liquidity',
          label: 'A) Liquidity Filter',
          description: 'Requires minimum total liquidity AND estimated orderbook depth within 1% of mid-price. Rejects thin markets where execution would be poor.',
          configKeys: ['min_liquidity_usd', 'min_depth_usd_within_1pct'],
        },
        {
          name: 'probBand',
          label: 'B) Probability Band Filter',
          description: 'Only considers markets where the leading outcome\u2019s implied probability (from midprice) falls within [min_prob, max_prob]. Avoids tiny-upside markets near 0.95\u20130.99 and low-conviction markets below 0.65.',
          configKeys: ['min_prob', 'max_prob'],
        },
        {
          name: 'spread',
          label: 'C) Spread Filter',
          description: 'Rejects markets where the bid-ask spread (in basis points relative to mid) exceeds the configured threshold. Wide spreads eat into profits and signal low market-maker interest.',
          configKeys: ['max_spread_bps'],
        },
        {
          name: 'timeToRes',
          label: 'D) Time-to-Resolution Filter',
          description: 'Prefers markets with known resolution dates within max_days_to_resolution. Skips markets with no endDate or those already past resolution. Short horizons reduce uncertainty and unlock capital faster.',
          configKeys: ['max_days_to_resolution'],
        },
        {
          name: 'antiChase',
          label: 'E) Anti-Chasing Filter',
          description: 'Detects recent abnormal price spikes and high realised volatility. If the price moved more than spike_pct over the lookback window, or if rolling volatility is elevated, the market is skipped to avoid buying the top.',
          configKeys: ['spike_pct', 'spike_lookback_minutes'],
        },
        {
          name: 'flow',
          label: 'F) Flow / Pressure Confirmation',
          description: 'Computes an orderbook imbalance score (bid-size vs ask-size) and a net-buy-flow proxy from recent price action. Requires at least one supportive condition: imbalance \u2265 threshold OR net buy flow \u2265 threshold. No AI \u2014 pure market data.',
          configKeys: ['min_imbalance', 'flow_lookback_minutes', 'min_net_buy_flow_usd'],
        },
        {
          name: 'cluster',
          label: 'G) Correlation / Cluster Exposure Filter',
          description: 'Groups markets by Gamma eventId or seriesSlug. Prevents overexposure to correlated outcomes (e.g., multiple markets on the same event). Enforces max_correlated_exposure_pct per wallet.',
          configKeys: ['max_correlated_exposure_pct'],
        },
      ],
      entryLogic: [
        'Posts passive limit orders near the best bid price (+1 tick for queue priority)',
        'Does NOT cross the spread by default (post-only style)',
        'If allow_take_on_momentum is enabled, permits a small taker fraction when flow is strong',
        'Unfilled orders are cancelled after ttl_seconds and re-quoted on the next tick',
        'Each entry is logged with market ID, outcome, price, size, and cost basis',
      ],
      exitRules: [
        {
          name: 'Take Profit',
          description: 'When the midprice rises by take_profit_bps above entry price, the position is closed. Locks in gains before potential mean reversion.',
          configKeys: ['take_profit_bps'],
        },
        {
          name: 'Stop Loss',
          description: 'When the midprice drops by stop_loss_bps below entry price, the position is closed immediately. Prevents small losses from becoming large ones.',
          configKeys: ['stop_loss_bps'],
        },
        {
          name: 'Time Exit',
          description: 'If a position has been open for time_exit_hours without hitting TP or SL, it is closed. Prevents capital from being locked in stale or illiquid positions.',
          configKeys: ['time_exit_hours'],
        },
        {
          name: 'Spread Widening Near Resolution',
          description: 'If a market is within 1 day of resolution and its spread has widened to 2\u00d7 the max_spread_bps threshold, the position is closed to avoid getting stuck.',
          configKeys: ['max_spread_bps'],
        },
      ],
      positionSizing: [
        'Setup Score is a weighted composite [0\u20131]: 30% spread tightness + 25% depth + 25% order flow + 20% time-to-resolution',
        'Base size = wallet capital \u00d7 base_risk_pct (default 0.5%)',
        'Actual size = base_size \u00d7 setup_score, capped at max_position_usd_per_market',
        'MLE check: per-market max-loss-at-resolution \u2264 max_market_mle_pct of capital',
        'Total MLE across all positions \u2264 max_total_mle_pct of capital',
        'Maximum open positions enforced by max_total_open_positions',
        'Shares = floor(position_usd / entry_price), minimum 1 share',
      ],
      riskControls: [
        { name: 'Daily Loss Limit', description: 'Strategy pauses all new entries if daily realised PnL drops below max_daily_loss_pct of capital', configKey: 'max_daily_loss_pct' },
        { name: 'Weekly Drawdown Limit', description: 'Strategy pauses all new entries if weekly realised PnL drops below max_weekly_drawdown_pct of capital', configKey: 'max_weekly_drawdown_pct' },
        { name: 'Per-Market MLE', description: 'Max loss at resolution for any single market capped at max_market_mle_pct of capital', configKey: 'max_market_mle_pct' },
        { name: 'Total MLE', description: 'Aggregate max loss at resolution across all open positions capped at max_total_mle_pct of capital', configKey: 'max_total_mle_pct' },
        { name: 'Cluster Exposure', description: 'Max exposure to correlated markets (same event/series) capped at max_correlated_exposure_pct of capital', configKey: 'max_correlated_exposure_pct' },
        { name: 'Order Rate Limit', description: 'Max orders per minute per wallet to prevent runaway loops', configKey: 'max_orders_per_minute' },
        { name: 'Cancel Rate Limit', description: 'If cancel rate exceeds max_cancel_rate, new entries are blocked', configKey: 'max_cancel_rate' },
        { name: 'Global Kill Switch', description: 'External kill switch immediately disables all LIVE trading while keeping PAPER running for diagnostics' },
        { name: '5-Minute Cooldown', description: 'Per-market/outcome/side cooldown of 300 seconds prevents repeated re-entry on the same signal' },
      ],
      configSchema: [
        { key: 'enabled', label: 'Enabled', type: 'boolean', default: true, description: 'Master switch for the strategy', group: 'General' },
        { key: 'min_liquidity_usd', label: 'Min Liquidity', type: 'number', default: 10000, unit: 'USD', description: 'Minimum market liquidity to consider', group: 'Filters' },
        { key: 'min_prob', label: 'Min Probability', type: 'number', default: 0.65, description: 'Lower bound of the probability band', group: 'Filters' },
        { key: 'max_prob', label: 'Max Probability', type: 'number', default: 0.96, description: 'Upper bound of the probability band', group: 'Filters' },
        { key: 'max_spread_bps', label: 'Max Spread', type: 'number', default: 200, unit: 'bps', description: 'Maximum bid-ask spread in basis points', group: 'Filters' },
        { key: 'max_days_to_resolution', label: 'Max Days to Resolution', type: 'number', default: 14, unit: 'days', description: 'Reject markets resolving beyond this horizon', group: 'Filters' },
        { key: 'spike_pct', label: 'Spike Threshold', type: 'number', default: 0.08, description: 'Max recent price move before anti-chasing triggers', group: 'Filters' },
        { key: 'spike_lookback_minutes', label: 'Spike Lookback', type: 'number', default: 60, unit: 'min', description: 'Window for spike detection', group: 'Filters' },
        { key: 'min_depth_usd_within_1pct', label: 'Min Depth', type: 'number', default: 500, unit: 'USD', description: 'Estimated orderbook depth within 1% of mid', group: 'Filters' },
        { key: 'min_imbalance', label: 'Min Imbalance', type: 'number', default: 0.10, description: 'Minimum orderbook imbalance ratio', group: 'Filters' },
        { key: 'flow_lookback_minutes', label: 'Flow Lookback', type: 'number', default: 15, unit: 'min', description: 'Window for net buy flow estimation', group: 'Filters' },
        { key: 'min_net_buy_flow_usd', label: 'Min Net Buy Flow', type: 'number', default: 500, unit: 'USD', description: 'Minimum net buy flow in lookback window', group: 'Filters' },
        { key: 'max_correlated_exposure_pct', label: 'Max Cluster Exposure', type: 'number', default: 0.25, description: 'Max % of capital exposed to correlated markets', group: 'Filters' },
        { key: 'base_risk_pct', label: 'Base Risk %', type: 'number', default: 0.005, description: 'Fraction of capital risked per trade (before score scaling)', group: 'Sizing' },
        { key: 'max_position_usd_per_market', label: 'Max Position / Market', type: 'number', default: 200, unit: 'USD', description: 'Hard cap on position size per market', group: 'Sizing' },
        { key: 'max_total_open_positions', label: 'Max Open Positions', type: 'number', default: 10, description: 'Maximum simultaneous open positions', group: 'Sizing' },
        { key: 'ttl_seconds', label: 'Order TTL', type: 'number', default: 120, unit: 'sec', description: 'Seconds before unfilled limit orders are cancelled', group: 'Entry' },
        { key: 'allow_take_on_momentum', label: 'Allow Taker Entries', type: 'boolean', default: false, description: 'Permit crossing the spread when flow is strong', group: 'Entry' },
        { key: 'take_profit_bps', label: 'Take Profit', type: 'number', default: 200, unit: 'bps', description: 'Close position when midprice rises this much', group: 'Exit' },
        { key: 'stop_loss_bps', label: 'Stop Loss', type: 'number', default: 150, unit: 'bps', description: 'Close position when midprice drops this much', group: 'Exit' },
        { key: 'time_exit_hours', label: 'Time Exit', type: 'number', default: 48, unit: 'hours', description: 'Close position after this many hours regardless', group: 'Exit' },
        { key: 'max_daily_loss_pct', label: 'Max Daily Loss', type: 'number', default: 0.03, description: 'Pause entries if daily loss exceeds this % of capital', group: 'Risk' },
        { key: 'max_weekly_drawdown_pct', label: 'Max Weekly Drawdown', type: 'number', default: 0.08, description: 'Pause entries if weekly loss exceeds this % of capital', group: 'Risk' },
        { key: 'max_market_mle_pct', label: 'Max Market MLE', type: 'number', default: 0.05, description: 'Max loss at resolution per market as % of capital', group: 'Risk' },
        { key: 'max_total_mle_pct', label: 'Max Total MLE', type: 'number', default: 0.15, description: 'Aggregate max loss at resolution as % of capital', group: 'Risk' },
        { key: 'max_orders_per_minute', label: 'Max Orders/Min', type: 'number', default: 10, description: 'Rate limit on orders per wallet per minute', group: 'Risk' },
        { key: 'max_cancel_rate', label: 'Max Cancel Rate', type: 'number', default: 0.5, description: 'Max ratio of cancels to orders in a 5-min window', group: 'Risk' },
      ],
    },
  ];
}
