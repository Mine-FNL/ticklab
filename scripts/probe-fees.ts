async function main() {
  // Get WETH/USDC 0.05% chart
  const r = await fetch('https://yields.llama.fi/pools');
  const pools = (await r.json()).data;
  
  for (const filter of [
    {sym: 'WETH-USDC', meta: '0.05%', chain: 'Ethereum', label: 'WETH/USDC 0.05%'},
    {sym: 'WETH-USDC', meta: '0.3%', chain: 'Ethereum', label: 'WETH/USDC 0.3%'},
    {sym: 'LINK-WETH', meta: '0.3%', chain: 'Ethereum', label: 'LINK/WETH 0.3%'},
    {sym: 'LDO-WETH', meta: '0.3%', chain: 'Ethereum', label: 'LDO/WETH 0.3%'},
    {sym: 'WBTC-USDC', meta: '0.3%', chain: 'Ethereum', label: 'WBTC/USDC 0.3%'},
  ]) {
    const match = pools.find((p: any) => p.chain === filter.chain && p.project === 'uniswap-v3' &&
      p.symbol?.includes(filter.sym) && p.poolMeta === filter.meta);
    if (!match) { console.log(filter.label, 'not found'); continue; }
    const chartRes = await fetch(`https://yields.llama.fi/chart/${match.pool}`);
    const chart = (await chartRes.json()).data;
    const last30 = chart.slice(-30);
    const tvls = last30.map((d: any) => d.tvlUsd);
    const apys = last30.map((d: any) => d.apyBase);
    const avgTvl = tvls.reduce((a:number,b:number)=>a+b,0)/tvls.length;
    const avgApy = apys.reduce((a:number,b:number)=>a+b,0)/apys.length;
    const avgDailyFees = avgTvl * avgApy / 100 / 365;
    const feeRate = filter.meta === '0.05%' ? 0.0005 : filter.meta === '0.3%' ? 0.003 : 0.01;
    const impliedVol = avgDailyFees / feeRate;
    console.log(`${filter.label.padEnd(20)} apy=${avgApy.toFixed(1).padStart(7)}% tvl=$${(avgTvl/1e6).toFixed(0)}M  fees/day=$${avgDailyFees.toFixed(0)}  implied_vol=$${(impliedVol/1e6).toFixed(0)}M`);
  }
}
main();
