import type { TradeRecord, WalletState } from '../types';

export function buildWalletDetail(wallet: WalletState, trades: TradeRecord[], marketPrices?: Map<string, number>) {
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);

  /* Basic stats */
  const totalTrades = sorted.length;
  const buyTrades = sorted.filter((t) => t.side === 'BUY');
  const sellTrades = sorted.filter((t) => t.side === 'SELL');
  const wins = sorted.filter((t) => t.realizedPnl > 0);
  const losses = sorted.filter((t) => t.realizedPnl < 0);
  const closedTrades = wins.length + losses.length;
  const winRate = closedTrades > 0 ? wins.length / closedTrades : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.realizedPnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.realizedPnl, 0) / losses.length : 0;
  const profitFactor = losses.length > 0 && avgLoss !== 0
    ? Math.abs(wins.reduce((s, t) => s + t.realizedPnl, 0) / losses.reduce((s, t) => s + t.realizedPnl, 0))
    : wins.length > 0 ? Infinity : 0;
  const largestWin = wins.length > 0 ? Math.max(...wins.map((t) => t.realizedPnl)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.realizedPnl)) : 0;

  /* Cumulative PnL timeline */
  let cumPnl = 0;
  const pnlTimeline: { ts: number; pnl: number; balance: number }[] = [];
  for (const t of sorted) {
    cumPnl += t.realizedPnl;
    pnlTimeline.push({ ts: t.timestamp, pnl: round(cumPnl), balance: round(t.balanceAfter) });
  }

  /* Drawdown calculation */
  let peak = wallet.capitalAllocated;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  const drawdownTimeline: { ts: number; drawdown: number; drawdownPct: number }[] = [];
  for (const pt of pnlTimeline) {
    if (pt.balance > peak) peak = pt.balance;
    const dd = peak - pt.balance;
    const ddPct = peak > 0 ? dd / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
    drawdownTimeline.push({ ts: pt.ts, drawdown: round(dd), drawdownPct: round4(ddPct) });
  }

  /* Streak analysis */
  let currentStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let ws = 0;
  let ls = 0;
  for (const t of sorted) {
    if (t.realizedPnl > 0) { ws++; ls = 0; longestWinStreak = Math.max(longestWinStreak, ws); }
    else if (t.realizedPnl < 0) { ls++; ws = 0; longestLossStreak = Math.max(longestLossStreak, ls); }
  }
  currentStreak = ws > 0 ? ws : -ls;

  /* Per-market breakdown */
  const byMarket = new Map<string, {
    marketId: string; trades: number; buyVol: number; sellVol: number;
    realizedPnl: number; avgEntry: number; avgExit: number;
    entryQty: number; exitQty: number; outcome: string;
  }>();
  for (const t of sorted) {
    const key = `${t.marketId}:${t.outcome}`;
    if (!byMarket.has(key)) {
      byMarket.set(key, {
        marketId: t.marketId, trades: 0, buyVol: 0, sellVol: 0,
        realizedPnl: 0, avgEntry: 0, avgExit: 0, entryQty: 0, exitQty: 0, outcome: t.outcome,
      });
    }
    const m = byMarket.get(key)!;
    m.trades++;
    m.realizedPnl += t.realizedPnl;
    if (t.side === 'BUY') {
      m.buyVol += t.cost;
      m.avgEntry = (m.avgEntry * m.entryQty + t.price * t.size) / (m.entryQty + t.size);
      m.entryQty += t.size;
    } else {
      m.sellVol += t.cost;
      m.avgExit = (m.avgExit * m.exitQty + t.price * t.size) / (m.exitQty + t.size);
      m.exitQty += t.size;
    }
  }
  const marketBreakdown = [...byMarket.values()]
    .map((m) => ({
      marketId: m.marketId,
      outcome: m.outcome,
      trades: m.trades,
      buyVolume: round(m.buyVol),
      sellVolume: round(m.sellVol),
      realizedPnl: round(m.realizedPnl),
      avgEntryPrice: round4(m.avgEntry),
      avgExitPrice: round4(m.avgExit),
    }))
    .sort((a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl));

  /* Hourly trade distribution */
  const hourlyDist = new Array(24).fill(0);
  for (const t of sorted) {
    hourlyDist[new Date(t.timestamp).getHours()]++;
  }

  /* Risk utilization */
  const capitalUsed = wallet.capitalAllocated - wallet.availableBalance;
  const capitalUtilization = wallet.capitalAllocated > 0 ? capitalUsed / wallet.capitalAllocated : 0;
  const dailyLossUsed = Math.abs(Math.min(0, wallet.realizedPnl));
  const dailyLossUtilization = wallet.riskLimits.maxDailyLoss > 0 ? dailyLossUsed / wallet.riskLimits.maxDailyLoss : 0;
  const openTradeUtilization = wallet.riskLimits.maxOpenTrades > 0 ? wallet.openPositions.length / wallet.riskLimits.maxOpenTrades : 0;

  return {
    wallet: {
      walletId: wallet.walletId,
      mode: wallet.mode,
      strategy: wallet.assignedStrategy,
      capitalAllocated: wallet.capitalAllocated,
      availableBalance: round(wallet.availableBalance),
      realizedPnl: round(wallet.realizedPnl),
      openPositions: wallet.openPositions.map((p) => {
        const currentPrice = marketPrices?.get(p.marketId) ?? p.avgPrice;
        const uPnl = p.size > 0 && p.avgPrice > 0 ? (currentPrice - p.avgPrice) * p.size : 0;
        return {
          marketId: p.marketId,
          outcome: p.outcome,
          size: Number(p.size.toFixed(4)),
          avgPrice: Number(p.avgPrice.toFixed(4)),
          realizedPnl: Number(p.realizedPnl.toFixed(4)),
          unrealizedPnl: Number(uPnl.toFixed(4)),
          currentPrice: Number(currentPrice.toFixed(4)),
        };
      }),
      riskLimits: wallet.riskLimits,
    },
    stats: {
      totalTrades,
      buyTrades: buyTrades.length,
      sellTrades: sellTrades.length,
      closedTrades,
      winRate: round4(winRate),
      avgWin: round(avgWin),
      avgLoss: round(avgLoss),
      profitFactor: profitFactor === Infinity ? 'Infinity' : round(profitFactor),
      largestWin: round(largestWin),
      largestLoss: round(largestLoss),
      maxDrawdown: round(maxDrawdown),
      maxDrawdownPct: round4(maxDrawdownPct),
      longestWinStreak,
      longestLossStreak,
      currentStreak,
      unrealizedPnl: round(wallet.openPositions.reduce((sum, p) => {
        const cp = marketPrices?.get(p.marketId) ?? p.avgPrice;
        return sum + (p.size > 0 && p.avgPrice > 0 ? (cp - p.avgPrice) * p.size : 0);
      }, 0)),
      totalPnl: round(wallet.realizedPnl + wallet.openPositions.reduce((sum, p) => {
        const cp = marketPrices?.get(p.marketId) ?? p.avgPrice;
        return sum + (p.size > 0 && p.avgPrice > 0 ? (cp - p.avgPrice) * p.size : 0);
      }, 0)),
      roi: round4((wallet.realizedPnl + wallet.openPositions.reduce((sum, p) => {
        const cp = marketPrices?.get(p.marketId) ?? p.avgPrice;
        return sum + (p.size > 0 && p.avgPrice > 0 ? (cp - p.avgPrice) * p.size : 0);
      }, 0)) / Math.max(1, wallet.capitalAllocated)),
    },
    risk: {
      capitalUtilization: round4(capitalUtilization),
      dailyLossUtilization: round4(dailyLossUtilization),
      openTradeUtilization: round4(openTradeUtilization),
    },
    pnlTimeline,
    drawdownTimeline,
    tradeHistory: sorted.map((t) => ({
      orderId: t.orderId,
      marketId: t.marketId,
      outcome: t.outcome,
      side: t.side,
      price: t.price,
      size: t.size,
      cost: round(t.cost),
      realizedPnl: round(t.realizedPnl),
      cumulativePnl: round(t.cumulativePnl),
      balanceAfter: round(t.balanceAfter),
      timestamp: t.timestamp,
    })),
    marketBreakdown,
    hourlyDistribution: hourlyDist,
  };
}

function round(v: number, d = 2): number { return Number(v.toFixed(d)); }
function round4(v: number): number { return Number(v.toFixed(4)); }
