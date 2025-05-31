async function refreshPricesAndCards() {
  const wd = window.walletData;
  if (!wd?.address) return;

  // 1) define tracked coins
  const tracked = [
    { symbol: 'ETH',  id: 'ethereum', amt: parseFloat(wd.balance)    || 0 },
    { symbol: 'SOL',  id: 'solana',   amt: parseFloat(wd.solBalance) || 0 },
    { symbol: 'USDT', id: 'tether',   amt: parseFloat(wd.usdtBalance)|| 0 },
  ];
  const ids = tracked.map(t => t.id).join(',');

  // 2) fetch prices
  let prices;
  try {
    const rsp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,eth`
    );
    prices = await rsp.json();
  } catch {
    console.warn('CoinGecko fetch failed');
    return;
  }

  // 3) enrich everything (don't filter out zeros)
  const enriched = tracked.map(t => ({
    ...t,
    priceUsd: prices[t.id]?.usd || 0,
    priceEth: prices[t.id]?.eth || 0,
    valueUsd: t.amt * (prices[t.id]?.usd || 0),
    valueEth: t.amt * (prices[t.id]?.eth || 0),
  }));

  // 4) compute total USD
  const totalUsd = enriched.reduce((sum, h) => sum + h.valueUsd, 0);

  // 5) render Card #1: portfolio summary
  document.querySelector('#card-1 .middle h1').textContent = totalUsd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
  document.querySelector('#card-1 .top .left h2').textContent = 'Portfolio';

  // 6) sort by USD value for top 2 holdings
  enriched.sort((a, b) => b.valueUsd - a.valueUsd);

  // 7) render Cards #2 and #3
  [1, 2].forEach((cardIndex, idx) => {
    const h = enriched[idx] || { symbol: '—', amt: 0, valueUsd: 0, priceUsd: 0 };
    const card = document.querySelector(`#card-${cardIndex + 1}`);


    // balance + value + unit price
    if (h.amt === 0) {
      card.querySelector('.middle h1').textContent = `0 ${h.symbol} / $${h.priceUsd.toFixed(2)}`;
    } else {
      const equivalent = h.symbol === 'ETH'
        ? `${h.valueEth.toFixed(4)} ETH`
        : `$${h.valueUsd.toFixed(2)}`;
      card.querySelector('.middle h1').textContent = `${h.amt.toFixed(4)} (~${equivalent})`;
    }
  });
}

window.addEventListener('panelShown', ({ detail }) => {
  if (detail.panelId === 'overview') {
    refreshPricesAndCards();
  }
});

document.addEventListener('DOMContentLoaded', refreshPricesAndCards);
