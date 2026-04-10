import csv
from collections import defaultdict

buys = defaultdict(lambda: {'count': 0, 'usd': 0.0, 'shares': 0.0})
sells = defaultdict(lambda: {'count': 0, 'usd': 0.0, 'shares': 0.0})
total_buy_usd = 0.0
total_sell_usd = 0.0
redeem_usd = 0.0
redeem_count = 0
dup_hashes = defaultdict(int)

with open('Polymarket-History-2026-04-09.csv', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    # Strip surrounding quotes from header keys (Polymarket exports wrap them)
    reader.fieldnames = [k.strip('"') for k in reader.fieldnames] if reader.fieldnames else None
    for row in reader:
        row = {k.strip('"'): v for k, v in row.items()}
        market = row['marketName']
        action = row['action']
        usd = float(row['usdcAmount'] or 0)
        shares = float(row['tokenAmount'] or 0)
        dup_hashes[row['hash']] += 1
        if action == 'Buy':
            buys[market]['count'] += 1
            buys[market]['usd'] += usd
            buys[market]['shares'] += shares
            total_buy_usd += usd
        elif action == 'Sell':
            sells[market]['count'] += 1
            sells[market]['usd'] += usd
            sells[market]['shares'] += shares
            total_sell_usd += usd
        elif action == 'Redeem':
            redeem_count += 1
            redeem_usd += usd

print('=== SUMMARY ===')
print('BUY trades: %d  |  USD spent: $%.2f' % (sum(v['count'] for v in buys.values()), total_buy_usd))
print('SELL trades: %d  |  USD received: $%.2f' % (sum(v['count'] for v in sells.values()), total_sell_usd))
print('REDEEM: %d  |  Proceeds: $%.2f' % (redeem_count, redeem_usd))
print('Net realized (sell+redeem - buy): $%.2f' % (total_sell_usd + redeem_usd - total_buy_usd))
print()

all_markets = set(list(buys.keys()) + list(sells.keys()))
pnl = {m: sells[m]['usd'] - buys[m]['usd'] for m in all_markets}

print('=== TOP 15 LOSERS ===')
for m, p in sorted(pnl.items(), key=lambda x: x[1])[:15]:
    b = buys[m]
    s = sells[m]
    print('  $%.2f  buy=$%.2f(%dx)  sell=$%.2f(%dx)  %s' % (p, b['usd'], b['count'], s['usd'], s['count'], m[:70]))

print()
print('=== TOP 10 WINNERS ===')
for m, p in sorted(pnl.items(), key=lambda x: -x[1])[:10]:
    b = buys[m]
    s = sells[m]
    print('  +$%.2f  buy=$%.2f(%dx)  sell=$%.2f(%dx)  %s' % (p, b['usd'], b['count'], s['usd'], s['count'], m[:70]))

print()
dups = {h: c for h, c in dup_hashes.items() if c > 1}
print('=== DUPLICATE HASHES: %d (same tx submitted multiple times) ===' % len(dups))
for h, c in sorted(dups.items(), key=lambda x: -x[1])[:15]:
    print('  %s...  %dx' % (h[:32], c))
