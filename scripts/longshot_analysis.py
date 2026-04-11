#!/usr/bin/env python3
"""
Longshot Resolution Hunter analysis.

Scans resolved Polymarket markets and estimates whether buying YES at low
prices (1-5 cents) has positive expected value under different filters.

Usage:
  python scripts/longshot_analysis.py

Env overrides:
  GAMMA_API=https://gamma-api.polymarket.com
  SAMPLE_LIMIT=3000
"""

from __future__ import annotations

import json
import math
import os
import ssl
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

GAMMA_API = os.getenv('GAMMA_API', 'https://gamma-api.polymarket.com').rstrip('/')
SAMPLE_LIMIT = int(os.getenv('SAMPLE_LIMIT', '3000'))
PAGE_SIZE = 100
TIMEOUT = 20
INSECURE_SSL = os.getenv('INSECURE_SSL', 'false').lower() == 'true'
MAX_PAGES = int(os.getenv('MAX_PAGES', '300'))
ACTIVE_LIMIT = int(os.getenv('ACTIVE_LIMIT', '1200'))
BACKTEST_MARKETS = int(os.getenv('BACKTEST_MARKETS', '40'))
BACKTEST_TRADE_LIMIT = int(os.getenv('BACKTEST_TRADE_LIMIT', '500'))
BACKTEST_HOURS_BEFORE = int(os.getenv('BACKTEST_HOURS_BEFORE', '24'))
BACKTEST_LOOKBACK_DAYS = int(os.getenv('BACKTEST_LOOKBACK_DAYS', '0'))


@dataclass
class MarketRecord:
  market_id: str
  condition_id: str
  question: str
  end_date: Optional[str]
  liquidity: float
  volume24h: float
  yes_price: float
  yes_price_1d_ago: Optional[float]
  yes_price_1w_ago: Optional[float]
  one_day_change: float
  one_week_change: float
  winner: Optional[str]


@dataclass
class SweepResult:
  name: str
  sample: int
  hit_rate: float
  avg_price: float
  ev_per_share: float
  score: float


@dataclass
class ActiveLongshot:
  market_id: str
  yes_price: float
  liquidity: float
  volume24h: float
  one_day_change: float
  hours_to_resolution: Optional[float]


@dataclass
class BacktestEntry:
  condition_id: str
  market_id: str
  winner: str
  entry_price: float
  entry_ts: int
  target_ts: int
  hours_before: int


def fetch_json(url: str) -> object:
  req = urllib.request.Request(url, headers={'User-Agent': 'longshot-analysis/1.0'})
  context = ssl._create_unverified_context() if INSECURE_SSL else None
  with urllib.request.urlopen(req, timeout=TIMEOUT, context=context) as resp:
    return json.loads(resp.read().decode('utf-8'))


def parse_float(raw: object, default: float = 0.0) -> float:
  try:
    if raw is None:
      return default
    if isinstance(raw, (int, float)):
      return float(raw)
    return float(str(raw))
  except Exception:
    return default


def parse_yes_price(outcome_prices: object) -> Optional[float]:
  if outcome_prices is None:
    return None

  values: List[object]
  if isinstance(outcome_prices, str):
    try:
      values = json.loads(outcome_prices)
    except Exception:
      return None
  elif isinstance(outcome_prices, list):
    values = outcome_prices
  else:
    return None

  if not values:
    return None
  price = parse_float(values[0], -1)
  if price < 0 or price > 1:
    return None
  return price


def previous_price(current_price: float, change_value: float) -> Optional[float]:
  # Gamma change fields may be decimal (0.25) or percent (25).
  if not (0 <= current_price <= 1):
    return None
  pct = change_value
  if abs(pct) > 1:
    pct = pct / 100.0
  denom = 1.0 + pct
  if abs(denom) < 1e-9:
    return None
  prev = current_price / denom
  if not math.isfinite(prev):
    return None
  return max(0.0, min(1.0, prev))


def detect_winner(raw: Dict[str, object], yes_price: Optional[float]) -> Optional[str]:
  # Gamma can surface winner-like fields with slightly different names.
  for key in ('winner', 'winningOutcome', 'resolvedOutcome', 'result'):
    value = raw.get(key)
    if isinstance(value, str):
      upper = value.strip().upper()
      if upper in ('YES', 'NO'):
        return upper

  for key in ('outcome', 'outcomeLabel'):
    value = raw.get(key)
    if isinstance(value, str):
      upper = value.strip().upper()
      if upper == 'YES':
        return 'YES'
      if upper == 'NO':
        return 'NO'

  # Fallback: infer winner from near-terminal prices.
  prices_raw = raw.get('outcomePrices')
  no_price = None
  if isinstance(prices_raw, str):
    try:
      arr = json.loads(prices_raw)
      if isinstance(arr, list) and len(arr) > 1:
        no_price = parse_float(arr[1], -1)
    except Exception:
      no_price = None
  elif isinstance(prices_raw, list) and len(prices_raw) > 1:
    no_price = parse_float(prices_raw[1], -1)

  if yes_price is not None and no_price is not None and 0 <= yes_price <= 1 and 0 <= no_price <= 1:
    if yes_price >= 0.99 and no_price <= 0.01:
      return 'YES'
    if no_price >= 0.99 and yes_price <= 0.01:
      return 'NO'

  return None


def fetch_resolved_markets(limit: int) -> List[MarketRecord]:
  rows: List[MarketRecord] = []
  offset = 0
  pages = 0
  now_ts = int(time.time())
  min_end_ts = now_ts - BACKTEST_LOOKBACK_DAYS * 24 * 3600 if BACKTEST_LOOKBACK_DAYS > 0 else None

  while len(rows) < limit and pages < MAX_PAGES:
    query = urllib.parse.urlencode(
      {
        'active': 'false',
        'closed': 'true',
        'limit': str(PAGE_SIZE),
        'offset': str(offset),
        'order': 'endDate',
        'ascending': 'true',
      }
    )
    url = f'{GAMMA_API}/markets?{query}'

    try:
      payload = fetch_json(url)
    except Exception as exc:
      print(f'Failed fetching offset={offset}: {exc}', file=sys.stderr)
      break

    if not isinstance(payload, list) or not payload:
      break

    for item in payload:
      if not isinstance(item, dict):
        continue

      end_date = str(item.get('endDate')) if item.get('endDate') else None
      end_ts = parse_end_timestamp(end_date)
      if end_ts is None:
        continue
      if end_ts > now_ts:
        # Skip markets that are closed but have not yet passed endDate.
        continue
      if min_end_ts is not None and end_ts < min_end_ts:
        # Skip very old markets; data-api may no longer retain relevant trade history.
        continue

      yes_price = parse_yes_price(item.get('outcomePrices'))
      if yes_price is None:
        continue

      winner = detect_winner(item, yes_price)
      if winner is None:
        # Keep unresolved/unknown-result rows out of EV estimation.
        continue

      rows.append(
        MarketRecord(
          market_id=str(item.get('id', '')),
          condition_id=str(item.get('conditionId', '')),
          question=str(item.get('question', '')),
          end_date=end_date,
          liquidity=parse_float(item.get('liquidityNum')),
          volume24h=parse_float(item.get('volume24hr')),
          yes_price=yes_price,
          yes_price_1d_ago=previous_price(yes_price, parse_float(item.get('oneDayPriceChange'))),
          yes_price_1w_ago=previous_price(yes_price, parse_float(item.get('oneWeekPriceChange'))),
          one_day_change=parse_float(item.get('oneDayPriceChange')),
          one_week_change=parse_float(item.get('oneWeekPriceChange')),
          winner=winner,
        )
      )

      if len(rows) >= limit:
        break

    offset += PAGE_SIZE
    pages += 1
    if len(payload) < PAGE_SIZE:
      break

    time.sleep(0.05)

  return rows


def parse_end_timestamp(end_date: Optional[str]) -> Optional[int]:
  if not end_date:
    return None
  try:
    dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    return int(dt.astimezone(timezone.utc).timestamp())
  except Exception:
    return None


def fetch_market_trades(condition_id: str, limit: int) -> List[dict]:
  query = urllib.parse.urlencode({'market': condition_id, 'limit': str(limit)})
  url = f'https://data-api.polymarket.com/trades?{query}'
  payload = fetch_json(url)
  if not isinstance(payload, list):
    return []
  out: List[dict] = []
  for item in payload:
    if isinstance(item, dict):
      out.append(item)
  return out


def estimate_entry_from_trades(market: MarketRecord, hours_before: int, trade_limit: int) -> Optional[BacktestEntry]:
  if market.winner not in ('YES', 'NO'):
    return None
  if not market.condition_id:
    return None

  end_ts = parse_end_timestamp(market.end_date)
  if end_ts is None:
    return None

  target_ts = end_ts - hours_before * 3600
  trades = fetch_market_trades(market.condition_id, trade_limit)
  if not trades:
    return None

  best: Optional[Tuple[int, float]] = None
  nearest: Optional[Tuple[int, float, int]] = None  # (distance, ts, price)
  for t in trades:
    try:
      ts = int(t.get('timestamp'))
      outcome_idx = t.get('outcomeIndex')
      outcome_name = str(t.get('outcome', '')).strip().lower()
      is_yes = (outcome_idx == 0) or (outcome_name == 'yes')
      if not is_yes:
        continue
      px = parse_float(t.get('price'), -1)
      if not (0 < px < 1):
        continue
      if ts <= target_ts:
        if best is None or ts > best[0]:
          best = (ts, px)
      dist = abs(ts - target_ts)
      if nearest is None or dist < nearest[0]:
        nearest = (dist, ts, px)
    except Exception:
      continue

  chosen: Optional[Tuple[int, float]] = best
  if chosen is None and nearest is not None:
    # Fall back to nearest trade around target when exact pre-target trade is unavailable.
    chosen = (nearest[1], nearest[2])
  if chosen is None:
    return None

  return BacktestEntry(
    condition_id=market.condition_id,
    market_id=market.market_id,
    winner=market.winner,
    entry_price=chosen[1],
    entry_ts=chosen[0],
    target_ts=target_ts,
    hours_before=hours_before,
  )


def run_trade_backtest(resolved: List[MarketRecord], max_markets: int, hours_before: int) -> List[BacktestEntry]:
  out: List[BacktestEntry] = []
  scanned = 0
  for m in resolved:
    if scanned >= max_markets:
      break
    if not m.condition_id:
      continue
    scanned += 1
    try:
      entry = estimate_entry_from_trades(m, hours_before=hours_before, trade_limit=BACKTEST_TRADE_LIMIT)
      if entry:
        out.append(entry)
    except Exception:
      continue
    time.sleep(0.03)

  print(f'\n=== TRADE BACKTEST COVERAGE ===')
  print(f'markets_scanned={scanned} entries_with_t-{hours_before}h_price={len(out)}')
  return out


def summarize_backtest(entries: List[BacktestEntry], name: str, price_filter) -> SweepResult:
  filtered = [e for e in entries if price_filter(e.entry_price)]
  if not filtered:
    return SweepResult(name=name, sample=0, hit_rate=0.0, avg_price=0.0, ev_per_share=0.0, score=0.0)

  wins = sum(1 for e in filtered if e.winner == 'YES')
  hit_rate = wins / len(filtered)
  avg_price = sum(e.entry_price for e in filtered) / len(filtered)
  ev = hit_rate - avg_price
  score = ev * len(filtered)
  return SweepResult(name=name, sample=len(filtered), hit_rate=hit_rate, avg_price=avg_price, ev_per_share=ev, score=score)


def print_trade_backtest(entries: List[BacktestEntry], hours_before: int) -> None:
  print(f'\n=== TRADE BACKTEST (T-{hours_before}h YES ENTRY) ===')
  for label, lo, hi in (
    ('0.005-0.01', 0.005, 0.01),
    ('0.01-0.02', 0.01, 0.02),
    ('0.02-0.03', 0.02, 0.03),
    ('0.03-0.05', 0.03, 0.05),
  ):
    stats = summarize_backtest(entries, label, lambda p, lo=lo, hi=hi: lo <= p < hi)
    kelly = kelly_fraction(stats.hit_rate, stats.avg_price) if stats.sample > 0 else 0
    print(
      f'{label:12s} sample={stats.sample:4d} '
      f'hit_rate={stats.hit_rate:6.2%} avg_px={stats.avg_price:6.4f} '
      f'ev/share={stats.ev_per_share:7.4f} kelly={kelly:6.2%}'
    )

  print('\n=== TRADE BACKTEST FILTER SWEEPS ===')
  sweeps = [
    summarize_backtest(entries, 'baseline_1_to_5c', lambda p: 0.01 <= p <= 0.05),
    summarize_backtest(entries, 'strict_1_to_3c', lambda p: 0.01 <= p <= 0.03),
    summarize_backtest(entries, 'strict_2_to_4c', lambda p: 0.02 <= p <= 0.04),
  ]
  for res in sorted(sweeps, key=lambda r: r.score, reverse=True):
    print(
      f'{res.name:28s} sample={res.sample:4d} hit_rate={res.hit_rate:6.2%} '
      f'avg_px={res.avg_price:6.4f} ev/share={res.ev_per_share:7.4f} score={res.score:8.2f}'
    )


def fetch_active_longshots(limit: int) -> List[ActiveLongshot]:
  rows: List[ActiveLongshot] = []
  offset = 0

  while len(rows) < limit:
    query = urllib.parse.urlencode(
      {
        'active': 'true',
        'closed': 'false',
        'limit': str(PAGE_SIZE),
        'offset': str(offset),
        'order': 'volume24hr',
        'ascending': 'false',
      }
    )
    url = f'{GAMMA_API}/markets?{query}'

    try:
      payload = fetch_json(url)
    except Exception as exc:
      print(f'Failed fetching active offset={offset}: {exc}', file=sys.stderr)
      break

    if not isinstance(payload, list) or not payload:
      break

    for item in payload:
      if not isinstance(item, dict):
        continue

      yes_price = parse_yes_price(item.get('outcomePrices'))
      if yes_price is None:
        continue

      hours_to_resolution: Optional[float] = None
      end_date = item.get('endDate')
      if isinstance(end_date, str):
        try:
          dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
          hours_to_resolution = (dt.astimezone(timezone.utc).timestamp() - time.time()) / 3600
        except Exception:
          hours_to_resolution = None

      rows.append(
        ActiveLongshot(
          market_id=str(item.get('id', '')),
          yes_price=yes_price,
          liquidity=parse_float(item.get('liquidityNum')),
          volume24h=parse_float(item.get('volume24hr')),
          one_day_change=parse_float(item.get('oneDayPriceChange')),
          hours_to_resolution=hours_to_resolution,
        )
      )

      if len(rows) >= limit:
        break

    offset += PAGE_SIZE
    if len(payload) < PAGE_SIZE:
      break

  return rows


def bucket_name(price: float) -> Optional[str]:
  if 0.005 <= price < 0.01:
    return '0.005-0.01'
  if 0.01 <= price < 0.02:
    return '0.01-0.02'
  if 0.02 <= price < 0.03:
    return '0.02-0.03'
  if 0.03 <= price < 0.05:
    return '0.03-0.05'
  return None


def kelly_fraction(win_prob: float, price: float) -> float:
  # For a YES share bought at p: b = (1-p)/p, q = 1-p_win.
  if price <= 0 or price >= 1:
    return 0.0
  b = (1.0 - price) / price
  q = 1.0 - win_prob
  f = (b * win_prob - q) / b
  return max(0.0, min(1.0, f))


def summarize(records: Iterable[MarketRecord], name: str) -> SweepResult:
  items = list(records)
  if not items:
    return SweepResult(name=name, sample=0, hit_rate=0.0, avg_price=0.0, ev_per_share=0.0, score=0.0)

  wins = sum(1 for x in items if x.winner == 'YES')
  hit_rate = wins / len(items)
  avg_price = sum(x.yes_price for x in items) / len(items)
  ev = hit_rate - avg_price
  score = ev * len(items)
  return SweepResult(name=name, sample=len(items), hit_rate=hit_rate, avg_price=avg_price, ev_per_share=ev, score=score)


def run_sweeps(rows: List[MarketRecord]) -> List[SweepResult]:
  candidates: List[Tuple[str, callable]] = [
    ('baseline_1_to_5c', lambda x: 0.01 <= x.yes_price <= 0.05),
    (
      'momentum_25pct',
      lambda x: 0.01 <= x.yes_price <= 0.05 and normalize_percent(x.one_day_change) >= 25,
    ),
    (
      'momentum_plus_liquidity',
      lambda x: 0.01 <= x.yes_price <= 0.05 and normalize_percent(x.one_day_change) >= 25 and x.liquidity >= 300,
    ),
    (
      'momentum_liquidity_volume',
      lambda x: (
        0.01 <= x.yes_price <= 0.05
        and normalize_percent(x.one_day_change) >= 25
        and x.liquidity >= 300
        and x.volume24h >= 100
      ),
    ),
    (
      'strict_2_to_4c',
      lambda x: (
        0.02 <= x.yes_price <= 0.04
        and normalize_percent(x.one_day_change) >= 30
        and x.liquidity >= 500
        and x.volume24h >= 300
      ),
    ),
  ]

  out: List[SweepResult] = []
  for name, filt in candidates:
    out.append(summarize((r for r in rows if filt(r)), name))

  return sorted(out, key=lambda r: r.score, reverse=True)


def normalize_percent(value: float) -> float:
  if abs(value) <= 1:
    return value * 100
  return value


def required_hit_rate(price: float, round_trip_cost: float) -> float:
  return min(0.999, max(0.0, price + round_trip_cost))


def print_break_even_table() -> None:
  print('\n=== BREAK-EVEN HIT RATE TABLE ===')
  costs = [0.0, 0.005, 0.01]
  print('price    cost=0.00  cost=0.005  cost=0.01')
  for px in (0.01, 0.02, 0.03, 0.05):
    rates = [required_hit_rate(px, c) for c in costs]
    print(f'{px:0.3f}    {rates[0]:7.2%}   {rates[1]:9.2%}   {rates[2]:8.2%}')


def print_live_opportunity_scan() -> None:
  rows = fetch_active_longshots(ACTIVE_LIMIT)
  if not rows:
    print('\n=== LIVE OPPORTUNITY SCAN ===')
    print('No active rows fetched.')
    return

  price_band = [r for r in rows if 0.01 <= r.yes_price <= 0.05]
  base_filters = [
    r for r in price_band
    if r.liquidity >= 300
    and r.volume24h >= 100
    and (r.hours_to_resolution is not None and 0 < r.hours_to_resolution <= 120)
  ]

  candidates = [
    r for r in rows
    if 0.01 <= r.yes_price <= 0.05
    and r.liquidity >= 300
    and r.volume24h >= 100
    and (r.hours_to_resolution is not None and 0 < r.hours_to_resolution <= 120)
    and normalize_percent(r.one_day_change) >= 25
  ]

  tight_candidates = [
    r for r in rows
    if 0.01 <= r.yes_price <= 0.04
    and r.liquidity >= 1_000
    and r.volume24h >= 500
    and (r.hours_to_resolution is not None and 0 < r.hours_to_resolution <= 120)
    and normalize_percent(r.one_day_change) >= 30
  ]

  print('\n=== LIVE OPPORTUNITY SCAN ===')
  print(f'active_markets_scanned={len(rows)}')
  print(f'price_band_1_to_5c={len(price_band)}')
  print(f'base_filters(1-5c,liq>=300,vol>=100,res<=120h)={len(base_filters)}')
  print(f'+momentum_25pct={len(candidates)}')
  print(f'tight_candidates(1-4c,liq>=1000,vol>=500,res<=120h,mom>=30%)={len(tight_candidates)}')


def print_bucket_stats(rows: List[MarketRecord], label: str, price_selector) -> None:
  buckets: Dict[str, List[MarketRecord]] = {
    '0.005-0.01': [],
    '0.01-0.02': [],
    '0.02-0.03': [],
    '0.03-0.05': [],
  }

  for row in rows:
    px = price_selector(row)
    if px is None:
      continue
    name = bucket_name(px)
    if name:
      buckets[name].append(row)

  print(f'\n=== PRICE BUCKETS ({label}) ===')
  for name in ('0.005-0.01', '0.01-0.02', '0.02-0.03', '0.03-0.05'):
    stats = summarize(buckets[name], name)
    kelly = kelly_fraction(stats.hit_rate, stats.avg_price) if stats.sample > 0 else 0
    print(
      f'{name:12s} sample={stats.sample:4d} '
      f'hit_rate={stats.hit_rate:6.2%} avg_px={stats.avg_price:6.4f} '
      f'ev/share={stats.ev_per_share:7.4f} kelly={kelly:6.2%}'
    )


def main() -> int:
  print(f'Fetching up to {SAMPLE_LIMIT} resolved markets from {GAMMA_API}...')
  rows = fetch_resolved_markets(SAMPLE_LIMIT)
  print(f'Collected {len(rows)} resolved markets with winner labels.')

  if not rows:
    print('No resolved rows collected; skipping resolved-market EV section.')
  else:
    print_bucket_stats(rows, 'YES ENTRY AT CLOSE (terminal)', lambda r: r.yes_price)
    print_bucket_stats(rows, 'YES ENTRY PROXY AT T-1D', lambda r: r.yes_price_1d_ago)
    print_bucket_stats(rows, 'YES ENTRY PROXY AT T-1W', lambda r: r.yes_price_1w_ago)

    print('\n=== PARAMETER SWEEPS (ranked by EV * sample) ===')
    for res in run_sweeps(rows):
      print(
        f'{res.name:28s} sample={res.sample:4d} hit_rate={res.hit_rate:6.2%} '
        f'avg_px={res.avg_price:6.4f} ev/share={res.ev_per_share:7.4f} score={res.score:8.2f}'
      )

  print_break_even_table()
  print_live_opportunity_scan()

  if rows:
    backtest_entries = run_trade_backtest(
      rows,
      max_markets=BACKTEST_MARKETS,
      hours_before=BACKTEST_HOURS_BEFORE,
    )
    if backtest_entries:
      print_trade_backtest(backtest_entries, BACKTEST_HOURS_BEFORE)
    else:
      print('\nNo trade-backtest entries available for current sample/retention window.')

  return 0


if __name__ == '__main__':
  raise SystemExit(main())
