import { runBacktest, type PriceDataPoint } from '../lib/simulation/backtest';

const points: PriceDataPoint[] = [];
for (let i = 0; i < 30; i++) {
  points.push({
    timestamp: 1_700_000_000 + i * 86_400,
    price: 1.0 + Math.sin(i / 5) * 0.02,
    volumeUSD: 5_000_000,
  });
}

const r = runBacktest({
  priceHistory: points,
  entryTimestamp: points[0].timestamp,
  lowerPrice: 0.9,
  upperPrice: 1.1,
  depositAmount: 10000,
  depositToken: 'usd',
  rebalanceMode: 'none',
  gasCostGwei: 20,
  gasUnitsPerRebalance: 250_000,
  feeTier: 500,
  token0Decimals: 6,
  token1Decimals: 18,
});

console.log('totalReturn:', r.totalReturn);
console.log('hodlReturn:', r.hodlReturn);
console.log('timeInRange:', r.timeInRange);
console.log('totalFees:', r.totalFees);
console.log('realizedIL:', r.realizedIL);
console.log('equityCurve first 3:', r.equityCurve.slice(0, 3));
console.log('equityCurve last 3:', r.equityCurve.slice(-3));
