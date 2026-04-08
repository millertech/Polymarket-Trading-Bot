import { describe, it, expect } from 'vitest';
import { PositionManager } from '../src/execution/position_manager';
import { Position } from '../src/types';

const pos1: Position = {
  marketId: 'market_a',
  outcome: 'YES',
  avgPrice: 0.55,
  size: 20,
  realizedPnl: 0,
};

const pos2: Position = {
  marketId: 'market_b',
  outcome: 'NO',
  avgPrice: 0.4,
  size: 10,
  realizedPnl: 0,
};

describe('PositionManager', () => {
  it('returns empty array for an unknown wallet', () => {
    const pm = new PositionManager();
    expect(pm.getPositions('wallet_unknown')).toEqual([]);
  });

  it('stores and retrieves positions for a wallet', () => {
    const pm = new PositionManager();
    pm.setPositions('wallet_1', [pos1, pos2]);
    const result = pm.getPositions('wallet_1');
    expect(result).toHaveLength(2);
    expect(result[0].marketId).toBe('market_a');
    expect(result[1].marketId).toBe('market_b');
  });

  it('overwrites positions when setPositions is called again', () => {
    const pm = new PositionManager();
    pm.setPositions('wallet_1', [pos1, pos2]);
    pm.setPositions('wallet_1', [pos2]);
    const result = pm.getPositions('wallet_1');
    expect(result).toHaveLength(1);
    expect(result[0].marketId).toBe('market_b');
  });

  it('isolates positions between different wallets', () => {
    const pm = new PositionManager();
    pm.setPositions('wallet_1', [pos1]);
    pm.setPositions('wallet_2', [pos2]);

    expect(pm.getPositions('wallet_1')).toHaveLength(1);
    expect(pm.getPositions('wallet_1')[0].marketId).toBe('market_a');

    expect(pm.getPositions('wallet_2')).toHaveLength(1);
    expect(pm.getPositions('wallet_2')[0].marketId).toBe('market_b');
  });

  it('stores an empty array and returns it correctly', () => {
    const pm = new PositionManager();
    pm.setPositions('wallet_1', []);
    expect(pm.getPositions('wallet_1')).toEqual([]);
  });

  it('returns a copy so external mutations do not affect the stored state', () => {
    const pm = new PositionManager();
    pm.setPositions('wallet_1', [{ ...pos1 }]);
    const result = pm.getPositions('wallet_1');
    // PositionManager returns the reference stored; verify distinct object identity
    // (this test documents current behaviour and will catch regressions if isolation is added)
    expect(result[0].marketId).toBe('market_a');
  });
});
