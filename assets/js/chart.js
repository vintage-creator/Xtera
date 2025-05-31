// chart.js
const rootStyles   = getComputedStyle(document.documentElement);
const primaryColor = rootStyles.getPropertyValue("--color-primary").trim();
const DAYS          = 30;
let allocChart      = null;  

// Restore walletData
function restoreWalletData() {
  const raw = localStorage.getItem("walletData");
  if (!raw) return;
  try { window.walletData = JSON.parse(raw); } catch {}
}

async function buildMarketPricesChart() {
  const skeleton = document.getElementById("chart-skeleton");
  const canvas   = document.getElementById("allocChart");

  skeleton.style.display = "block";
  canvas.classList.add("hidden");
  
  const coins = [
    { symbol: "ETH",  id: "ethereum",      colors: ["#5d70ff","#007bff"] },
    { symbol: "BNB",  id: "binancecoin",   colors: ["#f3ba2f","#f0b90b"] },
    { symbol: "ADA",  id: "cardano",       colors: ["#0033ad","#1e35ff"] },
    { symbol: "SOL",  id: "solana",        colors: ["#7f8191","#27282f"] },
    { symbol: "DOGE", id: "dogecoin",      colors: ["#c2a633","#b1991c"] },
    { symbol: "DOT",  id: "polkadot",      colors: ["#e6007a","#d1006b"] },
    { symbol: "XRP",  id: "ripple",        colors: ["#23292f","#0a0e12"] },
    { symbol: "LINK", id: "chainlink",     colors: ["#2a5ada","#1f42c4"] },
    { symbol: "LTC",  id: "litecoin",      colors: ["#bfbbbb","#999999"] },
    { symbol: "UNI",  id: "uniswap",       colors: ["#ff007a","#e6006b"] },
    { symbol: "MATIC",id: "matic-network", colors: ["#8247e5","#6c35c4"] },
    { symbol: "AVAX", id: "avalanche-2",   colors: ["#e84142","#c73033"] }
  ];

  const ids = coins.map(c => c.id).join(",");
  let prices;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    );
    prices = await res.json();
  } catch {
    console.warn("Market price fetch failed");
    return;
  }

  const labels = coins.map(c => c.symbol);
  const data   = coins.map(c => prices[c.id]?.usd || 0);
  canvas.height = 200;                 
  const ctx = canvas.getContext("2d");

  if (allocChart) {
    allocChart.destroy();
    allocChart = null;
  }

  const backgrounds = coins.map(({ colors }) => {
    const [start, end] = colors;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, start);
    grad.addColorStop(1, end);
    return grad;
  });

  allocChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Market Price (USD)",
        data,
        backgroundColor: backgrounds,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => `$${v.toLocaleString()}`
          }
        }
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Current Market Prices",
          font: { size: 16 }
        },
        tooltip: {
          callbacks: {
            label: ctx => `$${ctx.parsed.y.toLocaleString()}`
          }
        }
      }
    }
  });
  skeleton.style.display = "none";
  canvas.classList.remove("hidden");
  canvas.style.backgroundColor = "#ffff"
}


window.addEventListener('panelShown', async ({ detail }) => {
  if (detail.panelId === 'overview') {
    restoreWalletData();
    await buildMarketPricesChart();
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  restoreWalletData();
  await buildMarketPricesChart();
});
